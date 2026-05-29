import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { findActiveRubric, nextRubricVersion, toRubricConfigItem } from "@/lib/backend/assessment-rubrics"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { rubricConfigCreateSchema } from "@/lib/validations/assessment"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const subject = searchParams.get("subject")
  const includeAll = searchParams.get("all") === "true"

  if (includeAll) {
    const session = await auth()

    if (!session) {
      return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
    }

    if (!can(session.user.role, "assessments:manage_rubrics")) {
      return fail({ code: "FORBIDDEN", message: "Bạn không có quyền quản lý kỹ năng đánh giá." }, { status: 403 })
    }

    const configs = await prisma.assessmentRubricConfig.findMany({
      where: subject === "FUN" || subject === "ROBOTICS" ? { subject } : undefined,
      orderBy: [{ subject: "asc" }, { status: "asc" }, { updatedAt: "desc" }]
    })

    return ok(configs.map(toRubricConfigItem))
  }

  if (subject === "FUN" || subject === "ROBOTICS") {
    const active = await findActiveRubric(prisma, subject)
    return ok(active.rubric)
  }

  if (!subject) {
    const activeRubrics = await Promise.all([findActiveRubric(prisma, "FUN"), findActiveRubric(prisma, "ROBOTICS")])
    return ok(activeRubrics.map((entry) => entry.rubric))
  }

  return fail(
    {
      code: "INVALID_SUBJECT",
      message: "Bộ môn không hợp lệ. Chỉ hỗ trợ FUN hoặc Robotics."
    },
    { status: 400 }
  )
}

export async function POST(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "assessments:manage_rubrics")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền quản lý kỹ năng đánh giá." }, { status: 403 })
  }

  const body = await request.json()
  const parsed = rubricConfigCreateSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Thông tin bộ kỹ năng không hợp lệ." }, { status: 400 })
  }

  const data = parsed.data

  try {
    const config = await prisma.assessmentRubricConfig.create({
      data: {
        subject: data.subject,
        version: data.version ?? nextRubricVersion(data.subject),
        status: "DRAFT",
        domainsJson: data.domains,
        createdById: session.user.id
      }
    })

    return ok(toRubricConfigItem(config), { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail({ code: "RUBRIC_VERSION_EXISTS", message: "Version rubric này đã tồn tại." }, { status: 409 })
    }

    throw error
  }
}
