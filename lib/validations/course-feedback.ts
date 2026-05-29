import { z } from "zod"

const feedbackScoreSchema = z.coerce.number().int().min(1).max(5)

export const courseFeedbackCreateSchema = z.object({
  studentId: z.string().min(1),
  teachingQuality: feedbackScoreSchema,
  teacherAttitude: feedbackScoreSchema,
  studentProgress: feedbackScoreSchema,
  wouldRecommend: feedbackScoreSchema,
  comment: z.string().max(2000).optional()
})
