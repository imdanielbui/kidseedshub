import { Prisma, type CourseSubject, type PrismaClient } from "@prisma/client"
import { assessmentRubrics, type AssessmentRubric } from "@/lib/assessment-rubrics"
import type { AssessmentRubricConfigItem, AssessmentRubricDomain, AssessmentRubricSkill, RoboticsAgeGroup, SubjectKey } from "@/lib/contracts/assessment"

type PrismaTx = Prisma.TransactionClient | PrismaClient

type RubricRecord = {
  id: string
  subject: CourseSubject
  version: string
  status: "DRAFT" | "ACTIVE" | "ARCHIVED"
  domainsJson: Prisma.JsonValue
  activatedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export function staticRubric(subject: SubjectKey): AssessmentRubric {
  return assessmentRubrics[subject]
}

function stringRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined

  const entries = Object.entries(value as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  return entries.length ? Object.fromEntries(entries) : undefined
}

function ageStringRecord(value: unknown): Partial<Record<RoboticsAgeGroup, string>> | undefined {
  return stringRecord(value) as Partial<Record<RoboticsAgeGroup, string>> | undefined
}

function scoreDescriptionsRecord(value: unknown): AssessmentRubricSkill["scoreDescriptions"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined

  const entries = Object.entries(value as Record<string, unknown>)
    .map(([ageGroup, scores]) => [ageGroup, stringRecord(scores)] as const)
    .filter((entry): entry is [RoboticsAgeGroup, Record<string, string>] => Boolean(entry[1]))

  return entries.length ? Object.fromEntries(entries) : undefined
}

export function rubricDomainsFromJson(value: Prisma.JsonValue): AssessmentRubricDomain[] {
  if (!Array.isArray(value)) return []

  return value
    .map((domain) => {
      if (!domain || typeof domain !== "object" || Array.isArray(domain)) return null
      const record = domain as Record<string, unknown>
      const skills = Array.isArray(record.skills)
        ? record.skills
            .map((skill) => {
              if (!skill || typeof skill !== "object" || Array.isArray(skill)) return null
              const skillRecord = skill as Record<string, unknown>
              const outcomes = Array.isArray(skillRecord.outcomes) ? skillRecord.outcomes.filter((outcome): outcome is string => typeof outcome === "string") : []

              if (typeof skillRecord.key !== "string" || typeof skillRecord.label !== "string") return null

              return {
                key: skillRecord.key,
                label: skillRecord.label,
                outcomes,
                ...(typeof skillRecord.description === "string" ? { description: skillRecord.description } : {}),
                ...(typeof skillRecord.matrixKey === "string" ? { matrixKey: skillRecord.matrixKey } : {}),
                ...(ageStringRecord(skillRecord.ageDescriptions) ? { ageDescriptions: ageStringRecord(skillRecord.ageDescriptions) } : {}),
                ...(scoreDescriptionsRecord(skillRecord.scoreDescriptions) ? { scoreDescriptions: scoreDescriptionsRecord(skillRecord.scoreDescriptions) } : {})
              }
            })
            .filter((skill): skill is AssessmentRubricDomain["skills"][number] => Boolean(skill))
        : []

      if (typeof record.key !== "string" || typeof record.label !== "string") return null

      return {
        key: record.key,
        label: record.label,
        skills
      }
    })
    .filter((domain): domain is AssessmentRubricDomain => Boolean(domain))
}

export function rubricFromSnapshot(value: Prisma.JsonValue | null | undefined, fallbackSubject: SubjectKey, fallbackVersion: string): AssessmentRubricConfigItem {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, Prisma.JsonValue>
    const subject = record.subject === "FUN" || record.subject === "ROBOTICS" ? record.subject : fallbackSubject
    const version = typeof record.version === "string" ? record.version : fallbackVersion

    return {
      subject,
      version,
      status: "ARCHIVED",
      domains: rubricDomainsFromJson(record.domains)
    }
  }

  return {
    ...staticRubric(fallbackSubject),
    version: fallbackVersion,
    status: "ARCHIVED"
  }
}

export function toRubricConfigItem(record: RubricRecord): AssessmentRubricConfigItem {
  return {
    id: record.id,
    subject: record.subject,
    version: record.version,
    status: record.status,
    domains: rubricDomainsFromJson(record.domainsJson),
    activatedAt: record.activatedAt?.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  }
}

export function toSnapshot(rubric: Pick<AssessmentRubricConfigItem, "subject" | "version" | "domains">): Prisma.InputJsonObject {
  return {
    subject: rubric.subject,
    version: rubric.version,
    domains: rubric.domains
  }
}

export async function findActiveRubric(tx: PrismaTx, subject: SubjectKey) {
  const config = await tx.assessmentRubricConfig.findFirst({
    where: { subject, status: "ACTIVE" },
    orderBy: [{ activatedAt: "desc" }, { updatedAt: "desc" }]
  })

  if (config) {
    const rubric = toRubricConfigItem(config)
    return {
      configId: config.id,
      rubric
    }
  }

  const fallback = staticRubric(subject)

  return {
    configId: undefined,
    rubric: {
      ...fallback,
      status: "ACTIVE" as const
    }
  }
}

export function nextRubricVersion(subject: SubjectKey) {
  const date = new Date().toISOString().slice(0, 10)
  return `${subject.toLowerCase()}-${date}-draft-${Date.now()}`
}
