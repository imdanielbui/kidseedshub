import { randomUUID } from "crypto"
import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { isTrustedClassPhotoUrl } from "@/lib/backend/class-photo-url"
import type { ClassPhotoListItem } from "@/lib/contracts/classes"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { classPhotoCreateSchema, classPhotoListQuerySchema } from "@/lib/validations/attendance"

function toClassPhotoListItem(photo: {
  id: string
  studentId: string
  attendanceId: string | null
  url: string
  takenAt: Date
  isFeatured: boolean
}): ClassPhotoListItem {
  return {
    id: photo.id,
    studentId: photo.studentId,
    attendanceId: photo.attendanceId ?? undefined,
    url: photo.url,
    takenAt: photo.takenAt.toISOString(),
    isFeatured: photo.isFeatured
  }
}

export async function GET(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "photos:upload")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền xem ảnh lớp." }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const parsed = classPhotoListQuerySchema.safeParse(Object.fromEntries(searchParams))

  if (!parsed.success) {
    return fail({ code: "INVALID_QUERY", message: "Bộ lọc ảnh không hợp lệ." }, { status: 400 })
  }

  const photos = await prisma.classPhoto.findMany({
    where: {
      studentId: parsed.data.studentId,
      attendanceId: parsed.data.attendanceId
    },
    orderBy: { takenAt: "desc" }
  })

  return ok(photos.map(toClassPhotoListItem))
}

export async function POST(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "photos:upload")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền đăng ảnh lớp." }, { status: 403 })
  }

  const body = await request.json()
  const parsed = classPhotoCreateSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Thông tin ảnh không hợp lệ." }, { status: 400 })
  }

  const data = parsed.data

  if (!isTrustedClassPhotoUrl(data.url)) {
    return fail(
      {
        code: "UNTRUSTED_PHOTO_URL",
        message: "Nguồn ảnh lớp không nằm trong danh sách upload/storage được tin cậy."
      },
      { status: 400 }
    )
  }

  if (data.attendanceId) {
    const attendance = await prisma.attendance.findUnique({
      where: { id: data.attendanceId },
      select: { enrollment: { select: { studentId: true } } }
    })

    if (!attendance || attendance.enrollment.studentId !== data.studentId) {
      return fail({ code: "ATTENDANCE_NOT_MATCHED", message: "Điểm danh không khớp với học viên." }, { status: 400 })
    }
  }

  try {
    const photo = await prisma.classPhoto.create({
      data: {
        studentId: data.studentId,
        attendanceId: data.attendanceId,
        url: data.url,
        cloudinaryId: `manual:${randomUUID()}`,
        takenAt: data.takenAt ? new Date(data.takenAt) : undefined,
        isFeatured: data.isFeatured
      }
    })

    return ok(toClassPhotoListItem(photo), { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return fail({ code: "PHOTO_RELATION_NOT_FOUND", message: "Không tìm thấy học viên hoặc điểm danh để gắn ảnh." }, { status: 404 })
    }

    throw error
  }
}
