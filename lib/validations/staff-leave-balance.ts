import { z } from "zod"

export const staffLeaveBalanceListQuerySchema = z.object({
  staffId: z.string().min(1).optional(),
  asOfDate: z.string().date().optional()
})

export const staffLeaveBalanceAdjustmentCreateSchema = z.object({
  staffId: z.string().min(1),
  days: z.string().regex(/^-?\d+(\.\d{1,2})?$/),
  reason: z.string().min(3).max(1000)
}).superRefine((value, context) => {
  if (Number(value.days) === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Số ngày điều chỉnh phải khác 0.",
      path: ["days"]
    })
  }
})
