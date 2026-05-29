import { z } from "zod"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/backend/activity"
import { todayRange } from "@/lib/backend/date"
import type { AttendanceMarkResult } from "@/lib/contracts/classes"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

const qrAttendanceSchema = z.object({
  qrCode: z.string().min(1),
  classSessionId: z.string().min(1).optional(),
  date: z.string().datetime().optional(),
  note: z.string().max(1000).optional()
})

function parseQrCode(value: string) {
  const trimmed = value.trim()
  const prefixed = trimmed.match(/^KSH:ENROLLMENT:([a-z0-9]+)$/i)
  return prefixed?.[1] ?? trimmed
}

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
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền điểm danh QR." }, { status: 403 })
  }

  const body = await request.json()
  const parsed = qrAttendanceSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Mã QR điểm danh không hợp lệ." }, { status: 400 })
  }

  const enrollmentId = parseQrCode(parsed.data.qrCode)
  const date = parsed.data.date ? new Date(parsed.data.date) : new Date()

  try {
    const attendance = await prisma.$transaction(async (tx) => {
    const enrollment = await tx.enrollment.findFirst({
      where: {
        id: enrollmentId,
        isActive: true
      },
      include: { student: true, course: true }
    })

    if (!enrollment) {
      throw new Error("ENROLLMENT_NOT_FOUND")
    }

    const range = todayRange(date)
    const existingAttendance = await tx.attendance.findFirst({
      where: {
        enrollmentId,
        date: {
          gte: range.start,
          lte: range.end
        }
      }
    })
    const previousCharged = existingAttendance ? isSessionCharged(existingAttendance.status) : false

    const created = existingAttendance
      ? await tx.attendance.update({
          where: { id: existingAttendance.id },
          data: {
            classSessionId: parsed.data.classSessionId,
            status: "PRESENT",
            note: parsed.data.note ?? "QR attendance",
            markedById: session.user.id
          },
          include: {
            enrollment: { include: { student: true } },
            markedBy: true
          }
        })
      : await tx.attendance.create({
          data: {
            enrollmentId,
            classSessionId: parsed.data.classSessionId,
            date,
            status: "PRESENT",
            note: parsed.data.note ?? "QR attendance",
            markedById: session.user.id
          },
          include: {
            enrollment: { include: { student: true } },
            markedBy: true
          }
        })

    if (!previousCharged) {
      const nextSessionsUsed = Math.max(0, enrollment.sessionsUsed + 1)
      await tx.enrollment.update({
        where: { id: enrollment.id },
        data: {
          sessionsUsed: nextSessionsUsed,
          isActive: nextSessionsUsed < enrollment.sessionsBought
        }
      })
    }

    await createAuditLog(tx, {
      actorId: session.user.id,
      action: "attendance.qr_mark",
      entityType: "Attendance",
      entityId: created.id,
      summary: `QR điểm danh ${enrollment.student.name}`,
      metadata: {
        enrollmentId,
        studentId: enrollment.studentId,
        classSessionId: parsed.data.classSessionId
      }
    })

    return tx.attendance.findUniqueOrThrow({
      where: { id: created.id },
      include: {
        enrollment: { include: { student: true } },
        markedBy: true
      }
    })
    })

    return ok(toAttendanceMarkResult(attendance), { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === "ENROLLMENT_NOT_FOUND") {
      return fail({ code: "QR_ENROLLMENT_NOT_FOUND", message: "Không tìm thấy enrollment active từ mã QR." }, { status: 404 })
    }

    throw error
  }
}
