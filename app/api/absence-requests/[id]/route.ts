import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { absenceRequestInclude, toAbsenceRequestItem } from "@/lib/backend/absence-request"
import { createAuditLog, getActiveStaffRecipientIds, notifyUsers } from "@/lib/backend/activity"
import { todayRange } from "@/lib/backend/date"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { absenceRequestUpdateSchema } from "@/lib/validations/absence-request"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "attendance:mark")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền duyệt yêu cầu xin nghỉ." }, { status: 403 })
  }

  const body = await request.json()
  const parsed = absenceRequestUpdateSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Thông tin duyệt xin nghỉ không hợp lệ." }, { status: 400 })
  }

  const { id } = await context.params

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.absenceRequest.findUnique({
        where: { id },
        include: {
          student: { include: { enrollments: true } },
          classSession: { include: { class: true } }
        }
      })

      if (!existing) {
        return null
      }

      if (session.user.role === "TEACHER" && existing.classSession.class.teacherId !== session.user.id) {
        throw new Error("TEACHER_FORBIDDEN")
      }

      const absenceRequest = await tx.absenceRequest.update({
        where: { id },
        data: {
          status: parsed.data.status,
          adminNote: parsed.data.adminNote,
          reviewedById: session.user.id,
          reviewedAt: new Date()
        },
        include: absenceRequestInclude
      })

      if (parsed.data.status === "APPROVED") {
        const enrollment = existing.student.enrollments.find((item) => item.courseId === existing.classSession.class.courseId && item.isActive)

        if (enrollment) {
          const range = todayRange(existing.classSession.date)
          const existingAttendance = await tx.attendance.findFirst({
            where: {
              enrollmentId: enrollment.id,
              date: {
                gte: range.start,
                lte: range.end
              }
            }
          })

          if (existingAttendance) {
            await tx.attendance.update({
              where: { id: existingAttendance.id },
              data: {
                classSessionId: existing.classSessionId,
                status: "ABSENT_EXCUSED",
                note: `Phụ huynh xin nghỉ: ${existing.reason}`,
                markedById: session.user.id
              }
            })
          } else {
            await tx.attendance.create({
              data: {
                enrollmentId: enrollment.id,
                classSessionId: existing.classSessionId,
                date: existing.classSession.date,
                status: "ABSENT_EXCUSED",
                note: `Phụ huynh xin nghỉ: ${existing.reason}`,
                markedById: session.user.id
              }
            })
          }
        }
      }

      await createAuditLog(tx, {
        actorId: session.user.id,
        action: "absence_request.review",
        entityType: "AbsenceRequest",
        entityId: absenceRequest.id,
        summary: `${parsed.data.status === "APPROVED" ? "Duyệt" : "Từ chối"} xin nghỉ cho ${existing.student.name}`,
        metadata: {
          status: parsed.data.status,
          classSessionId: existing.classSessionId,
          adminNote: parsed.data.adminNote
        }
      })

      await notifyUsers(tx, {
        recipientIds: await getActiveStaffRecipientIds(tx, ["ADMIN"]),
        actorId: session.user.id,
        title: "Yêu cầu xin nghỉ đã được xử lý",
        body: `${existing.student.name} - ${parsed.data.status}`,
        href: "/classes",
        type: "ABSENCE_REQUEST"
      })

      return absenceRequest
    })

    if (!updated) {
      return fail({ code: "ABSENCE_REQUEST_NOT_FOUND", message: "Không tìm thấy yêu cầu xin nghỉ." }, { status: 404 })
    }

    return ok(toAbsenceRequestItem(updated))
  } catch (error) {
    if (error instanceof Error && error.message === "TEACHER_FORBIDDEN") {
      return fail({ code: "FORBIDDEN", message: "Giáo viên chỉ được duyệt lớp mình phụ trách." }, { status: 403 })
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return fail({ code: "ABSENCE_REQUEST_NOT_FOUND", message: "Không tìm thấy yêu cầu xin nghỉ." }, { status: 404 })
    }

    throw error
  }
}
