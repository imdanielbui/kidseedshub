import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { toRubricConfigItem } from "@/lib/backend/assessment-rubrics"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { rubricConfigUpdateSchema } from "@/lib/validations/assessment"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "assessments:manage_rubrics")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền quản lý kỹ năng đánh giá." }, { status: 403 })
  }

  const body = await request.json()
  const parsed = rubricConfigUpdateSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Thông tin bộ kỹ năng không hợp lệ." }, { status: 400 })
  }

  const { id } = await context.params
  const data = parsed.data

  try {
    const config = await prisma.$transaction(async (tx) => {
      const existing = await tx.assessmentRubricConfig.findUniqueOrThrow({ where: { id } })

      if (data.action === "publish") {
        await tx.assessmentRubricConfig.updateMany({
          where: {
            subject: existing.subject,
            status: "ACTIVE",
            id: { not: id }
          },
          data: { status: "ARCHIVED" }
        })

        return tx.assessmentRubricConfig.update({
          where: { id },
          data: {
            status: "ACTIVE",
            activatedAt: new Date(),
            ...(data.domains ? { domainsJson: data.domains } : {})
          }
        })
      }

      if (data.action === "archive") {
        return tx.assessmentRubricConfig.update({
          where: { id },
          data: { status: "ARCHIVED" }
        })
      }

      if (existing.status !== "DRAFT") {
        throw new Error("ACTIVE_RUBRIC_IMMUTABLE")
      }

      return tx.assessmentRubricConfig.update({
        where: { id },
        data: data.domains ? { domainsJson: data.domains } : {}
      })
    })

    return ok(toRubricConfigItem(config))
  } catch (error) {
    if (error instanceof Error && error.message === "ACTIVE_RUBRIC_IMMUTABLE") {
      return fail({ code: "ACTIVE_RUBRIC_IMMUTABLE", message: "Rubric đang dùng không sửa trực tiếp. Hãy tạo bản nháp mới." }, { status: 409 })
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return fail({ code: "RUBRIC_NOT_FOUND", message: "Không tìm thấy bộ kỹ năng." }, { status: 404 })
    }

    throw error
  }
}
