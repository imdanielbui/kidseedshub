import { Prisma, type StudentStatus } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { parseMonth, todayRange } from "@/lib/backend/date"
import { pipelineStages, type PipelineStageCounts, type PipelineStageKey } from "@/lib/contracts/crm"
import type { DashboardOverview, DashboardOverviewFollowUp } from "@/lib/contracts/dashboard"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { dashboardOverviewQuerySchema } from "@/lib/validations/dashboard"

const pipelineStageKeys = pipelineStages.map((stage) => stage.key) as PipelineStageKey[]

function currentMonthKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

function emptyStageCounts(): PipelineStageCounts {
  return pipelineStages.reduce((counts, stage) => {
    counts[stage.key] = 0
    return counts
  }, {} as PipelineStageCounts)
}

function dayDiff(from: Date, to = new Date()) {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86_400_000))
}

function decimalOrZero(value: Prisma.Decimal | null | undefined) {
  return value ?? new Prisma.Decimal(0)
}

function studentScopeForRole(role: string, userId: string): Prisma.StudentWhereInput {
  if (role !== "SALE") return {}

  return {
    OR: [
      { saleOwnerId: userId },
      { createdById: userId }
    ]
  }
}

function classSessionScopeForRole(role: string, userId: string): Prisma.ClassSessionWhereInput {
  if (role !== "TEACHER") return {}

  return {
    OR: [
      { class: { teacherId: userId } },
      { substituteTeacherId: userId }
    ]
  }
}

export async function GET(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  const canViewStudents = can(session.user.role, "students:view_all") || can(session.user.role, "students:view_class")
  const canViewPipeline = can(session.user.role, "pipeline:manage")
  const canViewFinanceSummary = can(session.user.role, "finance:view_summary")
  const canViewOwnFinance = can(session.user.role, "finance:view_own")
  const canViewClasses = can(session.user.role, "attendance:mark") || can(session.user.role, "students:view_class")

  if (!canViewStudents && !canViewPipeline && !canViewFinanceSummary && !canViewOwnFinance && !canViewClasses) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền xem dashboard." }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const parsed = dashboardOverviewQuerySchema.safeParse(Object.fromEntries(searchParams))

  if (!parsed.success) {
    return fail({ code: "INVALID_QUERY", message: "Tháng dashboard không hợp lệ." }, { status: 400 })
  }

  const month = parsed.data.month ?? currentMonthKey()
  const monthRange = parseMonth(month)
  const now = new Date()
  const today = todayRange(now)
  const threeDaysAgo = new Date(now.getTime() - 3 * 86_400_000)
  const studentScope = studentScopeForRole(session.user.role, session.user.id)
  const classSessionScope = classSessionScopeForRole(session.user.role, session.user.id)

  const financePromise = canViewFinanceSummary || canViewOwnFinance
    ? prisma.$transaction([
        prisma.receipt.aggregate({
          where: {
            createdAt: { gte: monthRange.start, lt: monthRange.end },
            ...(canViewFinanceSummary ? {} : { createdById: session.user.id })
          },
          _sum: { amount: true },
          _count: true
        }),
        prisma.expense.aggregate({
          where: {
            date: { gte: monthRange.start, lt: monthRange.end },
            ...(canViewFinanceSummary ? {} : { id: "__dashboard_no_expense_scope__" })
          },
          _sum: { amount: true },
          _count: true
        }),
        prisma.receipt.findMany({
          where: {
            createdAt: { gte: monthRange.start, lt: monthRange.end },
            ...(canViewFinanceSummary ? {} : { createdById: session.user.id })
          },
          include: {
            enrollment: {
              include: {
                student: { include: { parent: { include: { user: true } } } }
              }
            }
          },
          orderBy: { createdAt: "desc" },
          take: 5
        })
      ])
    : Promise.resolve(null)

  const pipelinePromise = canViewPipeline
    ? prisma.$transaction([
        prisma.student.groupBy({
          by: ["status"],
          where: {
            ...studentScope,
            status: { in: pipelineStageKeys as StudentStatus[] }
          },
          orderBy: { status: "asc" },
          _count: { _all: true }
        }),
        prisma.student.count({
          where: {
            ...studentScope,
            status: "TRIAL",
            stageChangedAt: { lt: threeDaysAgo },
            contactLogs: { none: { createdAt: { gte: threeDaysAgo } } }
          }
        }),
        prisma.student.count({
          where: {
            ...studentScope,
            status: "CONVERTED",
            stageChangedAt: { gte: monthRange.start, lt: monthRange.end }
          }
        }),
        prisma.student.count({
          where: {
            ...studentScope,
            status: "LEAD",
            createdAt: { gte: monthRange.start, lt: monthRange.end }
          }
        })
      ])
    : Promise.resolve(null)

  const classPromise = prisma.$transaction([
    prisma.classSession.findMany({
      where: {
        ...classSessionScope,
        date: { gte: today.start, lte: today.end },
        status: { not: "CANCELED" },
        class: { isActive: true }
      },
      include: {
        attendances: { select: { id: true } },
        class: {
          include: {
            course: true,
            teacher: true,
            students: {
              where: { isActive: true },
              select: { id: true }
            }
          }
        }
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      take: 8
    }),
    prisma.class.count({
      where: {
        isActive: true,
        ...(session.user.role === "TEACHER" ? { teacherId: session.user.id } : {})
      }
    })
  ])

  const studentPromise = canViewStudents
    ? prisma.$transaction([
        session.user.role === "TEACHER"
          ? prisma.classStudent.count({
              where: {
                isActive: true,
                class: { teacherId: session.user.id, isActive: true },
                student: { status: "ACTIVE" }
              }
            })
          : prisma.student.count({
              where: {
                ...studentScope,
                status: "ACTIVE"
              }
            }),
        prisma.enrollment.findMany({
          where: {
            isActive: true,
            ...(session.user.role === "TEACHER"
              ? { student: { classStudents: { some: { isActive: true, class: { teacherId: session.user.id } } } } }
              : { student: studentScope })
          },
          include: {
            student: true,
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
          take: 120
        })
      ])
    : Promise.resolve(null)

  const dueTasksPromise = prisma.task.findMany({
    where: {
      status: "PENDING",
      dueDate: { lte: today.end },
      ...(session.user.role === "SALE" || session.user.role === "TEACHER" ? { assignedToId: session.user.id } : {})
    },
    include: { student: true },
    orderBy: { dueDate: "asc" },
    take: 8
  })
  const staleTrialLeadsPromise = canViewPipeline
    ? prisma.student.findMany({
        where: {
          ...studentScope,
          status: "TRIAL",
          stageChangedAt: { lt: threeDaysAgo },
          contactLogs: { none: { createdAt: { gte: threeDaysAgo } } }
        },
        include: { parent: { include: { user: true } } },
        orderBy: { stageChangedAt: "asc" },
        take: 6
      })
    : Promise.resolve([])

  const [financeResult, pipelineResult, classResult, studentResult, dueTasks, staleTrialLeads] = await Promise.all([
    financePromise,
    pipelinePromise,
    classPromise,
    studentPromise,
    dueTasksPromise,
    staleTrialLeadsPromise
  ])

  const finance = financeResult
    ? (() => {
        const [receiptAggregate, expenseAggregate, latestReceipts] = financeResult
        const revenue = decimalOrZero(receiptAggregate._sum.amount)
        const expense = canViewFinanceSummary ? decimalOrZero(expenseAggregate._sum.amount) : undefined
        const receiptCount = receiptAggregate._count

        return {
          scopeLabel: canViewFinanceSummary ? "Toàn trung tâm" : "Cá nhân sale",
          revenue: revenue.toString(),
          netRevenue: revenue.toString(),
          expense: expense?.toString(),
          profit: expense ? revenue.minus(expense).toString() : undefined,
          receiptCount,
          averageReceipt: receiptCount ? revenue.div(receiptCount).toString() : "0",
          latestReceipts: latestReceipts.map((receipt) => ({
            id: receipt.id,
            code: receipt.code,
            studentName: receipt.enrollment.student.name,
            parentName: receipt.enrollment.student.parent.user.name,
            amount: receipt.amount.toString(),
            createdAt: receipt.createdAt.toISOString()
          }))
        }
      })()
    : null

  const pipeline = pipelineResult
    ? (() => {
        const [groupedCounts, staleTrialCount, closedThisMonth, newLeadsThisMonth] = pipelineResult
        const stageCounts = emptyStageCounts()

        groupedCounts.forEach((row) => {
          stageCounts[row.status as PipelineStageKey] = typeof row._count === "object" ? row._count._all ?? 0 : 0
        })

        const engagedTotal = stageCounts.TRIAL + stageCounts.EVALUATION + stageCounts.CONVERTED

        return {
          scopeLabel: session.user.role === "SALE" ? "Pipeline cá nhân" : "Toàn pipeline",
          stageCounts,
          leadCount: stageCounts.LEAD,
          trialCount: stageCounts.TRIAL,
          evaluationCount: stageCounts.EVALUATION,
          convertedCount: stageCounts.CONVERTED,
          staleTrialCount,
          closedThisMonth,
          newLeadsThisMonth,
          conversionRate: engagedTotal ? Math.round((stageCounts.CONVERTED / engagedTotal) * 100) : 0
        }
      })()
    : null

  const [todaySessions, activeClassCount] = classResult
  const todayStudentSlots = todaySessions.reduce((total, item) => total + item.class.students.length, 0)
  const attendanceMarked = todaySessions.reduce((total, item) => total + item.attendances.length, 0)

  const [activeStudentCount, enrollmentsForWarnings] = studentResult ?? [0, []]
  const lowSessionEnrollments = enrollmentsForWarnings.filter((enrollment) => enrollment.sessionsBought - enrollment.sessionsUsed <= 2)
  const debtWarningEnrollments = enrollmentsForWarnings.filter((enrollment) => {
    const sessionsRemaining = enrollment.sessionsBought - enrollment.sessionsUsed

    if (sessionsRemaining > 0) return false

    const latestReceipt = enrollment.receipts[0]
    const latestAttendance = enrollment.attendances[0]

    if (!latestReceipt) return true
    return latestAttendance ? latestReceipt.createdAt < latestAttendance.date : false
  })
  const followUps: DashboardOverviewFollowUp[] = [
    ...staleTrialLeads.map((student) => ({
      id: `trial-${student.id}`,
      type: "TRIAL_STALE" as const,
      title: `Chốt học thử: ${student.name}`,
      detail: `${student.parent.user.name} - ${student.parent.user.phone} - ${dayDiff(student.stageChangedAt, now)} ngày chưa cập nhật`,
      href: `/students/${student.id}`,
      priority: "HIGH" as const,
      dueAt: student.stageChangedAt.toISOString()
    })),
    ...dueTasks.map((task) => ({
      id: `task-${task.id}`,
      type: "TASK_DUE" as const,
      title: task.title,
      detail: `${task.student?.name ? `${task.student.name} - ` : ""}đến hạn ${task.dueDate.toLocaleDateString("vi-VN")}`,
      href: task.studentId ? `/students/${task.studentId}` : undefined,
      priority: "MEDIUM" as const,
      dueAt: task.dueDate.toISOString()
    })),
    ...lowSessionEnrollments.slice(0, 4).map((enrollment) => ({
      id: `low-${enrollment.id}`,
      type: "LOW_SESSION" as const,
      title: `Sắp hết buổi: ${enrollment.student.name}`,
      detail: `${enrollment.course.name} còn ${enrollment.sessionsBought - enrollment.sessionsUsed} buổi`,
      href: `/students/${enrollment.studentId}`,
      priority: "MEDIUM" as const,
      dueAt: undefined
    })),
    ...debtWarningEnrollments.slice(0, 4).map((enrollment) => ({
      id: `debt-${enrollment.id}`,
      type: "DEBT" as const,
      title: `Cần thu phí: ${enrollment.student.name}`,
      detail: `${enrollment.course.name} đã hết buổi hoặc chưa có phiếu thu mới`,
      href: `/students/${enrollment.studentId}`,
      priority: "HIGH" as const,
      dueAt: undefined
    }))
  ]
    .sort((first, second) => {
      const priorityDelta = ({ HIGH: 0, MEDIUM: 1, LOW: 2 }[first.priority] - { HIGH: 0, MEDIUM: 1, LOW: 2 }[second.priority])
      return priorityDelta || (first.dueAt ?? "").localeCompare(second.dueAt ?? "")
    })
    .slice(0, 10)

  const overview: DashboardOverview = {
    month,
    generatedAt: now.toISOString(),
    finance,
    pipeline,
    classes: {
      scopeLabel: session.user.role === "TEACHER" ? "Lớp của tôi" : "Toàn trung tâm",
      activeClassCount,
      todaySessionCount: todaySessions.length,
      todayStudentSlots,
      attendanceMarked,
      attendanceRate: todayStudentSlots ? Math.round((attendanceMarked / todayStudentSlots) * 100) : 0,
      upcomingToday: todaySessions.map((classSession) => ({
        id: classSession.id,
        className: classSession.class.name,
        courseName: classSession.class.course.name,
        teacherName: classSession.substituteTeacherId ? "GV thay thế" : classSession.class.teacher.name,
        startTime: classSession.startTime ?? classSession.class.startTime,
        endTime: classSession.endTime ?? classSession.class.endTime,
        room: classSession.room ?? classSession.class.room ?? undefined,
        studentCount: classSession.class.students.length,
        attendanceMarked: classSession.attendances.length
      }))
    },
    students: {
      scopeLabel: session.user.role === "TEACHER" ? "Học viên lớp của tôi" : session.user.role === "SALE" ? "Học viên sale phụ trách" : "Toàn trung tâm",
      activeStudentCount,
      lowSessionCount: lowSessionEnrollments.length,
      debtWarningCount: debtWarningEnrollments.length
    },
    followUps
  }

  return ok(overview)
}
