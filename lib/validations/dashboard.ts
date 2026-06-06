import { z } from "zod"

export const dashboardOverviewQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional()
})
