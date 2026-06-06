import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { todayRange } from "@/lib/backend/date"
import type { TodayClassItem } from "@/lib/contracts/classes"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "attendance:mark")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền xem lớp hôm nay." }, { status: 403 })
  }

  const range = todayRange()
  const sessions = await prisma.classSession.findMany({
    where: {
      date: {
        gte: range.start,
        lte: range.end
      },
      status: { not: "CANCELED" },
      class: {
        isActive: true,
        ...(session.user.role === "TEACHER" ? { teacherId: session.user.id } : {})
      }
    },
    include: {
      _count: { select: { photos: true } },
      class: {
        include: {
          course: true,
          teacher: true,
          students: {
            where: { isActive: true },
            include: {
              student: {
                include: {
                  parent: { include: { user: true } },
                  enrollments: {
                    where: { isActive: true },
                    include: {
                      course: true,
                      attendances: {
                        where: {
                          date: {
                            gte: range.start,
                            lte: range.end
                          }
                        },
                        include: {
                          photos: true
                        },
                        orderBy: { updatedAt: "desc" },
                        take: 1
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }]
  })

  const payload: TodayClassItem[] = sessions.map((classSession) => {
    const klass = classSession.class

    return {
      id: klass.id,
      sessionId: classSession.id,
      name: klass.name,
      courseName: klass.course.name,
      subject: klass.course.subject,
      teacherName: klass.teacher.name,
      startTime: classSession.startTime ?? klass.startTime,
      endTime: classSession.endTime ?? klass.endTime,
      room: classSession.room ?? klass.room ?? undefined,
      photoCount: classSession._count.photos,
      students: klass.students.map(({ student }) => {
        const enrollment = student.enrollments.find((item) => item.courseId === klass.courseId) ?? student.enrollments[0]
        const attendance = enrollment?.attendances[0]

        return {
          studentId: student.id,
          studentName: student.name,
          parentName: student.parent.user.name,
          parentPhone: student.parent.user.phone,
          healthNote: student.healthNote ?? undefined,
          enrollmentId: enrollment?.id,
          attendanceId: attendance?.id,
          sessionsRemaining: enrollment ? Math.max(0, enrollment.sessionsBought - enrollment.sessionsUsed) : 0,
          attendanceStatus: attendance?.status,
          attendanceNote: attendance?.note ?? undefined,
          photoCount: attendance?.photos.length ?? 0
        }
      })
    }
  })

  if (payload.length) {
    return ok(payload)
  }

  const weekday = new Date().getDay()
  const classes = await prisma.class.findMany({
    where: {
      weekday,
      isActive: true,
      ...(session.user.role === "TEACHER" ? { teacherId: session.user.id } : {})
    },
    include: {
      course: true,
      teacher: true,
      students: {
        where: { isActive: true },
        include: {
          student: {
            include: {
              parent: { include: { user: true } },
              enrollments: {
                where: { isActive: true },
                include: {
                  course: true,
                  attendances: {
                    where: {
                      date: {
                        gte: range.start,
                        lte: range.end
                      }
                    },
                    include: {
                      photos: true
                    },
                    orderBy: { updatedAt: "desc" },
                    take: 1
                  }
                }
              }
            }
          }
        }
      }
    },
    orderBy: { startTime: "asc" }
  })

  const fallbackPayload: TodayClassItem[] = classes.map((klass) => ({
    id: klass.id,
    name: klass.name,
    courseName: klass.course.name,
    subject: klass.course.subject,
    teacherName: klass.teacher.name,
    startTime: klass.startTime,
    endTime: klass.endTime,
    room: klass.room ?? undefined,
    photoCount: 0,
    students: klass.students.map(({ student }) => {
      const enrollment = student.enrollments.find((item) => item.courseId === klass.courseId) ?? student.enrollments[0]
      const attendance = enrollment?.attendances[0]

      return {
        studentId: student.id,
        studentName: student.name,
        parentName: student.parent.user.name,
        parentPhone: student.parent.user.phone,
        healthNote: student.healthNote ?? undefined,
        enrollmentId: enrollment?.id,
        attendanceId: attendance?.id,
        sessionsRemaining: enrollment ? Math.max(0, enrollment.sessionsBought - enrollment.sessionsUsed) : 0,
        attendanceStatus: attendance?.status,
        attendanceNote: attendance?.note ?? undefined,
        photoCount: attendance?.photos.length ?? 0
      }
    })
  }))

  return ok(fallbackPayload)
}
