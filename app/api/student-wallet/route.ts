import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/backend/activity"
import { studentWalletEntryInclude, toStudentWalletEntryItem } from "@/lib/backend/makeup-entitlement"
import type { StudentWalletSummary } from "@/lib/contracts/student-wallet"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { studentWalletCreateSchema, studentWalletQuerySchema } from "@/lib/validations/student-wallet"

export async function GET(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  const isStaff = can(session.user.role, "wallet:view")
  const isParent = can(session.user.role, "portal:view_child")

  if (!isStaff && !isParent) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền xem ví học viên." }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const parsed = studentWalletQuerySchema.safeParse(Object.fromEntries(searchParams))

  if (!parsed.success) {
    return fail({ code: "INVALID_QUERY", message: "Bộ lọc ví học viên không hợp lệ." }, { status: 400 })
  }

  if (isStaff && !parsed.data.studentId) {
    return fail({ code: "STUDENT_REQUIRED", message: "Cần chọn học viên để xem ví." }, { status: 400 })
  }

  const where: Prisma.StudentWalletEntryWhereInput = {
    ...(parsed.data.studentId ? { studentId: parsed.data.studentId } : {}),
    ...(session.user.role === "PARENT" ? { student: { parent: { userId: session.user.id } } } : {})
  }

  if (session.user.role === "PARENT" && parsed.data.studentId) {
    const child = await prisma.student.findFirst({
      where: {
        id: parsed.data.studentId,
        parent: { userId: session.user.id }
      },
      select: { id: true }
    })

    if (!child) {
      return fail({ code: "FORBIDDEN", message: "Phụ huynh chỉ được xem ví của con mình." }, { status: 403 })
    }
  }

  const [entries, balance] = await prisma.$transaction([
    prisma.studentWalletEntry.findMany({
      where,
      include: studentWalletEntryInclude,
      orderBy: { createdAt: "desc" },
      take: 100
    }),
    prisma.studentWalletEntry.aggregate({
      where,
      _sum: { amount: true }
    })
  ])

  const summary: StudentWalletSummary = {
    studentId: parsed.data.studentId,
    balance: (balance._sum.amount ?? new Prisma.Decimal(0)).toString(),
    entries: entries.map(toStudentWalletEntryItem)
  }

  return ok(summary)
}

export async function POST(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "wallet:apply_credit")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền ghi credit ví học viên." }, { status: 403 })
  }

  const body = await request.json()
  const parsed = studentWalletCreateSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Thông tin ghi credit không hợp lệ." }, { status: 400 })
  }

  try {
    const entry = await prisma.$transaction(async (tx) => {
      const student = await tx.student.findUnique({
        where: { id: parsed.data.studentId },
        select: { id: true, name: true }
      })

      if (!student) {
        throw new Error("STUDENT_NOT_FOUND")
      }

      const created = await tx.studentWalletEntry.create({
        data: {
          studentId: student.id,
          amount: parsed.data.amount,
          type: "CREDIT",
          note: parsed.data.note,
          createdById: session.user.id
        },
        include: studentWalletEntryInclude
      })

      await createAuditLog(tx, {
        actorId: session.user.id,
        action: "student_wallet.credit",
        entityType: "StudentWalletEntry",
        entityId: created.id,
        summary: `Ghi credit ví cho ${student.name}`,
        metadata: {
          studentId: student.id,
          amount: created.amount.toString()
        }
      })

      return created
    })

    return ok(toStudentWalletEntryItem(entry), { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === "STUDENT_NOT_FOUND") {
      return fail({ code: "STUDENT_NOT_FOUND", message: "Không tìm thấy học viên." }, { status: 404 })
    }

    throw error
  }
}
