import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/backend/activity"
import {
  ensureMakeupEntitlementForExcusedAttendance,
  makeupEntitlementInclude,
  toMakeupEntitlementItem
} from "@/lib/backend/makeup-entitlement"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { makeupEntitlementCreateSchema, makeupEntitlementListQuerySchema } from "@/lib/validations/makeup-entitlement"

export async function GET(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  const isStaff = can(session.user.role, "makeup:manage")
  const isParent = can(session.user.role, "portal:view_child")

  if (!isStaff && !isParent) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền xem quyền học bù." }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const parsed = makeupEntitlementListQuerySchema.safeParse(Object.fromEntries(searchParams))

  if (!parsed.success) {
    return fail({ code: "INVALID_QUERY", message: "Bộ lọc quyền học bù không hợp lệ." }, { status: 400 })
  }

  const where: Prisma.MakeupEntitlementWhereInput = {
    ...(parsed.data.studentId ? { studentId: parsed.data.studentId } : {}),
    ...(parsed.data.status ? { status: parsed.data.status } : {}),
    ...(parsed.data.month ? { month: parsed.data.month } : {}),
    ...(session.user.role === "PARENT" ? { student: { parent: { userId: session.user.id } } } : {}),
    ...(session.user.role === "TEACHER" ? { classSession: { class: { teacherId: session.user.id } } } : {})
  }

  const entitlements = await prisma.makeupEntitlement.findMany({
    where,
    include: makeupEntitlementInclude,
    orderBy: [{ month: "desc" }, { createdAt: "desc" }]
  })

  return ok(entitlements.map(toMakeupEntitlementItem))
}

export async function POST(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "makeup:manage")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền tạo quyền học bù." }, { status: 403 })
  }

  const body = await request.json()
  const parsed = makeupEntitlementCreateSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Thông tin quyền học bù không hợp lệ." }, { status: 400 })
  }

  try {
    const entitlement = await prisma.$transaction(async (tx) => {
      const attendance = await tx.attendance.findUnique({
        where: { id: parsed.data.attendanceId },
        include: {
          enrollment: { include: { student: true } },
          classSession: { include: { class: true } }
        }
      })

      if (!attendance || attendance.status !== "ABSENT_EXCUSED") {
        throw new Error("ATTENDANCE_NOT_ELIGIBLE")
      }

      if (session.user.role === "TEACHER" && attendance.classSession?.class.teacherId !== session.user.id) {
        throw new Error("TEACHER_FORBIDDEN")
      }

      const saved = await ensureMakeupEntitlementForExcusedAttendance(tx, {
        attendanceId: attendance.id,
        studentId: attendance.enrollment.studentId,
        enrollmentId: attendance.enrollmentId,
        classSessionId: attendance.classSessionId,
        sessionDate: attendance.classSession?.date ?? attendance.date,
        scheduledFor: attendance.makeupDate,
        actorId: session.user.id,
        overrideEligibility: parsed.data.overrideEligibility,
        eligibilityReason: parsed.data.eligibilityReason,
        note: parsed.data.note
      })

      await createAuditLog(tx, {
        actorId: session.user.id,
        action: "makeup_entitlement.create",
        entityType: "MakeupEntitlement",
        entityId: saved.id,
        summary: `Tạo quyền học bù cho ${saved.student.name}`,
        metadata: {
          attendanceId: attendance.id,
          status: saved.status,
          isEligible: saved.isEligible
        }
      })

      return saved
    })

    return ok(toMakeupEntitlementItem(entitlement), { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === "ATTENDANCE_NOT_ELIGIBLE") {
      return fail({ code: "ATTENDANCE_NOT_ELIGIBLE", message: "Điểm danh này không phải nghỉ có phép." }, { status: 400 })
    }

    if (error instanceof Error && error.message === "TEACHER_FORBIDDEN") {
      return fail({ code: "FORBIDDEN", message: "Giáo viên chỉ được tạo quyền học bù cho lớp mình phụ trách." }, { status: 403 })
    }

    throw error
  }
}
