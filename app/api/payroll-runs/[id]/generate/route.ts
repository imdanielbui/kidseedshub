import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/backend/activity"
import { generatePayrollLines, payrollRunInclude, toPayrollRunItem } from "@/lib/backend/payroll"
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
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền sinh payroll." }, { status: 403 })
  }

  const { id } = await context.params

  try {
    const generated = await prisma.$transaction(async (tx) => {
      const existing = await tx.payrollRun.findUnique({
        where: { id }
      })

      if (!existing) {
        return null
      }

      if (existing.status !== "DRAFT") {
        throw new Error("PAYROLL_RUN_LOCKED")
      }

      const result = await generatePayrollLines(tx, existing)
      const run = await tx.payrollRun.findUniqueOrThrow({
        where: { id },
        include: payrollRunInclude
      })

      await createAuditLog(tx, {
        actorId: session.user.id,
        action: "payroll_run.generate",
        entityType: "PayrollRun",
        entityId: run.id,
        summary: `Sinh ${result.count} dòng payroll ${run.month}`,
        metadata: {
          month: run.month,
          lineCount: result.count
        }
      })

      return run
    })

    if (!generated) {
      return fail({ code: "PAYROLL_RUN_NOT_FOUND", message: "Không tìm thấy kỳ payroll." }, { status: 404 })
    }

    return ok(toPayrollRunItem(generated))
  } catch (error) {
    if (error instanceof Error && error.message === "PAYROLL_RUN_LOCKED") {
      return fail({ code: "PAYROLL_RUN_LOCKED", message: "Payroll đã duyệt/chi không thể sinh lại." }, { status: 409 })
    }

    throw error
  }
}
