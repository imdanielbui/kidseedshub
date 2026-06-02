import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/backend/activity"
import { payrollRunInclude, recalculatePayrollLine, toPayrollRunItem } from "@/lib/backend/payroll"
import { prisma } from "@/lib/prisma"
import { payrollRunUpdateSchema } from "@/lib/validations/payroll"

type RouteContext = {
  params: Promise<{ id: string }>
}

function canManagePayroll(role: string) {
  return role === "ADMIN"
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!canManagePayroll(session.user.role)) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền xem payroll." }, { status: 403 })
  }

  const { id } = await context.params
  const run = await prisma.payrollRun.findUnique({
    where: { id },
    include: payrollRunInclude
  })

  if (!run) {
    return fail({ code: "PAYROLL_RUN_NOT_FOUND", message: "Không tìm thấy kỳ payroll." }, { status: 404 })
  }

  return ok(toPayrollRunItem(run))
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!canManagePayroll(session.user.role)) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền cập nhật payroll." }, { status: 403 })
  }

  const body = await request.json()
  const parsed = payrollRunUpdateSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Thông tin cập nhật payroll không hợp lệ." }, { status: 400 })
  }

  const { id } = await context.params

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.payrollRun.findUnique({
        where: { id },
        include: payrollRunInclude
      })

      if (!existing) {
        return null
      }

      if (existing.status !== "DRAFT") {
        throw new Error("PAYROLL_RUN_LOCKED")
      }

      if (parsed.data.lines?.length) {
        const existingLines = new Map(existing.lines.map((line) => [line.id, line]))

        for (const linePatch of parsed.data.lines) {
          const line = existingLines.get(linePatch.id)

          if (!line) {
            throw new Error("PAYROLL_LINE_NOT_FOUND")
          }

          const hoursWorked = linePatch.hoursWorked !== undefined ? new Prisma.Decimal(linePatch.hoursWorked) : line.hoursWorked
          const deductions = linePatch.deductions !== undefined ? new Prisma.Decimal(linePatch.deductions) : line.deductions
          const adjustments = linePatch.adjustments !== undefined ? new Prisma.Decimal(linePatch.adjustments) : line.adjustments
          const finalAmountOverride = linePatch.finalAmount !== undefined ? new Prisma.Decimal(linePatch.finalAmount) : undefined
          const { grossAmount, finalAmount } = recalculatePayrollLine({
            baseSalary: line.baseSalary,
            hourlyRate: line.hourlyRate,
            hoursWorked,
            deductions,
            adjustments,
            finalAmountOverride
          })

          await tx.payrollLine.update({
            where: { id: linePatch.id },
            data: {
              hoursWorked,
              deductions,
              adjustments,
              grossAmount,
              finalAmount,
              note: linePatch.note ?? line.note
            }
          })
        }
      }

      const run = await tx.payrollRun.update({
        where: { id },
        data: {
          status: parsed.data.status ?? existing.status
        },
        include: payrollRunInclude
      })

      await createAuditLog(tx, {
        actorId: session.user.id,
        action: "payroll_run.update",
        entityType: "PayrollRun",
        entityId: run.id,
        summary: `Cập nhật payroll ${run.month}`,
        metadata: {
          status: run.status,
          lineIds: parsed.data.lines?.map((line) => line.id)
        }
      })

      return run
    })

    if (!updated) {
      return fail({ code: "PAYROLL_RUN_NOT_FOUND", message: "Không tìm thấy kỳ payroll." }, { status: 404 })
    }

    return ok(toPayrollRunItem(updated))
  } catch (error) {
    if (error instanceof Error && error.message === "PAYROLL_RUN_LOCKED") {
      return fail({ code: "PAYROLL_RUN_LOCKED", message: "Payroll đã duyệt/chi không thể sửa trực tiếp." }, { status: 409 })
    }

    if (error instanceof Error && error.message === "PAYROLL_LINE_NOT_FOUND") {
      return fail({ code: "PAYROLL_LINE_NOT_FOUND", message: "Không tìm thấy dòng payroll trong kỳ này." }, { status: 404 })
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return fail({ code: "PAYROLL_RUN_NOT_FOUND", message: "Không tìm thấy kỳ payroll." }, { status: 404 })
    }

    throw error
  }
}
