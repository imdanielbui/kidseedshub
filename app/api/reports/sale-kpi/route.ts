import { z } from "zod"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { parseMonth } from "@/lib/backend/date"
import type { SaleKpiReport, SaleKpiRow } from "@/lib/contracts/reports"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

const saleKpiQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/)
})

function dayDiff(start: Date, end: Date) {
  const diff = end.getTime() - start.getTime()
  return Math.max(0, Math.round(diff / 86_400_000))
}

function getConversionRate(convertedCount: number, leadCount: number) {
  if (leadCount === 0) return 0
  return Math.round((convertedCount / leadCount) * 1000) / 10
}

export async function GET(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  const canViewAll = can(session.user.role, "reports:view_all")
  const canViewOwn = can(session.user.role, "reports:view_own_kpi")

  if (!canViewAll && !canViewOwn) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền xem KPI Sale." }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const parsed = saleKpiQuerySchema.safeParse(Object.fromEntries(searchParams))

  if (!parsed.success) {
    return fail({ code: "INVALID_QUERY", message: "Tháng báo cáo không hợp lệ." }, { status: 400 })
  }

  const range = parseMonth(parsed.data.month)
  const saleUsers = await prisma.user.findMany({
    where: canViewAll ? { role: "SALE" } : { id: session.user.id, role: "SALE" },
    orderBy: { name: "asc" }
  })
  const saleIds = saleUsers.map((user) => user.id)

  if (saleIds.length === 0) {
    return ok(emptyReport(parsed.data.month))
  }

  const [contactLogs, receipts, tasks] = await prisma.$transaction([
    prisma.contactLog.findMany({
      where: {
        loggedById: { in: saleIds },
        createdAt: { gte: range.start, lt: range.end }
      },
      select: {
        loggedById: true,
        studentId: true
      }
    }),
    prisma.receipt.findMany({
      where: {
        createdById: { in: saleIds },
        createdAt: { gte: range.start, lt: range.end }
      },
      include: {
        enrollment: {
          include: {
            student: true
          }
        }
      },
      orderBy: { createdAt: "asc" }
    }),
    prisma.task.findMany({
      where: {
        assignedToId: { in: saleIds },
        OR: [
          { dueDate: { gte: range.start, lt: range.end } },
          { completedAt: { gte: range.start, lt: range.end } }
        ]
      },
      select: {
        assignedToId: true,
        status: true,
        completedAt: true
      }
    })
  ])

  const rows: SaleKpiRow[] = saleUsers.map((user) => {
    const contactedStudentIds = new Set(
      contactLogs.filter((log) => log.loggedById === user.id).map((log) => log.studentId)
    )
    const userReceipts = receipts.filter((receipt) => receipt.createdById === user.id)
    const convertedStudentIds = new Set(userReceipts.map((receipt) => receipt.enrollment.studentId))
    const leadIds = new Set([...contactedStudentIds, ...convertedStudentIds])
    const revenue = userReceipts.reduce((total, receipt) => total + Number(receipt.amount), 0)
    const firstReceiptByStudent = new Map<string, (typeof userReceipts)[number]>()

    for (const receipt of userReceipts) {
      const studentId = receipt.enrollment.studentId
      if (!firstReceiptByStudent.has(studentId)) {
        firstReceiptByStudent.set(studentId, receipt)
      }
    }

    const daysToClose = Array.from(firstReceiptByStudent.values()).map((receipt) =>
      dayDiff(receipt.enrollment.student.createdAt, receipt.createdAt)
    )
    const userTasks = tasks.filter((task) => task.assignedToId === user.id)
    const openTaskCount = userTasks.filter((task) => task.status !== "DONE").length
    const doneTaskCount = userTasks.filter((task) => task.status === "DONE").length

    return {
      userId: user.id,
      saleName: user.name,
      leadCount: leadIds.size,
      convertedCount: convertedStudentIds.size,
      conversionRate: getConversionRate(convertedStudentIds.size, leadIds.size),
      revenue: String(revenue),
      receiptCount: userReceipts.length,
      averageDaysToClose:
        daysToClose.length > 0 ? Math.round((daysToClose.reduce((total, value) => total + value, 0) / daysToClose.length) * 10) / 10 : 0,
      openTaskCount,
      doneTaskCount
    }
  })

  const totalLeadIds = new Set<string>()
  const totalConvertedIds = new Set<string>()
  for (const log of contactLogs) totalLeadIds.add(log.studentId)
  for (const receipt of receipts) {
    totalLeadIds.add(receipt.enrollment.studentId)
    totalConvertedIds.add(receipt.enrollment.studentId)
  }

  const totals = {
    leadCount: totalLeadIds.size,
    convertedCount: totalConvertedIds.size,
    conversionRate: getConversionRate(totalConvertedIds.size, totalLeadIds.size),
    revenue: String(rows.reduce((total, row) => total + Number(row.revenue), 0)),
    receiptCount: rows.reduce((total, row) => total + row.receiptCount, 0),
    openTaskCount: rows.reduce((total, row) => total + row.openTaskCount, 0),
    doneTaskCount: rows.reduce((total, row) => total + row.doneTaskCount, 0)
  }

  const report: SaleKpiReport = {
    month: parsed.data.month,
    rows,
    totals
  }

  return ok(report)
}

function emptyReport(month: string): SaleKpiReport {
  return {
    month,
    rows: [],
    totals: {
      leadCount: 0,
      convertedCount: 0,
      conversionRate: 0,
      revenue: "0",
      receiptCount: 0,
      openTaskCount: 0,
      doneTaskCount: 0
    }
  }
}
