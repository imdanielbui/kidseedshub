import { Prisma, type StudentStatus } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { toClassProgressSummary } from "@/lib/backend/class-progress"
import { pipelineStages, type PipelineCard, type PipelineResponse, type PipelineStageCounts, type PipelineStageKey } from "@/lib/contracts/crm"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

const staleThresholds: Partial<Record<PipelineStageKey, number>> = {
  LEAD: 3,
  TRIAL: 3,
  EVALUATION: 5,
  RETENTION: 14
}

const sortableFields = new Set(["updatedAt", "createdAt", "stageChangedAt", "daysInStage", "parentName", "studentName", "code"])

function emptyCounts(): PipelineStageCounts {
  return pipelineStages.reduce((counts, stage) => {
    counts[stage.key] = 0
    return counts
  }, {} as PipelineStageCounts)
}

function parseStage(value: string | null): PipelineStageKey | undefined {
  if (!value || value === "ALL") return undefined
  return pipelineStages.some((stage) => stage.key === value) ? (value as PipelineStageKey) : undefined
}

function parseDateInput(value: string | null) {
  if (!value) return undefined
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function dayDiff(from: Date, to = new Date()) {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86_400_000))
}

function isStudentStale(status: PipelineStageKey, daysInStage: number) {
  const threshold = staleThresholds[status]
  return threshold !== undefined && daysInStage > threshold
}

export async function GET(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "pipeline:manage")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền xem pipeline." }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1)
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 25) || 25))
  const q = searchParams.get("q")?.trim()
  const stage = parseStage(searchParams.get("stage"))
  const saleOwnerId = searchParams.get("saleOwnerId")
  const classId = searchParams.get("classId")
  const createdFromInput = parseDateInput(searchParams.get("createdFrom"))
  const createdToInput = parseDateInput(searchParams.get("createdTo"))
  const includeNurture = searchParams.get("includeNurture") === "true" || stage === "NURTURE"
  const sort = sortableFields.has(searchParams.get("sort") ?? "") ? searchParams.get("sort")! : "updatedAt"
  const direction = searchParams.get("direction") === "asc" ? "asc" : "desc"
  const now = new Date()
  const stageKeys = pipelineStages.map((item) => item.key) as StudentStatus[]
  const visibleStages = includeNurture ? stageKeys : stageKeys.filter((key) => key !== "NURTURE")
  const createdFrom = createdFromInput && createdToInput && createdFromInput > createdToInput ? createdToInput : createdFromInput
  const createdTo = createdFromInput && createdToInput && createdFromInput > createdToInput ? createdFromInput : createdToInput
  const createdToEndOfDay = createdTo ? new Date(createdTo) : undefined

  if (createdToEndOfDay) {
    createdToEndOfDay.setHours(23, 59, 59, 999)
  }

  const baseWhere: Prisma.StudentWhereInput = {
    ...(saleOwnerId && saleOwnerId !== "ALL" ? { saleOwnerId } : {}),
    ...(classId && classId !== "ALL" ? { classStudents: { some: { classId, isActive: true } } } : {}),
    ...(createdFrom || createdToEndOfDay
      ? {
          createdAt: {
            ...(createdFrom ? { gte: createdFrom } : {}),
            ...(createdToEndOfDay ? { lte: createdToEndOfDay } : {})
          }
        }
      : {}),
    ...(q
      ? {
          OR: [
            { code: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
            { address: { contains: q, mode: "insensitive" } },
            { parent: { user: { name: { contains: q, mode: "insensitive" } } } },
            { parent: { user: { phone: { contains: q } } } },
            { leadSource: { contains: q, mode: "insensitive" } }
          ]
        }
      : {})
  }
  const where: Prisma.StudentWhereInput = {
    ...baseWhere,
    status: stage ? stage : { in: visibleStages }
  }

  const orderBy: Prisma.StudentOrderByWithRelationInput =
    sort === "daysInStage"
      ? { stageChangedAt: direction === "asc" ? "desc" : "asc" }
      : sort === "parentName"
        ? { parent: { user: { name: direction } } }
        : sort === "studentName"
          ? { name: direction }
          : { [sort]: direction }

  const [students, total, groupedCounts] = await prisma.$transaction([
    prisma.student.findMany({
      where,
      include: {
        parent: { include: { user: true } },
        saleOwner: true,
        createdBy: true,
        classStudents: {
          where: { isActive: true },
          include: {
            class: {
              include: {
                course: true,
                sessions: {
                  select: { date: true, status: true },
                  orderBy: { date: "asc" }
                }
              }
            }
          }
        }
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.student.count({ where }),
    prisma.student.groupBy({
      by: ["status"],
      where: { ...baseWhere, status: { in: visibleStages } },
      _count: { _all: true },
      orderBy: { status: "asc" }
    })
  ])

  const stageCounts = emptyCounts()
  const staleCounts = emptyCounts()

  ;(groupedCounts as Array<{ status: StudentStatus; _count: { _all: number } }>).forEach((item) => {
    stageCounts[item.status as PipelineStageKey] = item._count._all
  })

  const staleCandidates = await prisma.student.findMany({
    where: { ...baseWhere, status: { in: visibleStages.filter((key) => key !== "NURTURE") } },
    select: { status: true, stageChangedAt: true }
  })

  staleCandidates.forEach((student) => {
    const status = student.status as PipelineStageKey
    if (isStudentStale(status, dayDiff(student.stageChangedAt, now))) {
      staleCounts[status] += 1
    }
  })

  const items: PipelineCard[] = students.map((student) => {
    const status = student.status as PipelineStageKey
    const daysInStage = dayDiff(student.stageChangedAt, now)
    const threshold = staleThresholds[status]
    const isStale = isStudentStale(status, daysInStage)

    return {
      id: student.id,
      code: student.code,
      stage: status,
      parentName: student.parent.user.name,
      parentEmail: student.parent.user.email ?? undefined,
      address: student.address ?? undefined,
      studentName: student.name,
      phone: student.parent.user.phone,
      gender: student.gender,
      leadSource: student.leadSource ?? undefined,
      saleOwnerId: student.saleOwnerId ?? undefined,
      saleOwnerName: student.saleOwner?.name,
      createdByName: student.createdBy?.name,
      classNames: student.classStudents.map((classStudent) => classStudent.class.name),
      classProgress: student.classStudents.map((classStudent) => toClassProgressSummary(classStudent.class, now)),
      isStale,
      staleReason: isStale && threshold ? `Quá ${threshold} ngày ở bước này` : undefined,
      stageChangedAt: student.stageChangedAt.toISOString(),
      createdAt: student.createdAt.toISOString(),
      updatedAt: student.updatedAt.toISOString(),
      daysInStage
    }
  })

  const response: PipelineResponse = {
    items,
    total,
    page,
    limit,
    stageCounts,
    staleCounts
  }

  return ok(response)
}
