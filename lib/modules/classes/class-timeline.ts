import { Prisma } from "@prisma/client"
import { dateKey } from "@/lib/backend/class-schedule"
import type { ClassTimelineAttendanceState, ClassTimelineItem } from "@/lib/contracts/classes"
import type { Role } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

const classTimelineInclude = Prisma.validator<Prisma.ClassInclude>()({
  course: { select: { name: true, subject: true } },
  teacher: { select: { name: true } },
  students: {
    where: { isActive: true },
    select: {
      studentId: true,
      joinedAt: true,
      student: {
        select: {
          code: true,
          name: true,
          parent: { select: { user: { select: { name: true, phone: true } } } }
        }
      }
    }
  },
  sessions: {
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    select: {
      id: true,
      date: true,
      startTime: true,
      endTime: true,
      room: true,
      status: true,
      attendances: {
        select: {
          id: true,
          status: true,
          note: true,
          markedBy: { select: { name: true } },
          enrollment: {
            select: {
              student: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  parent: { select: { user: { select: { name: true, phone: true } } } }
                }
              }
            }
          }
        }
      }
    }
  }
})

type ClassTimelineRecord = Prisma.ClassGetPayload<{ include: typeof classTimelineInclude }>

export function getClassTimelineAttendanceState(input: {
  sessionDate: Date
  sessionStatus: "SCHEDULED" | "CANCELED" | "COMPLETED"
  attendanceMarked: number
  attendanceExpected: number
  now?: Date
}): ClassTimelineAttendanceState {
  if (input.sessionStatus === "CANCELED") return "CANCELED"
  if (dateKey(input.sessionDate) > dateKey(input.now ?? new Date())) return "UPCOMING"
  if (input.attendanceMarked === 0) return "PENDING"
  if (input.attendanceExpected === 0 || input.attendanceMarked >= input.attendanceExpected) return "COMPLETE"
  return "PARTIAL"
}

function toClassTimelineItem(klass: ClassTimelineRecord): ClassTimelineItem {
  const sessions = klass.sessions.map((session, index) => {
    const attendanceByStudentId = new Map(
      session.attendances.map((attendance) => [attendance.enrollment.student.id, attendance])
    )
    const roster = new Map(
      klass.students
        .filter((classStudent) => classStudent.joinedAt <= session.date)
        .map((classStudent) => [classStudent.studentId, {
          studentId: classStudent.studentId,
          studentCode: classStudent.student.code,
          studentName: classStudent.student.name,
          parentName: classStudent.student.parent.user.name,
          parentPhone: classStudent.student.parent.user.phone
        }])
    )

    for (const attendance of session.attendances) {
      const student = attendance.enrollment.student
      if (!roster.has(student.id)) {
        roster.set(student.id, {
          studentId: student.id,
          studentCode: student.code,
          studentName: student.name,
          parentName: student.parent.user.name,
          parentPhone: student.parent.user.phone
        })
      }
    }

    const students = [...roster.values()]
      .map((student) => {
        const attendance = attendanceByStudentId.get(student.studentId)
        return {
          ...student,
          attendanceId: attendance?.id,
          attendanceStatus: attendance?.status,
          attendanceNote: attendance?.note ?? undefined,
          markedByName: attendance?.markedBy.name
        }
      })
      .sort((first, second) => first.studentName.localeCompare(second.studentName, "vi"))
    const attendanceMarked = attendanceByStudentId.size

    return {
      id: session.id,
      sessionNumber: index + 1,
      date: dateKey(session.date),
      startTime: session.startTime ?? klass.startTime,
      endTime: session.endTime ?? klass.endTime,
      room: session.room ?? klass.room ?? undefined,
      status: session.status,
      attendanceState: getClassTimelineAttendanceState({
        sessionDate: session.date,
        sessionStatus: session.status,
        attendanceMarked,
        attendanceExpected: students.length
      }),
      attendanceMarked,
      attendanceExpected: students.length,
      students
    }
  })

  return {
    id: klass.id,
    code: klass.code ?? undefined,
    name: klass.name,
    courseName: klass.course.name,
    subject: klass.course.subject,
    teacherName: klass.teacher.name,
    startDate: klass.startDate ? dateKey(klass.startDate) : sessions[0]?.date,
    endDate: sessions.at(-1)?.date,
    plannedSessions: klass.plannedSessions ?? undefined,
    activeStudentCount: klass.students.length,
    sessions
  }
}

export async function getClassTimeline(input: { classId: string; viewerId: string; role: Role }) {
  const klass = await prisma.class.findFirst({
    where: {
      id: input.classId,
      ...(input.role === "TEACHER"
        ? {
            OR: [
              { teacherId: input.viewerId },
              { sessions: { some: { substituteTeacherId: input.viewerId } } }
            ]
          }
        : {})
    },
    include: classTimelineInclude
  })

  return klass ? toClassTimelineItem(klass) : null
}
