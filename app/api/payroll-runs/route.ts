import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/backend/activity"
import { parseMonth } from "@/lib/backend/date"
import { payrollRunInclude, toPayrollRunItem } from "@/lib/backend/payroll"
import { prisma } from "@/lib/prisma"
import { payrollRunCreateSchema, payrollRunListQuerySchema } from "@/lib/validations/payroll"

function canManagePayroll(role: string) {
  return role === "ADMIN"
}

export async function GET(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!canManagePayroll(session.user.role)) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền xem payroll." }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const parsed = payrollRunListQuerySchema.safeParse(Object.fromEntries(searchParams))

  if (!parsed.success) {
    return fail({ code: "INVALID_QUERY", message: "Bộ lọc payroll không hợp lệ." }, { status: 400 })
  }

  const runs = await prisma.payrollRun.findMany({
    where: {
      ...(parsed.data.month ? { month: parsed.data.month } : {}),
      ...(parsed.data.status ? { status: parsed.data.status } : {})
    },
    include: payrollRunInclude,
    orderBy: [{ month: "desc" }, { createdAt: "desc" }]
  })

  return ok(runs.map(toPayrollRunItem))
}

export async function POST(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!canManagePayroll(session.user.role)) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền tạo payroll." }, { status: 403 })
  }

  const body = await request.json()
  const parsed = payrollRunCreateSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Thông tin kỳ payroll không hợp lệ." }, { status: 400 })
  }

  parseMonth(parsed.data.month)

  try {
    const run = await prisma.$transaction(async (tx) => {
      const created = await tx.payrollRun.create({
        data: {
          month: parsed.data.month,
          generatedById: session.user.id
        },
        include: payrollRunInclude
      })

      await createAuditLog(tx, {
        actorId: session.user.id,
        action: "payroll_run.create",
        entityType: "PayrollRun",
        entityId: created.id,
        summary: `Tạo payroll ${created.month}`,
        metadata: {
          month: created.month
        }
      })

      return created
    })

    return ok(toPayrollRunItem(run), { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail({ code: "DUPLICATE_PAYROLL_RUN", message: "Kỳ payroll này đã tồn tại." }, { status: 409 })
    }

    throw error
  }
}
