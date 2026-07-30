import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { createSubjectWithDefaultRubric, toSubjectListItem } from "@/lib/modules/subjects/subject-service"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { subjectCreateSchema } from "@/lib/validations/subject"

export async function GET() {
  const session = await auth()
  if (!session) return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })

  const subjects = await prisma.subject.findMany({ orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { name: "asc" }] })
  return ok(subjects.map(toSubjectListItem))
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  if (!can(session.user.role, "settings:manage")) return fail({ code: "FORBIDDEN", message: "Bạn không có quyền quản lý bộ môn." }, { status: 403 })

  const parsed = subjectCreateSchema.safeParse(await request.json())
  if (!parsed.success) return fail({ code: "INVALID_BODY", message: "Thông tin bộ môn không hợp lệ." }, { status: 400 })

  try {
    const subject = await prisma.$transaction((tx) => createSubjectWithDefaultRubric(tx, { ...parsed.data, createdById: session.user.id }))
    return ok(toSubjectListItem(subject), { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail({ code: "SUBJECT_KEY_EXISTS", message: "Mã bộ môn đã tồn tại." }, { status: 409 })
    }
    throw error
  }
}
