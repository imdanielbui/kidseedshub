import { z } from "zod"

export const employmentTypes = ["FULL_TIME", "PART_TIME"] as const

export const staffProfileUpsertSchema = z.object({
  userId: z.string().min(1),
  employmentType: z.enum(employmentTypes),
  startDate: z.string().date(),
  monthlySalary: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  hourlyRate: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  payrollActive: z.boolean().optional()
}).superRefine((value, context) => {
  if (value.employmentType === "FULL_TIME" && !value.monthlySalary) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Nhân sự toàn thời gian cần lương tháng.",
      path: ["monthlySalary"]
    })
  }

  if (value.employmentType === "PART_TIME" && !value.hourlyRate) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Nhân sự bán thời gian cần đơn giá theo giờ.",
      path: ["hourlyRate"]
    })
  }
})
