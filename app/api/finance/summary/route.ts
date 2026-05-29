import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { parseMonth } from "@/lib/backend/date"
import type { FinanceSummary } from "@/lib/contracts/finance"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { financeSummaryQuerySchema } from "@/lib/validations/finance"

function getGroupCount(count: true | { _all?: number } | undefined) {
  return typeof count === "object" ? count._all ?? 0 : 0
}

export async function GET(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "finance:view_summary")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền xem dashboard tài chính." }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const parsed = financeSummaryQuerySchema.safeParse(Object.fromEntries(searchParams))

  if (!parsed.success) {
    return fail({ code: "INVALID_QUERY", message: "Tháng báo cáo không hợp lệ." }, { status: 400 })
  }

  const range = parseMonth(parsed.data.month)
  const [receiptSum, expenseSum, receiptsByMethod, expensesByCategory] = await prisma.$transaction([
    prisma.receipt.aggregate({
      where: { createdAt: { gte: range.start, lt: range.end } },
      _sum: { amount: true },
      _count: true
    }),
    prisma.expense.aggregate({
      where: { date: { gte: range.start, lt: range.end } },
      _sum: { amount: true },
      _count: true
    }),
    prisma.receipt.groupBy({
      by: ["method"],
      where: { createdAt: { gte: range.start, lt: range.end } },
      orderBy: { method: "asc" },
      _sum: { amount: true },
      _count: { _all: true }
    }),
    prisma.expense.groupBy({
      by: ["category"],
      where: { date: { gte: range.start, lt: range.end } },
      orderBy: { category: "asc" },
      _sum: { amount: true },
      _count: { _all: true }
    })
  ])

  const revenue = receiptSum._sum.amount ?? new Prisma.Decimal(0)
  const expense = expenseSum._sum.amount ?? new Prisma.Decimal(0)

  const summary: FinanceSummary = {
    month: parsed.data.month,
    revenue: revenue.toString(),
    expense: expense.toString(),
    profit: revenue.minus(expense).toString(),
    receiptCount: receiptSum._count,
    expenseCount: expenseSum._count,
    receiptsByMethod: receiptsByMethod.map((row) => ({
      method: row.method,
      amount: (row._sum?.amount ?? new Prisma.Decimal(0)).toString(),
      count: getGroupCount(row._count)
    })),
    expensesByCategory: expensesByCategory.map((row) => ({
      category: row.category,
      amount: (row._sum?.amount ?? new Prisma.Decimal(0)).toString(),
      count: getGroupCount(row._count)
    }))
  }

  return ok(summary)
}
