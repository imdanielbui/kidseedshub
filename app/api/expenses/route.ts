import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { createAuditLog, getActiveStaffRecipientIds, notifyUsers } from "@/lib/backend/activity"
import { nextExpenseCode } from "@/lib/backend/codes"
import { parseMonth } from "@/lib/backend/date"
import type { ExpenseListItem } from "@/lib/contracts/finance"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { expenseCreateSchema, receiptListQuerySchema } from "@/lib/validations/finance"

const expenseListInclude = Prisma.validator<Prisma.ExpenseInclude>()({
  createdBy: true
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
    createdByName: expense.createdBy.name
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
  const expense = await prisma.$transaction(async (tx) => {
    const code = await nextExpenseCode(tx, new Date(data.date))

    const created = await tx.expense.create({
      data: {
        code,
        category: data.category,
        amount: data.amount,
        description: data.description,
        invoiceUrl: data.invoiceUrl,
        date: new Date(data.date),
        createdById: session.user.id
      },
      include: expenseListInclude
    })

    await createAuditLog(tx, {
      actorId: session.user.id,
      action: "expense.create",
      entityType: "Expense",
      entityId: created.id,
      summary: `Tạo phiếu chi ${created.code}`,
      metadata: {
        code: created.code,
        category: created.category,
        amount: created.amount.toString()
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
}
