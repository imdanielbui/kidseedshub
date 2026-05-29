import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { todayRange } from "@/lib/backend/date"
import type { AttendanceMarkResult } from "@/lib/contracts/classes"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { attendanceCreateSchema } from "@/lib/validations/attendance"

function isSessionCharged(status: "PRESENT" | "ABSENT_EXCUSED" | "ABSENT_NO_EXCUSE") {
  return status === "PRESENT" || status === "ABSENT_NO_EXCUSE"
}

function toAttendanceMarkResult(attendance: {
  id: string
  enrollmentId: string
  date: Date
  status: AttendanceMarkResult["status"]
  note: string | null
  enrollment: {
    sessionsBought: number
    sessionsUsed: number
    student: { id: string; name: string }
  }
  markedBy: { name: string }
}): AttendanceMarkResult {
  return {
    id: attendance.id,
    enrollmentId: attendance.enrollmentId,
    studentId: attendance.enrollment.student.id,
    studentName: attendance.enrollment.student.name,
    status: attendance.status,
    note: attendance.note ?? undefined,
    date: attendance.date.toISOString(),
    sessionsBought: attendance.enrollment.sessionsBought,
    sessionsUsed: attendance.enrollment.sessionsUsed,
    sessionsRemaining: Math.max(0, attendance.enrollment.sessionsBought - attendance.enrollment.sessionsUsed),
    markedByName: attendance.markedBy.name
  }
}

export async function POST(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "attendance:mark")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền điểm danh." }, { status: 403 })
  }

  const body = await request.json()
  const parsed = attendanceCreateSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Thông tin điểm danh không hợp lệ." }, { status: 400 })
  }

  const data = parsed.data
  const attendance = await prisma.$transaction(async (tx) => {
    const date = new Date(data.date)
    const range = todayRange(date)
    const existingAttendance = await tx.attendance.findFirst({
      where: {
        enrollmentId: data.enrollmentId,
        date: {
          gte: range.start,
          lte: range.end
        }
      }
    })
    const previousCharged = existingAttendance ? isSessionCharged(existingAttendance.status) : false
    const nextCharged = isSessionCharged(data.status)

    const created = existingAttendance
      ? await tx.attendance.update({
          where: { id: existingAttendance.id },
          data: {
            classSessionId: data.classSessionId,
            status: data.status,
            note: data.note,
            makeupDate: data.makeupDate ? new Date(data.makeupDate) : null,
            markedById: session.user.id
          },
          include: {
            enrollment: { include: { student: true, course: true } },
            markedBy: true
          }
        })
      : await tx.attendance.create({
          data: {
            enrollmentId: data.enrollmentId,
            classSessionId: data.classSessionId,
            date,
            status: data.status,
            note: data.note,
            makeupDate: data.makeupDate ? new Date(data.makeupDate) : undefined,
            markedById: session.user.id
          },
          include: {
            enrollment: { include: { student: true, course: true } },
            markedBy: true
          }
        })

    const sessionDelta = Number(nextCharged) - Number(previousCharged)

    if (sessionDelta !== 0) {
      const enrollmentBeforeUpdate = await tx.enrollment.findUniqueOrThrow({
        where: { id: data.enrollmentId }
      })
      const sessionsUsed = Math.max(0, enrollmentBeforeUpdate.sessionsUsed + sessionDelta)
      const enrollment = await tx.enrollment.update({
        where: { id: enrollmentBeforeUpdate.id },
        data: {
          sessionsUsed,
          isActive: sessionsUsed < enrollmentBeforeUpdate.sessionsBought
        }
      })

      if (!enrollment.isActive) {
        const activeEnrollments = await tx.enrollment.count({
          where: {
            studentId: enrollment.studentId,
            isActive: true
          }
        })

        if (activeEnrollments === 0) {
          await tx.student.update({
            where: { id: enrollment.studentId },
            data: { status: "INACTIVE" }
          })
        }
      } else if (created.enrollment.student.status === "INACTIVE") {
        await tx.student.update({
          where: { id: enrollment.studentId },
          data: { status: "ACTIVE" }
        })
      }
    }

    return tx.attendance.findUniqueOrThrow({
      where: { id: created.id },
      include: {
        enrollment: { include: { student: true, course: true } },
        markedBy: true
      }
        })
  })

  return ok(toAttendanceMarkResult(attendance), { status: 201 })
}
