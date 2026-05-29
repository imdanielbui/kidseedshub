import { Prisma, StudentStatus } from "@prisma/client"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { parseMonth } from "@/lib/backend/date"
import type { AdvancedAnalyticsReport } from "@/lib/contracts/reports"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

const advancedAnalyticsQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/)
})

const convertedStatuses: StudentStatus[] = ["CONVERTED", "RETENTION", "ACTIVE", "GRADUATED"]

function getRate(part: number, total: number) {
  if (total === 0) return 0
  return Math.round((part / total) * 1000) / 10
}

export async function GET(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "reports:view_all")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền xem analytics nâng cao." }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const parsed = advancedAnalyticsQuerySchema.safeParse(Object.fromEntries(searchParams))

  if (!parsed.success) {
    return fail({ code: "INVALID_QUERY", message: "Tháng báo cáo không hợp lệ." }, { status: 400 })
  }

  const range = parseMonth(parsed.data.month)
  const [students, receipts, enrollments, classSessions, attendances, activeStudentCount, inactiveStudentCount] = await prisma.$transaction([
    prisma.student.findMany({
      select: {
        id: true,
        leadSource: true,
        status: true
      }
    }),
    prisma.receipt.findMany({
      where: { createdAt: { gte: range.start, lt: range.end } },
      include: {
        createdBy: true,
        enrollment: {
          include: {
            course: true
          }
        }
      }
    }),
    prisma.enrollment.findMany({
      where: { isActive: true },
      include: {
        course: true,
        receipts: true
      }
    }),
    prisma.classSession.findMany({
      where: { date: { gte: range.start, lt: range.end } },
      select: { status: true }
    }),
    prisma.attendance.findMany({
      where: { date: { gte: range.start, lt: range.end } },
      select: { status: true }
    }),
    prisma.student.count({ where: { status: { in: ["ACTIVE", "CONVERTED", "RETENTION"] } } }),
    prisma.student.count({ where: { status: "INACTIVE" } })
  ])

  const leadSourceMap = new Map<string, { leadCount: number; convertedCount: number }>()
  for (const student of students) {
    const source = student.leadSource?.trim() || "Không rõ"
    const current = leadSourceMap.get(source) ?? { leadCount: 0, convertedCount: 0 }
    current.leadCount += 1
    if (convertedStatuses.includes(student.status)) current.convertedCount += 1
    leadSourceMap.set(source, current)
  }

  const saleRevenueMap = new Map<string, { userId: string; saleName: string; revenue: Prisma.Decimal; receiptCount: number }>()
  for (const receipt of receipts) {
    const current =
      saleRevenueMap.get(receipt.createdById) ??
      {
        userId: receipt.createdById,
        saleName: receipt.createdBy.name,
        revenue: new Prisma.Decimal(0),
        receiptCount: 0
      }
    current.revenue = current.revenue.plus(receipt.amount)
    current.receiptCount += 1
    saleRevenueMap.set(receipt.createdById, current)
  }

  const retentionMap = new Map<string, { courseId: string; courseName: string; activeEnrollmentCount: number; renewedEnrollmentCount: number }>()
  let remainingSessionTotal = 0
  let lowSessionEnrollmentCount = 0
  let projectedRenewalRevenue = new Prisma.Decimal(0)

  for (const enrollment of enrollments) {
    const current =
      retentionMap.get(enrollment.courseId) ??
      {
        courseId: enrollment.courseId,
        courseName: enrollment.course.name,
        activeEnrollmentCount: 0,
        renewedEnrollmentCount: 0
      }
    const sessionsRemaining = Math.max(0, enrollment.sessionsBought - enrollment.sessionsUsed)
    current.activeEnrollmentCount += 1
    if (enrollment.receipts.length > 1) current.renewedEnrollmentCount += 1
    retentionMap.set(enrollment.courseId, current)

    remainingSessionTotal += sessionsRemaining
    if (sessionsRemaining <= 2) {
      lowSessionEnrollmentCount += 1
      projectedRenewalRevenue = projectedRenewalRevenue.plus(enrollment.course.price)
    }
  }

  const presentCount = attendances.filter((attendance) => attendance.status === "PRESENT").length
  const absentCount = attendances.filter((attendance) => attendance.status !== "PRESENT").length

  const report: AdvancedAnalyticsReport = {
    month: parsed.data.month,
    leadSources: Array.from(leadSourceMap.entries())
      .map(([source, row]) => ({
        source,
        leadCount: row.leadCount,
        convertedCount: row.convertedCount,
        conversionRate: getRate(row.convertedCount, row.leadCount)
      }))
      .sort((first, second) => second.leadCount - first.leadCount),
    saleRevenue: Array.from(saleRevenueMap.values())
      .map((row) => ({
        userId: row.userId,
        saleName: row.saleName,
        revenue: row.revenue.toString(),
        receiptCount: row.receiptCount
      }))
      .sort((first, second) => Number(second.revenue) - Number(first.revenue)),
    retention: Array.from(retentionMap.values())
      .map((row) => ({
        ...row,
        retentionRate: getRate(row.renewedEnrollmentCount, row.activeEnrollmentCount)
      }))
      .sort((first, second) => second.activeEnrollmentCount - first.activeEnrollmentCount),
    operations: {
      scheduledClassCount: classSessions.filter((item) => item.status === "SCHEDULED").length,
      completedClassCount: classSessions.filter((item) => item.status === "COMPLETED").length,
      activeStudentCount,
      inactiveStudentCount,
      presentCount,
      absentCount,
      absenceRate: getRate(absentCount, presentCount + absentCount)
    },
    forecast: {
      activeEnrollmentCount: enrollments.length,
      lowSessionEnrollmentCount,
      averageRemainingSessions: enrollments.length ? Math.round((remainingSessionTotal / enrollments.length) * 10) / 10 : 0,
      projectedRenewalRevenue: projectedRenewalRevenue.toString()
    }
  }

  return ok(report)
}
