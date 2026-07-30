import { Prisma, type PrismaClient } from "@prisma/client"
import { staticRubric } from "@/lib/backend/assessment-rubrics"
import type { SubjectListItem } from "@/lib/contracts/subjects"

type PrismaTx = Prisma.TransactionClient | PrismaClient

export function toSubjectListItem(subject: { id: string; key: string; name: string; isActive: boolean; isSystem: boolean; sortOrder: number }): SubjectListItem {
  return subject
}

export async function createSubjectWithDefaultRubric(tx: PrismaTx, input: { key: string; name: string; sortOrder?: number; createdById: string }) {
  const subject = await tx.subject.create({
    data: {
      key: input.key,
      name: input.name,
      sortOrder: input.sortOrder ?? 100,
      isSystem: false
    }
  })
  const rubric = staticRubric(subject.key)

  await tx.assessmentRubricConfig.create({
    data: {
      subject: subject.key,
      version: `${subject.key.toLowerCase()}-default`,
      status: "ACTIVE",
      domainsJson: rubric.domains,
      createdById: input.createdById,
      activatedAt: new Date()
    }
  })

  return subject
}

export async function requireActiveSubject(tx: PrismaTx, key: string) {
  return tx.subject.findFirst({ where: { key, isActive: true }, select: { key: true } })
}
