import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import type { QueuedTuitionReminder, TuitionReminderItem } from "@/lib/contracts/reminders"
import { renderZaloTemplate, zaloTemplates } from "@/lib/message-templates"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { tuitionReminderQuerySchema, tuitionReminderQueueSchema } from "@/lib/validations/reminder"

function getTemplate(templateId: string) {
  return zaloTemplates.find((template) => template.id === templateId) ?? zaloTemplates[0]
}

function toReminderItem(enrollment: {
  id: string
  sessionsBought: number
  sessionsUsed: number
  receipts: Array<{ createdAt: Date }>
  course: { name: string }
  student: {
    id: string
    name: string
    parent: {
      user: {
        name: string
        phone: string
      }
    }
  }
}, templateId: TuitionReminderItem["templateId"]): TuitionReminderItem {
  const sessionsRemaining = Math.max(0, enrollment.sessionsBought - enrollment.sessionsUsed)
  const template = getTemplate(templateId)
  const message = renderZaloTemplate(template, {
    parentName: enrollment.student.parent.user.name,
    studentName: enrollment.student.name,
    courseName: enrollment.course.name,
    sessionsRemaining
  })

  return {
    enrollmentId: enrollment.id,
    studentId: enrollment.student.id,
    studentName: enrollment.student.name,
    parentName: enrollment.student.parent.user.name,
    parentPhone: enrollment.student.parent.user.phone,
    courseName: enrollment.course.name,
    sessionsBought: enrollment.sessionsBought,
    sessionsUsed: enrollment.sessionsUsed,
    sessionsRemaining,
    lastReceiptAt: enrollment.receipts[0]?.createdAt.toISOString(),
    templateId,
    message
  }
}

async function getReminderItems(threshold: number, templateId: TuitionReminderItem["templateId"]) {
  const enrollments = await prisma.enrollment.findMany({
    where: { isActive: true },
    include: {
      course: true,
      student: {
        include: {
          parent: { include: { user: true } }
        }
      },
      receipts: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    },
    orderBy: { updatedAt: "desc" }
  })

  return enrollments
    .filter((enrollment) => enrollment.sessionsBought - enrollment.sessionsUsed <= threshold)
    .map((enrollment) => toReminderItem(enrollment, templateId))
    .sort((first, second) => first.sessionsRemaining - second.sessionsRemaining)
}

export async function GET(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "tasks:manage")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền xem nhắc học phí." }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const parsed = tuitionReminderQuerySchema.safeParse(Object.fromEntries(searchParams))

  if (!parsed.success) {
    return fail({ code: "INVALID_QUERY", message: "Bộ lọc nhắc học phí không hợp lệ." }, { status: 400 })
  }

  return ok(await getReminderItems(parsed.data.threshold, parsed.data.templateId))
}

export async function POST(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "tasks:manage")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền tạo nhắc học phí." }, { status: 403 })
  }

  const body = await request.json()
  const parsed = tuitionReminderQueueSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Thông tin nhắc học phí không hợp lệ." }, { status: 400 })
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: parsed.data.enrollmentId },
    include: {
      course: true,
      student: {
        include: {
          parent: { include: { user: true } }
        }
      },
      receipts: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  })

  if (!enrollment) {
    return fail({ code: "ENROLLMENT_NOT_FOUND", message: "Không tìm thấy enrollment cần nhắc học phí." }, { status: 404 })
  }

  const reminder = toReminderItem(enrollment, parsed.data.templateId)
  const dueDate = new Date()
  dueDate.setHours(18, 0, 0, 0)

  const task = await prisma.task.create({
    data: {
      title: `Nhắc học phí: ${reminder.studentName}`,
      note: reminder.message,
      dueDate,
      studentId: reminder.studentId,
      assignedToId: session.user.id,
      createdById: session.user.id
    }
  })

  const result: QueuedTuitionReminder = {
    taskId: task.id,
    enrollmentId: reminder.enrollmentId,
    studentId: reminder.studentId,
    message: reminder.message
  }

  return ok(result, { status: 201 })
}
