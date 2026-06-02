import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { createAuditLog, getActiveStaffRecipientIds, notifyUsers } from "@/lib/backend/activity"
import { nextExpenseCode } from "@/lib/backend/codes"
import { parseMonth } from "@/lib/backend/date"
import { isMakeupEntitlementTerminal } from "@/lib/backend/makeup-entitlement"
import type { ExpenseListItem } from "@/lib/contracts/finance"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { expenseCreateSchema, receiptListQuerySchema } from "@/lib/validations/finance"

const expenseListInclude = Prisma.validator<Prisma.ExpenseInclude>()({
  createdBy: true,
  refundStudent: true
})

type ExpenseListRecord = Prisma.ExpenseGetPayload<{ include: typeof expenseListInclude }>

function toExpenseListItem(expense: ExpenseListRecord): ExpenseListItem {
  return {
    id: expense.id,
    code: expense.code,
    category: expense.category,
    amount: expense.amount.toString(),
    description: expense.description,
    date: expense.date.toISOString(),
    createdByName: expense.createdBy.name,
    refundEntitlementId: expense.refundEntitlementId ?? undefined,
    refundStudentId: expense.refundStudentId ?? undefined,
    refundStudentName: expense.refundStudent?.name
  }
}

export async function GET(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "finance:view_summary")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền xem phiếu chi." }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const parsed = receiptListQuerySchema.safeParse(Object.fromEntries(searchParams))

  if (!parsed.success) {
    return fail({ code: "INVALID_QUERY", message: "Bộ lọc phiếu chi không hợp lệ." }, { status: 400 })
  }

  const range = parsed.data.month ? parseMonth(parsed.data.month) : null
  const expenses = await prisma.expense.findMany({
    where: {
      ...(range ? { date: { gte: range.start, lt: range.end } } : {})
    },
    include: expenseListInclude,
    orderBy: { date: "desc" }
  })

  return ok(expenses.map(toExpenseListItem))
}

export async function POST(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "expenses:create")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền tạo phiếu chi." }, { status: 403 })
  }

  const body = await request.json()
  const parsed = expenseCreateSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Thông tin phiếu chi không hợp lệ." }, { status: 400 })
  }

  const data = parsed.data

  if (data.refundEntitlementId && !can(session.user.role, "refunds:manage")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền tạo phiếu chi hoàn tiền." }, { status: 403 })
  }

  try {
    const expense = await prisma.$transaction(async (tx) => {
      const code = await nextExpenseCode(tx, new Date(data.date))
      const refundEntitlement = data.refundEntitlementId
        ? await tx.makeupEntitlement.findUnique({
            where: { id: data.refundEntitlementId },
            include: { student: true }
          })
        : null

      if (data.refundEntitlementId && !refundEntitlement) {
        throw new Error("MAKEUP_ENTITLEMENT_NOT_FOUND")
      }

      if (refundEntitlement) {
        if (data.category !== "OTHER") {
          throw new Error("REFUND_CATEGORY_INVALID")
        }

        if (isMakeupEntitlementTerminal(refundEntitlement.status)) {
          throw new Error("MAKEUP_ENTITLEMENT_RESOLVED")
        }

        if (!refundEntitlement.isEligible) {
          throw new Error("MAKEUP_ENTITLEMENT_NOT_ELIGIBLE")
        }
      }

      const created = await tx.expense.create({
        data: {
          code,
          category: data.category,
          amount: data.amount,
          description: data.description,
          invoiceUrl: data.invoiceUrl,
          date: new Date(data.date),
          createdById: session.user.id,
          refundEntitlementId: refundEntitlement?.id,
          refundStudentId: refundEntitlement?.studentId
        },
        include: expenseListInclude
      })

      if (refundEntitlement) {
        await tx.makeupEntitlement.update({
          where: { id: refundEntitlement.id },
          data: {
            status: "REFUNDED",
            resolvedAmount: data.amount,
            resolvedAt: new Date(data.date),
            resolvedById: session.user.id,
            note: data.description
          }
        })
      }

      await createAuditLog(tx, {
        actorId: session.user.id,
        action: "expense.create",
        entityType: "Expense",
        entityId: created.id,
        summary: `Tạo phiếu chi ${created.code}`,
        metadata: {
          code: created.code,
          category: created.category,
          amount: created.amount.toString(),
          refundEntitlementId: created.refundEntitlementId
        }
      })

      await notifyUsers(tx, {
        recipientIds: await getActiveStaffRecipientIds(tx, ["ADMIN"]),
        actorId: session.user.id,
        title: `Phiếu chi mới ${created.code}`,
        body: `${created.description} - ${created.amount.toString()}đ`,
        href: "/finance",
        type: "FINANCE"
      })

      return created
    })

    return ok(toExpenseListItem(expense), { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === "MAKEUP_ENTITLEMENT_NOT_FOUND") {
      return fail({ code: "MAKEUP_ENTITLEMENT_NOT_FOUND", message: "Không tìm thấy quyền học bù để hoàn tiền." }, { status: 404 })
    }

    if (error instanceof Error && error.message === "REFUND_CATEGORY_INVALID") {
      return fail({ code: "REFUND_CATEGORY_INVALID", message: "Phiếu chi hoàn tiền phải dùng nhóm Khác để tách báo cáo refund." }, { status: 400 })
    }

    if (error instanceof Error && error.message === "MAKEUP_ENTITLEMENT_RESOLVED") {
      return fail({ code: "MAKEUP_ENTITLEMENT_RESOLVED", message: "Quyền học bù này đã được xử lý xong." }, { status: 409 })
    }

    if (error instanceof Error && error.message === "MAKEUP_ENTITLEMENT_NOT_ELIGIBLE") {
      return fail({ code: "MAKEUP_ENTITLEMENT_NOT_ELIGIBLE", message: "Quyền học bù này không đủ điều kiện hoàn tiền." }, { status: 400 })
    }

    throw error
  }
}
