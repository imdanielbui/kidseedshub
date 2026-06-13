import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import type { QueuedTuitionReminder, TuitionReminderItem } from "@/lib/contracts/reminders"
import { billingMonthLabel, billingMonthRange, countBillingPeriodSessions } from "@/lib/backend/receipt-billing"
import { renderZaloTemplate, zaloTemplates } from "@/lib/message-templates"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { tuitionReminderQuerySchema, tuitionReminderQueueSchema } from "@/lib/validations/reminder"

function getTemplate(templateId: string) {
  return zaloTemplates.find((template) => template.id === templateId) ?? zaloTemplates[0]
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 0,
    style: "currency",
    currency: "VND"
  }).format(Number.isFinite(value) ? value : 0)
}

async function toReminderItem(enrollment: {
  id: string
  studentId: string
  courseId: string
  startDate: Date | null
  sessionsBought: number
  sessionsUsed: number
  receiptLines: Array<{ billableSessions: number; billingPeriodStart: Date | null }>
  receipts: Array<{ createdAt: Date }>
  course: { name: string; price: Prisma.Decimal; totalSessions: number }
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
}, templateId: TuitionReminderItem["templateId"], billingMonth?: string): Promise<TuitionReminderItem> {
  const sessionsRemaining = Math.max(0, enrollment.sessionsBought - enrollment.sessionsUsed)
  const template = getTemplate(templateId)
  const baseMessage = renderZaloTemplate(template, {
    parentName: enrollment.student.parent.user.name,
    studentName: enrollment.student.name,
    courseName: enrollment.course.name,
    sessionsRemaining
  })
  const billingRange = billingMonth ? billingMonthRange(billingMonth) : undefined
  const billingSessions = billingRange
    ? await countBillingPeriodSessions(prisma, enrollment, billingRange)
    : undefined
  const billedSessionsInMonth = billingRange
    ? enrollment.receiptLines
        .filter((line) => line.billingPeriodStart && line.billingPeriodStart >= billingRange.start && line.billingPeriodStart < billingRange.end)
        .reduce((total, line) => total + line.billableSessions, 0)
    : undefined
  const billableSessionsDue = billingSessions === undefined ? undefined : Math.max(0, billingSessions - (billedSessionsInMonth ?? 0))
  const unitPrice = enrollment.course.totalSessions > 0 ? Number(enrollment.course.price) / enrollment.course.totalSessions : 0
  const expectedAmount = billableSessionsDue === undefined ? undefined : unitPrice * billableSessionsDue
  const billingLabel = billingMonth ? billingMonthLabel(billingMonth) : undefined
  const monthlyNote = billingLabel && billableSessionsDue !== undefined
    ? `\nKỳ thu: ${billingLabel}. Cần thu ${billableSessionsDue} buổi, dự kiến ${formatMoney(expectedAmount ?? 0)}.`
    : ""

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
    billingMonth,
    billingLabel,
    billableSessionsDue,
    billedSessionsInMonth,
    expectedAmount: expectedAmount === undefined ? undefined : String(Math.round(expectedAmount)),
    lastReceiptAt: enrollment.receipts[0]?.createdAt.toISOString(),
    templateId,
    message: `${baseMessage}${monthlyNote}`
  }
}

async function getReminderItems(threshold: number, templateId: TuitionReminderItem["templateId"], billingMonth?: string) {
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
      },
      receiptLines: true
    },
    orderBy: { updatedAt: "desc" }
  })

  const items = await Promise.all(enrollments.map((enrollment) => toReminderItem(enrollment, templateId, billingMonth)))

  return items
    .filter((item) => billingMonth ? (item.billableSessionsDue ?? 0) > 0 : item.sessionsBought - item.sessionsUsed <= threshold)
    .sort((first, second) => billingMonth ? (second.billableSessionsDue ?? 0) - (first.billableSessionsDue ?? 0) : first.sessionsRemaining - second.sessionsRemaining)
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

  return ok(await getReminderItems(parsed.data.threshold, parsed.data.templateId, parsed.data.billingMonth))
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
      },
      receiptLines: true
    }
  })

  if (!enrollment) {
    return fail({ code: "ENROLLMENT_NOT_FOUND", message: "Không tìm thấy enrollment cần nhắc học phí." }, { status: 404 })
  }

  const reminder = await toReminderItem(enrollment, parsed.data.templateId, parsed.data.billingMonth)
  const dueDate = new Date()
  dueDate.setHours(18, 0, 0, 0)

  const task = await prisma.task.create({
    data: {
      title: parsed.data.billingMonth ? `Nhắc học phí ${parsed.data.billingMonth}: ${reminder.studentName}` : `Nhắc học phí: ${reminder.studentName}`,
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
