import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import type { CourseListItem } from "@/lib/contracts/courses"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { courseCreateSchema } from "@/lib/validations/course"

function toCourseListItem(course: {
  id: string
  name: string
  subject: CourseListItem["subject"]
  description: string | null
  totalSessions: number
  price: { toString: () => string }
  isActive: boolean
}): CourseListItem {
  return {
    id: course.id,
    name: course.name,
    subject: course.subject,
    description: course.description ?? undefined,
    totalSessions: course.totalSessions,
    price: course.price.toString(),
    isActive: course.isActive
  }
}

export async function GET() {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  const courses = await prisma.course.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }]
  })

  return ok(courses.map(toCourseListItem))
}

export async function POST(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "courses:manage")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền tạo khóa học." }, { status: 403 })
  }

  const body = await request.json()
  const parsed = courseCreateSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Thông tin khóa học không hợp lệ." }, { status: 400 })
  }

  const course = await prisma.course.create({
    data: parsed.data
  })

  return ok(toCourseListItem(course), { status: 201 })
}
