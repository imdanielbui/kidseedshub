import { Prisma } from "@prisma/client"
import { toClassProgressSummary } from "@/lib/backend/class-progress"
import { toParentAccountInfo } from "@/lib/backend/parent-account"
import { taskInclude, toTaskItem } from "@/lib/backend/task-mapper"
import { assessmentStatusLabels } from "@/lib/contracts/assessment"
import { attendanceStatusLabels } from "@/lib/contracts/classes"
import type { StudentDetail } from "@/lib/contracts/students"
import { can, type Role } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

export const studentDetailInclude = Prisma.validator<Prisma.StudentInclude>()({
  parent: { include: { user: true } },
  assignedTeacher: true,
  saleOwner: true,
  createdBy: true,
  enrollments: {
    include: {
      course: true,
      attendances: {
        include: {
          classSession: {
            include: {
              class: {
                include: {
                  course: true
                }
              }
            }
          }
        },
        orderBy: { date: "desc" },
        take: 20
      },
      weeklyAssessments: {
        include: {
          items: true,
          teacher: true
        },
        orderBy: [
          { weekNumber: "desc" },
          { updatedAt: "desc" }
        ]
      },
      finalAssessments: {
        include: {
          teacher: true
        },
        orderBy: { createdAt: "desc" }
      }
    }
  },
  classStudents: {
    include: {
      class: {
        include: {
          course: true,
          teacher: true,
          sessions: {
            select: { date: true, status: true },
            orderBy: { date: "asc" }
          }
        }
      }
    }
  },
  enrollmentTransfers: {
    include: {
      fromEnrollment: { include: { course: true } },
      toEnrollment: { include: { course: true } },
      fromClass: true,
      toClass: true,
      createdBy: true
    },
    orderBy: { createdAt: "desc" },
    take: 20
  },
  photos: {
    include: {
      createdBy: { select: { name: true } },
      attendance: {
        include: {
          classSession: {
            include: {
              class: {
                include: { course: true }
              }
            }
          }
        }
      },
      classSession: {
        include: {
          class: {
            include: { course: true }
          }
        }
      }
    },
    orderBy: { takenAt: "desc" }
  },
  contactLogs: { include: { loggedBy: true }, orderBy: { createdAt: "desc" } },
  tasks: { include: taskInclude, orderBy: { dueDate: "asc" } }
})

export type StudentDetailRecord = Prisma.StudentGetPayload<{ include: typeof studentDetailInclude }>

export async function findStudentDetail(id: string) {
  return prisma.student.findUnique({
    where: { id },
    include: studentDetailInclude
  })
}

function toLearningTimeline(student: StudentDetailRecord): StudentDetail["learningTimeline"] {
  const items: StudentDetail["learningTimeline"] = []

  for (const enrollment of student.enrollments) {
    items.push({
      id: `course-${enrollment.id}`,
      type: "course",
      title: `Ghi danh ${enrollment.course.name}`,
      description: `Bắt đầu từ buổi ${enrollment.joinSessionNumber ?? 1}. Quỹ hiện có ${enrollment.sessionsBought} buổi, đã học ${enrollment.sessionsUsed} buổi.`,
      date: (enrollment.startDate ?? enrollment.createdAt).toISOString(),
      meta: enrollment.course.subject,
      subject: enrollment.course.subject
    })

    for (const attendance of enrollment.attendances) {
      const className = attendance.classSession?.class.name
      const topic = attendance.classSession?.topic
      const details = [
        className ? `Lớp ${className}` : undefined,
        topic,
        attendance.note ? `Ghi chú: ${attendance.note}` : undefined
      ].filter(Boolean).join(" · ")

      items.push({
        id: `attendance-${attendance.id}`,
        type: "attendance",
        title: `Điểm danh: ${attendanceStatusLabels[attendance.status]}`,
        description: details || undefined,
        date: attendance.date.toISOString(),
        meta: attendance.classSession?.class.course.name ?? enrollment.course.name,
        status: attendance.status,
        subject: enrollment.course.subject
      })
    }

    for (const assessment of enrollment.weeklyAssessments) {
      const checkedItems = assessment.items.filter((item) => item.checked).length
      const totalItems = assessment.items.length
      const details = [
        assessmentStatusLabels[assessment.status],
        `${checkedItems}/${totalItems} mục đã tick`,
        assessment.comment
      ].filter(Boolean).join(" · ")

      items.push({
        id: `weekly-${assessment.id}`,
        type: "weekly_assessment",
        title: `Đánh giá tuần ${assessment.weekNumber}`,
        description: details,
        date: assessment.updatedAt.toISOString(),
        meta: `${enrollment.course.name} · ${assessment.teacher.name}`,
        status: assessment.status,
        subject: assessment.subject
      })
    }

    for (const assessment of enrollment.finalAssessments) {
      items.push({
        id: `final-${assessment.id}`,
        type: "final_assessment",
        title: "Đánh giá cuối khóa",
        description: `${assessment.completedWeeks}/${assessment.requiredWeeks} tuần đủ điều kiện · ${assessment.teacherSummary}`,
        date: assessment.createdAt.toISOString(),
        meta: `${enrollment.course.name} · ${assessment.teacher.name}`,
        subject: assessment.subject
      })
    }
  }

  for (const photo of student.photos) {
    const className = photo.attendance?.classSession?.class.name ?? photo.classSession?.class.name
    const courseName = photo.attendance?.classSession?.class.course.name ?? photo.classSession?.class.course.name

    items.push({
      id: `photo-${photo.id}`,
      type: "photo",
      title: photo.isFeatured ? "Ảnh nổi bật" : "Ảnh buổi học",
      description: [photo.caption, className ? `Lớp ${className}` : undefined].filter(Boolean).join(" · ") || (photo.attendanceId ? "Gắn với một buổi điểm danh." : undefined),
      date: photo.takenAt.toISOString(),
      meta: courseName ?? "Album"
    })
  }

  return items
    .sort((first, second) => new Date(second.date).getTime() - new Date(first.date).getTime())
    .slice(0, 40)
}

function toAssessmentProgress(student: StudentDetailRecord): StudentDetail["assessmentProgress"] {
  return student.enrollments.map((enrollment) => {
    const subject = enrollment.course.subject
    const weeklyAssessments = enrollment.weeklyAssessments.filter((assessment) => assessment.subject === subject)
    const completedAssessments = weeklyAssessments.filter((assessment) => assessment.status === "COMPLETE")
    const latestWeek = weeklyAssessments.reduce<number | undefined>((latest, assessment) => {
      if (latest === undefined) return assessment.weekNumber
      return Math.max(latest, assessment.weekNumber)
    }, undefined)
    const checkedItems = weeklyAssessments.reduce((total, assessment) => total + assessment.items.filter((item) => item.checked).length, 0)
    const totalItems = weeklyAssessments.reduce((total, assessment) => total + assessment.items.length, 0)
    const finalAssessment = enrollment.finalAssessments.find((assessment) => assessment.subject === subject)

    return {
      enrollmentId: enrollment.id,
      courseName: enrollment.course.name,
      subject,
      completedWeeks: completedAssessments.length,
      totalWeeks: Math.max(0, enrollment.totalCourseSessionsAtJoin ?? enrollment.course.totalSessions),
      latestWeek,
      checkedItems,
      totalItems,
      finalAssessmentId: finalAssessment?.id,
      finalCreatedAt: finalAssessment?.createdAt.toISOString()
    }
  })
}

export function toStudentDetail(student: StudentDetailRecord, role: Role): StudentDetail {
  const activeClassByCourseId = new Map(
    student.classStudents
      .filter((classStudent) => classStudent.isActive && classStudent.class.isActive)
      .map((classStudent) => [classStudent.class.courseId, classStudent.class])
  )
  const courses = student.enrollments.map((enrollment) => ({
    enrollmentId: enrollment.id,
    classId: activeClassByCourseId.get(enrollment.courseId)?.id,
    className: activeClassByCourseId.get(enrollment.courseId)?.name,
    courseId: enrollment.courseId,
    courseName: enrollment.course.name,
    courseSubject: enrollment.course.subject,
    courseTotalSessions: enrollment.course.totalSessions,
    coursePrice: enrollment.course.price.toString(),
    sessionsBought: enrollment.sessionsBought,
    sessionsUsed: enrollment.sessionsUsed,
    sessionsRemaining: Math.max(0, enrollment.sessionsBought - enrollment.sessionsUsed),
    startDate: enrollment.startDate?.toISOString(),
    endDate: enrollment.endDate?.toISOString(),
    joinSessionNumber: enrollment.joinSessionNumber ?? undefined,
    totalCourseSessionsAtJoin: enrollment.totalCourseSessionsAtJoin ?? undefined,
    freeTrialSessions: enrollment.freeTrialSessions,
    paidSessionsBeforeReceipt: enrollment.paidSessionsBeforeReceipt,
    classProgress: activeClassByCourseId.get(enrollment.courseId)
      ? toClassProgressSummary(activeClassByCourseId.get(enrollment.courseId)!)
      : undefined,
    isActive: enrollment.isActive
  }))

  return {
    id: student.id,
    code: student.code,
    name: student.name,
    birthDate: student.birthDate?.toISOString(),
    status: student.status,
    gender: student.gender,
    address: student.address ?? undefined,
    parentName: student.parent.user.name,
    parentPhone: student.parent.user.phone,
    parentEmail: student.parent.user.email ?? undefined,
    parentAccount: toParentAccountInfo(student.parent.user),
    leadSource: student.leadSource ?? undefined,
    leadNote: student.leadNote ?? undefined,
    healthNote: student.healthNote ?? undefined,
    assignedTeacherName: student.assignedTeacher?.name,
    saleOwnerName: student.saleOwner?.name,
    createdByName: student.createdBy?.name,
    sessionsRemaining: courses.filter((course) => course.isActive).reduce((total, course) => total + course.sessionsRemaining, 0),
    courses,
    classes: student.classStudents.map(({ class: klass }) => ({
      id: klass.id,
      name: klass.name,
      courseName: klass.course.name,
      teacherName: klass.teacher.name,
      weekday: klass.weekday,
      startTime: klass.startTime,
      endTime: klass.endTime,
      progress: toClassProgressSummary(klass)
    })),
    enrollmentTransfers: student.enrollmentTransfers.map((transfer) => ({
      id: transfer.id,
      fromEnrollmentId: transfer.fromEnrollmentId,
      toEnrollmentId: transfer.toEnrollmentId ?? undefined,
      fromClassName: transfer.fromClass?.name,
      toClassName: transfer.toClass?.name,
      fromCourseName: transfer.fromEnrollment.course.name,
      toCourseName: transfer.toEnrollment?.course.name,
      remainingSessions: transfer.remainingSessions,
      creditAmount: transfer.creditAmount.toString(),
      reason: transfer.reason,
      createdByName: transfer.createdBy.name,
      createdAt: transfer.createdAt.toISOString()
    })),
    photos: student.photos.map((photo) => ({
      id: photo.id,
      studentId: photo.studentId ?? undefined,
      url: photo.url,
      caption: photo.caption ?? undefined,
      attendanceId: photo.attendanceId ?? undefined,
      classSessionId: photo.classSessionId ?? photo.attendance?.classSessionId ?? undefined,
      className: photo.attendance?.classSession?.class.name ?? photo.classSession?.class.name,
      courseName: photo.attendance?.classSession?.class.course.name ?? photo.classSession?.class.course.name,
      attendanceStatus: photo.attendance?.status,
      takenAt: photo.takenAt.toISOString(),
      isFeatured: photo.isFeatured,
      isPublished: photo.isPublished,
      sentToParentAt: photo.sentToParentAt?.toISOString(),
      createdByName: photo.createdBy?.name
    })),
    learningTimeline: toLearningTimeline(student),
    assessmentProgress: toAssessmentProgress(student),
    contactLogs: student.contactLogs.map((log) => ({
      id: log.id,
      content: log.content,
      result: log.result,
      loggedByName: log.loggedBy.name,
      createdAt: log.createdAt.toISOString()
    })),
    tasks: student.tasks.map(toTaskItem),
    permissions: {
      canPublishPhotos: can(role, "photos:publish")
    },
    createdAt: student.createdAt.toISOString(),
    updatedAt: student.updatedAt.toISOString()
  }
}
