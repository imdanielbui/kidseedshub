import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { can } from "@/lib/permissions"
import { otherIncomeReceiptInclude, toOtherIncomeReceiptItem } from "@/lib/modules/finance/other-income-receipt-item"
import { prisma } from "@/lib/prisma"

function toVietnameseMoneyText(value: { toFixed: (digits: number) => string }) {
  const amount = Number(value.toFixed(0))
  if (!Number.isFinite(amount) || amount <= 0) return "Không đồng"

  return `${new Intl.NumberFormat("vi-VN").format(amount)} đồng`
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  if (!can(session.user.role, "finance:view_summary") && !can(session.user.role, "finance:view_own")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền xem phiếu thu khác." }, { status: 403 })
  }

  const { id } = await params
  const receipt = await prisma.otherIncomeReceipt.findFirst({
    where: {
      id,
      ...(session.user.role === "SALE" ? { createdById: session.user.id } : {})
    },
    include: otherIncomeReceiptInclude
  })

  if (!receipt) return fail({ code: "NOT_FOUND", message: "Không tìm thấy phiếu thu khác." }, { status: 404 })

  return ok({
    ...toOtherIncomeReceiptItem(receipt),
    centerName: "Kid Seeds Hub",
    branchName: "Trung tâm Hạt Giống Nhỏ",
    amountInWords: toVietnameseMoneyText(receipt.amount)
  })
}
