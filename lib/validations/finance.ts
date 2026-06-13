import { z } from "zod"

export const paymentMethods = ["CASH", "BANK_TRANSFER"] as const
export const expenseCategories = ["SALARY", "MATERIALS", "UTILITIES", "MARKETING", "OTHER"] as const
export const receiptExtraLineTypes = ["TUTORING", "OTHER"] as const

const receiptLineCreateSchema = z.object({
  enrollmentId: z.string().min(1),
  amount: z.number().min(0).optional(),
  billableSessions: z.number().int().min(0).max(200).optional(),
  freeTrialSessions: z.number().int().min(0).max(200).default(0),
  paidSessionsBeforeReceipt: z.number().int().min(0).max(200).default(0),
  discountInput: z.string().trim().max(64).optional(),
  extraDiscountInput: z.string().trim().max(64).optional(),
  billingPeriodStart: z.string().datetime().optional(),
  billingPeriodEnd: z.string().datetime().optional(),
  billingLabel: z.string().trim().max(64).optional()
})

const receiptExtraLineCreateSchema = z.object({
  type: z.enum(receiptExtraLineTypes).default("TUTORING"),
  description: z.string().trim().min(1).max(255),
  quantity: z.number().positive().max(1000),
  unitPrice: z.number().positive().max(1_000_000_000),
  note: z.string().trim().max(1000).optional()
})

export const receiptCreateSchema = z.object({
  studentId: z.string().min(1).optional(),
  enrollmentId: z.string().min(1).optional(),
  amount: z.number().min(0).optional(),
  grossAmount: z.number().positive().optional(),
  sessions: z.number().int().min(0).max(200).optional(),
  billableSessions: z.number().int().min(0).max(200).optional(),
  freeTrialSessions: z.number().int().min(0).max(200).default(0),
  paidSessionsBeforeReceipt: z.number().int().min(0).max(200).default(0),
  discountAmount: z.number().min(0).default(0),
  discountPercent: z.number().min(0).max(100).default(0),
  walletCreditAmount: z.number().min(0).default(0),
  discountInput: z.string().trim().max(64).optional(),
  extraDiscountInput: z.string().trim().max(64).optional(),
  lines: z.array(receiptLineCreateSchema).min(1).max(10).optional(),
  extraLines: z.array(receiptExtraLineCreateSchema).max(10).optional(),
  method: z.enum(paymentMethods),
  note: z.string().max(1000).optional()
}).refine((data) => Boolean(data.lines?.length) || Boolean(data.enrollmentId), {
  message: "Cần chọn ít nhất một khóa đã đăng ký.",
  path: ["lines"]
}).refine((data) => Boolean(data.lines?.length) || data.sessions !== undefined || data.billableSessions !== undefined, {
  message: "Cần nhập số buổi tính phí.",
  path: ["billableSessions"]
})

export const receiptListQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  billingMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  studentId: z.string().min(1).optional()
})

export const expenseCreateSchema = z.object({
  category: z.enum(expenseCategories),
  amount: z.number().positive(),
  description: z.string().min(1).max(1000),
  invoiceUrl: z.string().url().optional(),
  date: z.string().datetime(),
  refundEntitlementId: z.string().min(1).optional()
})

export const financeSummaryQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/)
})
