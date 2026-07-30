import { fail, ok } from "@/lib/api-response"
import { requireRoutePermission } from "@/lib/backend/api-route"
import { parseMonth } from "@/lib/backend/date"
import { createOtherIncomeReceipt } from "@/lib/modules/finance/application/create-other-income-receipt"
import { otherIncomeReceiptInclude, toOtherIncomeReceiptItem } from "@/lib/modules/finance/other-income-receipt-item"
import { prisma } from "@/lib/prisma"
import { otherIncomeReceiptCreateSchema, otherIncomeReceiptListQuerySchema } from "@/lib/validations/finance"

export async function GET(request: Request) {
  const authorization = await requireRoutePermission({
    permissions: ["finance:view_summary", "finance:view_own"],
    forbiddenMessage: "Bạn không có quyền xem phiếu thu khác."
  })
  if (authorization instanceof Response) return authorization

  const { searchParams } = new URL(request.url)
  const parsed = otherIncomeReceiptListQuerySchema.safeParse(Object.fromEntries(searchParams))

  if (!parsed.success) {
    return fail({ code: "INVALID_QUERY", message: "Bộ lọc phiếu thu khác không hợp lệ." }, { status: 400 })
  }

  const range = parsed.data.month ? parseMonth(parsed.data.month) : null
  const receipts = await prisma.otherIncomeReceipt.findMany({
    where: {
      ...(range ? { createdAt: { gte: range.start, lt: range.end } } : {}),
      ...(authorization.user.role === "SALE" ? { createdById: authorization.user.id } : {})
    },
    include: otherIncomeReceiptInclude,
    orderBy: { createdAt: "desc" }
  })

  return ok(receipts.map(toOtherIncomeReceiptItem))
}

export async function POST(request: Request) {
  const authorization = await requireRoutePermission({
    permissions: ["receipts:create"],
    forbiddenMessage: "Bạn không có quyền tạo phiếu thu khác."
  })
  if (authorization instanceof Response) return authorization

  const parsed = otherIncomeReceiptCreateSchema.safeParse(await request.json())

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Thông tin phiếu thu khác không hợp lệ." }, { status: 400 })
  }

  const receipt = await createOtherIncomeReceipt({
    prisma,
    data: parsed.data,
    createdById: authorization.user.id
  })

  return ok(toOtherIncomeReceiptItem(receipt), { status: 201 })
}
