import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { createAuditLog, getActiveStaffRecipientIds, notifyUsers } from "@/lib/backend/activity"
import { nextExpenseCode } from "@/lib/backend/codes"
import {
  isMakeupEntitlementTerminal,
  makeupEntitlementInclude,
  toMakeupEntitlementItem
} from "@/lib/backend/makeup-entitlement"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { makeupEntitlementUpdateSchema } from "@/lib/validations/makeup-entitlement"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "makeup:manage")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền cập nhật quyền học bù." }, { status: 403 })
  }

  const body = await request.json()
  const parsed = makeupEntitlementUpdateSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Thông tin xử lý quyền học bù không hợp lệ." }, { status: 400 })
  }

  if (parsed.data.action === "credit" && !can(session.user.role, "wallet:apply_credit")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền chuyển quyền học bù thành credit." }, { status: 403 })
  }

  if (parsed.data.action === "refund" && !can(session.user.role, "refunds:manage")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền hoàn tiền quyền học bù." }, { status: 403 })
  }

  const { id } = await context.params

  try {
    const entitlement = await prisma.$transaction(async (tx) => {
      const existing = await tx.makeupEntitlement.findUnique({
        where: { id },
        include: makeupEntitlementInclude
      })

      if (!existing) {
        return null
      }

      if (session.user.role === "TEACHER" && existing.classSession?.class.teacherId !== session.user.id) {
        throw new Error("TEACHER_FORBIDDEN")
      }

      if (isMakeupEntitlementTerminal(existing.status)) {
        throw new Error("MAKEUP_ENTITLEMENT_RESOLVED")
      }

      if (!existing.isEligible && parsed.data.action !== "reject") {
        throw new Error("MAKEUP_ENTITLEMENT_NOT_ELIGIBLE")
      }

      const now = new Date()
      const amount = parsed.data.amount !== undefined ? new Prisma.Decimal(parsed.data.amount) : undefined
      let updatedId = existing.id

      if (parsed.data.action === "schedule") {
        const updated = await tx.makeupEntitlement.update({
          where: { id: existing.id },
          data: {
            status: "SCHEDULED",
            scheduledFor: new Date(parsed.data.scheduledFor as string),
            note: parsed.data.note ?? existing.note
          }
        })
        updatedId = updated.id
      }

      if (parsed.data.action === "complete") {
        const updated = await tx.makeupEntitlement.update({
          where: { id: existing.id },
          data: {
            status: "COMPLETED",
            resolvedAt: now,
            resolvedById: session.user.id,
            note: parsed.data.note ?? existing.note
          }
        })
        updatedId = updated.id
      }

      if (parsed.data.action === "credit") {
        await tx.studentWalletEntry.create({
          data: {
            studentId: existing.studentId,
            amount: amount as Prisma.Decimal,
            type: "CREDIT",
            makeupEntitlementId: existing.id,
            note: parsed.data.note ?? `Credit từ quyền học bù ${existing.month}`,
            createdById: session.user.id
          }
        })

        const updated = await tx.makeupEntitlement.update({
          where: { id: existing.id },
          data: {
            status: "CREDITED",
            resolvedAmount: amount,
            resolvedAt: now,
            resolvedById: session.user.id,
            note: parsed.data.note ?? existing.note
          }
        })
        updatedId = updated.id
      }

      if (parsed.data.action === "refund") {
        const code = await nextExpenseCode(tx, now)
        const expense = await tx.expense.create({
          data: {
            code,
            category: "OTHER",
            amount: amount as Prisma.Decimal,
            description: parsed.data.note ?? `Hoàn tiền quyền học bù cho ${existing.student.name}`,
            date: now,
            createdById: session.user.id,
            refundEntitlementId: existing.id,
            refundStudentId: existing.studentId
          }
        })

        const updated = await tx.makeupEntitlement.update({
          where: { id: existing.id },
          data: {
            status: "REFUNDED",
            resolvedAmount: amount,
            resolvedAt: now,
            resolvedById: session.user.id,
            note: parsed.data.note ?? existing.note
          }
        })
        updatedId = updated.id

        await notifyUsers(tx, {
          recipientIds: await getActiveStaffRecipientIds(tx, ["ADMIN"]),
          actorId: session.user.id,
          title: `Refund mới ${expense.code}`,
          body: `${existing.student.name} - ${expense.amount.toString()}đ`,
          href: "/finance",
          type: "FINANCE"
        })
      }

      if (parsed.data.action === "expire" || parsed.data.action === "reject") {
        const updated = await tx.makeupEntitlement.update({
          where: { id: existing.id },
          data: {
            status: parsed.data.action === "expire" ? "EXPIRED" : "REJECTED",
            isEligible: parsed.data.action === "reject" ? false : existing.isEligible,
            eligibilityReason: parsed.data.action === "reject" ? parsed.data.note ?? existing.eligibilityReason : existing.eligibilityReason,
            resolvedAt: now,
            resolvedById: session.user.id,
            note: parsed.data.note ?? existing.note
          }
        })
        updatedId = updated.id
      }

      const updated = await tx.makeupEntitlement.findUniqueOrThrow({
        where: { id: updatedId },
        include: makeupEntitlementInclude
      })

      await createAuditLog(tx, {
        actorId: session.user.id,
        action: `makeup_entitlement.${parsed.data.action}`,
        entityType: "MakeupEntitlement",
        entityId: updated.id,
        summary: `Cập nhật quyền học bù của ${updated.student.name}: ${updated.status}`,
        metadata: {
          status: updated.status,
          amount: updated.resolvedAmount?.toString(),
          note: parsed.data.note
        }
      })

      return updated
    })

    if (!entitlement) {
      return fail({ code: "MAKEUP_ENTITLEMENT_NOT_FOUND", message: "Không tìm thấy quyền học bù." }, { status: 404 })
    }

    return ok(toMakeupEntitlementItem(entitlement))
  } catch (error) {
    if (error instanceof Error && error.message === "TEACHER_FORBIDDEN") {
      return fail({ code: "FORBIDDEN", message: "Giáo viên chỉ được cập nhật lớp mình phụ trách." }, { status: 403 })
    }

    if (error instanceof Error && error.message === "MAKEUP_ENTITLEMENT_RESOLVED") {
      return fail({ code: "MAKEUP_ENTITLEMENT_RESOLVED", message: "Quyền học bù này đã được xử lý xong." }, { status: 409 })
    }

    if (error instanceof Error && error.message === "MAKEUP_ENTITLEMENT_NOT_ELIGIBLE") {
      return fail({ code: "MAKEUP_ENTITLEMENT_NOT_ELIGIBLE", message: "Quyền học bù này không đủ điều kiện xử lý." }, { status: 400 })
    }

    throw error
  }
}
