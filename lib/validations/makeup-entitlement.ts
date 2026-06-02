import { z } from "zod"

export const makeupEntitlementStatuses = [
  "PENDING_SCHEDULE",
  "SCHEDULED",
  "COMPLETED",
  "CREDITED",
  "REFUNDED",
  "EXPIRED",
  "REJECTED"
] as const

export const makeupEntitlementListQuerySchema = z.object({
  studentId: z.string().min(1).optional(),
  status: z.enum(makeupEntitlementStatuses).optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional()
})

export const makeupEntitlementCreateSchema = z.object({
  attendanceId: z.string().min(1),
  overrideEligibility: z.boolean().default(false),
  eligibilityReason: z.string().trim().max(600).optional(),
  note: z.string().trim().max(1000).optional()
})

export const makeupEntitlementUpdateSchema = z.object({
  action: z.enum(["schedule", "complete", "credit", "refund", "expire", "reject"]),
  scheduledFor: z.string().datetime().optional(),
  amount: z.number().positive().optional(),
  note: z.string().trim().max(1000).optional()
}).superRefine((data, context) => {
  if (data.action === "schedule" && !data.scheduledFor) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Cần ngày học bù.",
      path: ["scheduledFor"]
    })
  }

  if ((data.action === "credit" || data.action === "refund") && data.amount === undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Cần số tiền xử lý.",
      path: ["amount"]
    })
  }
})
