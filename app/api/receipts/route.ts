import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { parseMonth } from "@/lib/backend/date"
import { billingPeriodWhere } from "@/lib/backend/receipt-billing"
import { createReceipt } from "@/lib/modules/finance/application/create-receipt"
import { receiptCreationErrorCodes, receiptCreationErrorFromUnknown } from "@/lib/modules/finance/application/receipt-errors"
import { receiptListInclude, toReceiptListItem } from "@/lib/modules/finance/receipt-list-item"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { receiptCreateSchema, receiptListQuerySchema } from "@/lib/validations/finance"

export async function GET(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "finance:view_summary") && !can(session.user.role, "finance:view_own")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền xem phiếu thu." }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const parsed = receiptListQuerySchema.safeParse(Object.fromEntries(searchParams))

  if (!parsed.success) {
    return fail({ code: "INVALID_QUERY", message: "Bộ lọc phiếu thu không hợp lệ." }, { status: 400 })
  }

	  const range = parsed.data.month ? parseMonth(parsed.data.month) : null
	  const billingWhere = billingPeriodWhere(parsed.data.billingMonth)
	  const receipts = await prisma.receipt.findMany({
	    where: {
	      ...(range ? { createdAt: { gte: range.start, lt: range.end } } : {}),
	      ...(billingWhere ? { lines: { some: billingWhere } } : {}),
	      ...(parsed.data.studentId
        ? {
            OR: [
              { enrollment: { studentId: parsed.data.studentId } },
              { lines: { some: { enrollment: { studentId: parsed.data.studentId } } } }
            ]
          }
        : {}),
      ...(session.user.role === "SALE" ? { createdById: session.user.id } : {})
    },
    include: receiptListInclude,
    orderBy: { createdAt: "desc" }
  })

  return ok(receipts.map(toReceiptListItem))
}

export async function POST(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "receipts:create")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền tạo phiếu thu." }, { status: 403 })
  }

  const body = await request.json()
  const parsed = receiptCreateSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Thông tin phiếu thu không hợp lệ." }, { status: 400 })
  }

  const data = parsed.data

  if (data.walletCreditAmount > 0 && !can(session.user.role, "wallet:apply_credit")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền áp dụng credit ví học viên." }, { status: 403 })
  }

  try {
    const receipt = await createReceipt({
      prisma,
      data,
      createdById: session.user.id
    })

    return ok(toReceiptListItem(receipt), { status: 201 })
  } catch (error) {
    const receiptError = receiptCreationErrorFromUnknown(error)

    if (receiptError?.code === receiptCreationErrorCodes.enrollmentNotFound) {
      return fail({ code: "ENROLLMENT_NOT_FOUND", message: "Không tìm thấy khóa đã đăng ký để tạo phiếu thu." }, { status: 404 })
    }

    if (receiptError?.code === receiptCreationErrorCodes.studentMismatch) {
      return fail({ code: "STUDENT_MISMATCH", message: "Khóa đã đăng ký không thuộc học viên này." }, { status: 400 })
    }

    if (receiptError?.code === receiptCreationErrorCodes.multiStudentReceipt) {
      return fail({ code: "MULTI_STUDENT_RECEIPT", message: "Một phiếu thu chỉ được tạo cho một học viên." }, { status: 400 })
    }

    if (receiptError?.code === receiptCreationErrorCodes.noPayableSessions) {
      return fail({ code: "NO_PAYABLE_SESSIONS", message: "Không có buổi tính phí sau học thử. Hãy kiểm tra lại số buổi học thử hoặc nhập số tiền cần thu nếu đây là ngoại lệ." }, { status: 400 })
    }

    if (receiptError?.code === receiptCreationErrorCodes.invalidBillingPeriod) {
      return fail({ code: "INVALID_BILLING_PERIOD", message: "Kỳ thu học phí không hợp lệ." }, { status: 400 })
    }

    if (receiptError?.code === receiptCreationErrorCodes.walletCreditExceedsBalance) {
      return fail({ code: "WALLET_CREDIT_EXCEEDS_BALANCE", message: "Credit áp dụng vượt quá số dư ví học viên." }, { status: 400 })
    }

    if (receiptError?.code === receiptCreationErrorCodes.walletCreditExceedsAmount) {
      return fail({ code: "WALLET_CREDIT_EXCEEDS_AMOUNT", message: "Credit áp dụng không được vượt quá số tiền phiếu thu." }, { status: 400 })
    }

    throw error
  }
}
