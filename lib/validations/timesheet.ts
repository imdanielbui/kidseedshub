import { z } from "zod"

export const staffTimesheetSources = ["CLASS_SESSION", "MANUAL", "ADJUSTMENT"] as const
export const staffTimesheetStatuses = ["DRAFT", "APPROVED", "REJECTED"] as const

export const timesheetListQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  staffId: z.string().min(1).optional(),
  status: z.enum(staffTimesheetStatuses).optional()
})

export const timesheetCreateSchema = z.object({
  staffId: z.string().min(1),
  date: z.string().date(),
  source: z.enum(["MANUAL", "ADJUSTMENT"]),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  hours: z.string().regex(/^\d+(\.\d{1,2})?$/),
  note: z.string().min(3).max(1000)
}).superRefine((value, context) => {
  if (Number(value.hours) <= 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Số giờ phải lớn hơn 0.",
      path: ["hours"]
    })
  }
})

export const timesheetUpdateSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]).optional(),
  hours: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  note: z.string().max(1000).optional()
}).superRefine((value, context) => {
  if (value.hours !== undefined && Number(value.hours) <= 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Số giờ phải lớn hơn 0.",
      path: ["hours"]
    })
  }

  if (value.hours !== undefined && !value.note?.trim()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Điều chỉnh số giờ cần ghi chú.",
      path: ["note"]
    })
  }
})
