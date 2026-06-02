import { z } from "zod"

export const payrollRunStatuses = ["DRAFT", "APPROVED", "PAID", "CANCELED"] as const

const payrollMoneyString = z.string().regex(/^-?\d+(\.\d{1,2})?$/)
const payrollHoursString = z.string().regex(/^\d+(\.\d{1,2})?$/)

export const payrollRunListQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  status: z.enum(payrollRunStatuses).optional()
})

export const payrollRunCreateSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/)
})

export const payrollLinePatchSchema = z.object({
  id: z.string().min(1),
  hoursWorked: payrollHoursString.optional(),
  deductions: payrollMoneyString.optional(),
  adjustments: payrollMoneyString.optional(),
  finalAmount: payrollMoneyString.optional(),
  note: z.string().max(1000).optional()
}).superRefine((value, context) => {
  const hasOverride = value.hoursWorked !== undefined
    || value.deductions !== undefined
    || value.adjustments !== undefined
    || value.finalAmount !== undefined

  if (hasOverride && !value.note?.trim()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Điều chỉnh payroll cần ghi chú.",
      path: ["note"]
    })
  }
})

export const payrollRunUpdateSchema = z.object({
  status: z.enum(["CANCELED"]).optional(),
  lines: z.array(payrollLinePatchSchema).optional()
}).refine((value) => value.status !== undefined || Boolean(value.lines?.length), {
  message: "Cần có trạng thái hoặc dòng payroll để cập nhật.",
  path: ["lines"]
})
