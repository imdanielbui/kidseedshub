import { z } from "zod"
import { progressLevels } from "@/lib/assessment-rubrics"

export const weeklyAssessmentItemSchema = z.object({
  domainKey: z.string().min(1),
  skillKey: z.string().min(1),
  outcomeIndex: z.number().int().min(0),
  checked: z.boolean(),
  score: z.number().int().min(1).max(5).optional(),
  progressLevel: z.enum(progressLevels).optional(),
  comment: z.string().max(1000).optional(),
  evidenceUrl: z.string().url().optional()
})

export const weeklyAssessmentSchema = z.object({
  studentId: z.string().min(1),
  enrollmentId: z.string().min(1),
  subject: z.enum(["FUN", "ROBOTICS"]).optional(),
  rubricVersion: z.string().min(1).optional(),
  weekNumber: z.number().int().min(1),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETE"]).optional(),
  teacherId: z.string().optional(),
  comment: z.string().max(2000).optional(),
  items: z.array(weeklyAssessmentItemSchema).default([])
})

export const weeklyClassAssessmentSchema = z.object({
  classId: z.string().min(1),
  weekNumber: z.number().int().min(1),
  assessments: z.array(
    z.object({
      studentId: z.string().min(1),
      enrollmentId: z.string().min(1),
      status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETE"]),
      comment: z.string().max(2000).optional(),
      items: z.array(weeklyAssessmentItemSchema).default([])
    })
  )
})

export const finalAssessmentSchema = z.object({
  studentId: z.string().min(1),
  enrollmentId: z.string().min(1),
  subject: z.enum(["FUN", "ROBOTICS"]),
  rubricVersion: z.string().min(1),
  requiredWeeks: z.number().int().min(1),
  strengths: z.string().min(1),
  improvements: z.string().min(1),
  teacherSummary: z.string().min(1),
  nextSteps: z.string().optional()
})

const rubricSkillSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  outcomes: z.array(z.string().min(1)).min(1),
  description: z.string().optional(),
  ageDescriptions: z.record(z.string(), z.string()).optional(),
  matrixKey: z.string().optional(),
  scoreDescriptions: z.record(z.string(), z.record(z.string(), z.string())).optional()
})

const rubricDomainSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  skills: z.array(rubricSkillSchema).min(1)
})

export const rubricConfigCreateSchema = z.object({
  subject: z.enum(["FUN", "ROBOTICS"]),
  version: z.string().min(1).optional(),
  domains: z.array(rubricDomainSchema).min(1)
})

export const rubricConfigUpdateSchema = z.object({
  domains: z.array(rubricDomainSchema).min(1).optional(),
  action: z.enum(["publish", "archive"]).optional()
})

export const finalClassPublishSchema = z.object({
  classId: z.string().min(1),
  requiredWeeks: z.number().int().min(1),
  studentId: z.string().min(1).optional()
})
