import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/backend/activity"
import { payrollRunInclude, toPayrollRunItem } from "@/lib/backend/payroll"
import { prisma } from "@/lib/prisma"

type RouteContext = {
  params: Promise<{ id: string }>
}

function canManagePayroll(role: string) {
  return role === "ADMIN"
}

export async function POST(_request: Request, context: RouteContext) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!canManagePayroll(session.user.role)) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền duyệt payroll." }, { status: 403 })
  }

  const { id } = await context.params

  try {
    const approved = await prisma.$transaction(async (tx) => {
      const existing = await tx.payrollRun.findUnique({
        where: { id },
        include: { lines: true }
      })

      if (!existing) {
        return null
      }

      if (existing.status !== "DRAFT") {
        throw new Error("PAYROLL_RUN_LOCKED")
      }

      if (!existing.lines.length) {
        throw new Error("PAYROLL_RUN_EMPTY")
      }

      const run = await tx.payrollRun.update({
        where: { id },
        data: {
          status: "APPROVED",
          approvedById: session.user.id,
          approvedAt: new Date()
        },
        include: payrollRunInclude
      })

      await createAuditLog(tx, {
        actorId: session.user.id,
        action: "payroll_run.approve",
        entityType: "PayrollRun",
        entityId: run.id,
        summary: `Duyệt payroll ${run.month}`,
        metadata: {
          month: run.month,
          lineCount: run.lines.length
        }
      })

      return run
    })

    if (!approved) {
      return fail({ code: "PAYROLL_RUN_NOT_FOUND", message: "Không tìm thấy kỳ payroll." }, { status: 404 })
    }

    return ok(toPayrollRunItem(approved))
  } catch (error) {
    if (error instanceof Error && error.message === "PAYROLL_RUN_LOCKED") {
      return fail({ code: "PAYROLL_RUN_LOCKED", message: "Payroll không còn ở trạng thái nháp." }, { status: 409 })
    }

    if (error instanceof Error && error.message === "PAYROLL_RUN_EMPTY") {
      return fail({ code: "PAYROLL_RUN_EMPTY", message: "Payroll chưa có dòng lương để duyệt." }, { status: 409 })
    }

    throw error
  }
}
