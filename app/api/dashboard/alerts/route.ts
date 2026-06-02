import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import type { DashboardAlerts } from "@/lib/contracts/dashboard"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

const makeupDashboardStatuses = ["PENDING_SCHEDULE", "EXPIRED", "CREDITED", "REFUNDED"] as const

export async function GET() {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "students:view_all") && !can(session.user.role, "students:view_class")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền xem cảnh báo." }, { status: 403 })
  }

  const now = new Date()
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  const endOfToday = new Date(now)
  endOfToday.setHours(23, 59, 59, 999)

  const [activeEnrollments, staleTrialLeads, dueTasks, makeupStateAlerts] = await prisma.$transaction([
    prisma.enrollment.findMany({
      where: {
        isActive: true
      },
      include: {
        student: { include: { parent: { include: { user: true } } } },
        course: true,
        attendances: {
          orderBy: { date: "desc" },
          take: 1
        },
        receipts: {
          orderBy: { createdAt: "desc" },
          take: 1
        }
      },
      orderBy: { updatedAt: "asc" },
      take: 100
    }),
    prisma.student.findMany({
      where: {
        status: "TRIAL",
        stageChangedAt: { lt: threeDaysAgo },
        contactLogs: {
          none: {
            createdAt: { gte: threeDaysAgo }
          }
        }
      },
      include: {
        parent: { include: { user: true } }
      },
      orderBy: { updatedAt: "asc" },
      take: 20
    }),
    prisma.task.findMany({
      where: {
        status: "PENDING",
        dueDate: {
          gte: startOfToday,
          lte: endOfToday
        },
        ...(session.user.role === "SALE" ? { assignedToId: session.user.id } : {})
      },
      include: {
        student: true,
        assignedTo: true
      },
      orderBy: { dueDate: "asc" },
      take: 20
    }),
    prisma.makeupEntitlement.findMany({
      where: {
        status: { in: [...makeupDashboardStatuses] }
      },
      include: {
        student: true,
        enrollment: { include: { course: true } },
        walletEntries: true,
        refundExpense: true
      },
      orderBy: { updatedAt: "desc" },
      take: 20
    })
  ])

  const sessionsLow: DashboardAlerts["sessionsLow"] = activeEnrollments
    .filter((enrollment) => enrollment.sessionsBought - enrollment.sessionsUsed <= 2)
    .slice(0, 20)
    .map((enrollment) => ({
      enrollmentId: enrollment.id,
      studentName: enrollment.student.name,
      courseName: enrollment.course.name,
      sessionsRemaining: enrollment.sessionsBought - enrollment.sessionsUsed
    }))

  const debtWarnings: DashboardAlerts["debtWarnings"] = activeEnrollments
    .filter((enrollment) => {
      const sessionsRemaining = enrollment.sessionsBought - enrollment.sessionsUsed

      if (sessionsRemaining > 0) {
        return false
      }

      const latestReceipt = enrollment.receipts[0]
      const latestAttendance = enrollment.attendances[0]

      if (!latestReceipt) {
        return true
      }

      return latestAttendance ? latestReceipt.createdAt < latestAttendance.date : false
    })
    .slice(0, 20)
    .map((enrollment) => ({
      enrollmentId: enrollment.id,
      studentId: enrollment.studentId,
      studentName: enrollment.student.name,
      courseName: enrollment.course.name,
      sessionsRemaining: enrollment.sessionsBought - enrollment.sessionsUsed,
      latestAttendanceAt: enrollment.attendances[0]?.date.toISOString(),
      latestReceiptAt: enrollment.receipts[0]?.createdAt.toISOString()
    }))

  const alerts: DashboardAlerts = {
    sessionsLow,
    debtWarnings,
    staleTrialLeads: staleTrialLeads.map((student) => ({
      studentId: student.id,
      studentName: student.name,
      parentName: student.parent.user.name,
      phone: student.parent.user.phone,
      daysSinceUpdate: Math.max(0, Math.floor((now.getTime() - student.stageChangedAt.getTime()) / 86_400_000))
    })),
    dueTasks: dueTasks.map((task) => ({
      taskId: task.id,
      title: task.title,
      studentName: task.student?.name,
      dueDate: task.dueDate.toISOString()
    })),
    makeupStateAlerts: makeupStateAlerts.map((entitlement) => {
      const walletCreditAmount = entitlement.walletEntries.reduce(
        (total, entry) => total.plus(entry.amount),
        new Prisma.Decimal(0)
      )

      return {
        entitlementId: entitlement.id,
        studentId: entitlement.studentId,
        studentName: entitlement.student.name,
        courseName: entitlement.enrollment.course.name,
        status: entitlement.status,
        month: entitlement.month,
        scheduledFor: entitlement.scheduledFor?.toISOString(),
        resolvedAmount: entitlement.resolvedAmount?.toString(),
        walletCreditAmount: walletCreditAmount.toString(),
        refundExpenseCode: entitlement.refundExpense?.code,
        updatedAt: entitlement.updatedAt.toISOString()
      }
    })
  }

  return ok(alerts)
}
