import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/backend/activity"
import { nextExpenseCode } from "@/lib/backend/codes"
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
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền chi payroll." }, { status: 403 })
  }

  const { id } = await context.params

  try {
    const paid = await prisma.$transaction(async (tx) => {
      const existing = await tx.payrollRun.findUnique({
        where: { id },
        include: {
          lines: true,
          salaryExpense: true
        }
      })

      if (!existing) {
        return null
      }

      if (existing.status !== "APPROVED") {
        throw new Error("PAYROLL_RUN_NOT_APPROVED")
      }

      if (existing.salaryExpense) {
        throw new Error("PAYROLL_RUN_ALREADY_PAID")
      }

      const totalFinalAmount = existing.lines.reduce((total, line) => total.plus(line.finalAmount), new Prisma.Decimal(0))

      if (totalFinalAmount.lessThanOrEqualTo(0)) {
        throw new Error("PAYROLL_RUN_EMPTY")
      }

      const now = new Date()
      const code = await nextExpenseCode(tx, now)

      const expense = await tx.expense.create({
        data: {
          code,
          category: "SALARY",
          amount: totalFinalAmount,
          description: `Chi lương payroll ${existing.month}`,
          date: now,
          createdById: session.user.id,
          payrollRunId: existing.id
        }
      })

      const run = await tx.payrollRun.update({
        where: { id },
        data: {
          status: "PAID",
          paidById: session.user.id,
          paidAt: now
        },
        include: payrollRunInclude
      })

      await createAuditLog(tx, {
        actorId: session.user.id,
        action: "payroll_run.pay",
        entityType: "PayrollRun",
        entityId: run.id,
        summary: `Chi payroll ${run.month} bằng phiếu chi ${expense.code}`,
        metadata: {
          month: run.month,
          expenseId: expense.id,
          expenseCode: expense.code,
          amount: totalFinalAmount.toString()
        }
      })

      return run
    })

    if (!paid) {
      return fail({ code: "PAYROLL_RUN_NOT_FOUND", message: "Không tìm thấy kỳ payroll." }, { status: 404 })
    }

    return ok(toPayrollRunItem(paid))
  } catch (error) {
    if (error instanceof Error && error.message === "PAYROLL_RUN_NOT_APPROVED") {
      return fail({ code: "PAYROLL_RUN_NOT_APPROVED", message: "Chỉ được chi payroll đã duyệt." }, { status: 409 })
    }

    if (error instanceof Error && error.message === "PAYROLL_RUN_ALREADY_PAID") {
      return fail({ code: "PAYROLL_RUN_ALREADY_PAID", message: "Payroll đã có phiếu chi lương." }, { status: 409 })
    }

    if (error instanceof Error && error.message === "PAYROLL_RUN_EMPTY") {
      return fail({ code: "PAYROLL_RUN_EMPTY", message: "Payroll chưa có số tiền cần chi." }, { status: 409 })
    }

    throw error
  }
}
