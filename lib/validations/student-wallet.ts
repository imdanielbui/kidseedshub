import { z } from "zod"

export const studentWalletQuerySchema = z.object({
  studentId: z.string().min(1).optional()
})

export const studentWalletCreateSchema = z.object({
  studentId: z.string().min(1),
  amount: z.number().positive(),
  note: z.string().trim().min(3).max(1000)
})
