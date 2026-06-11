import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import type { ClassPhotoListItem } from "@/lib/contracts/classes"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { classPhotoUpdateSchema } from "@/lib/validations/attendance"

function toClassPhotoListItem(photo: {
  id: string
  studentId: string | null
  student?: { name: string } | null
  classSessionId: string | null
  attendanceId: string | null
  url: string
  caption: string | null
  takenAt: Date
  isFeatured: boolean
  isPublished: boolean
  sentToParentAt: Date | null
  createdBy?: { name: string } | null
}): ClassPhotoListItem {
  return {
    id: photo.id,
    studentId: photo.studentId ?? undefined,
    studentName: photo.student?.name,
    classSessionId: photo.classSessionId ?? undefined,
    attendanceId: photo.attendanceId ?? undefined,
    url: photo.url,
    caption: photo.caption ?? undefined,
    takenAt: photo.takenAt.toISOString(),
    isFeatured: photo.isFeatured,
    isPublished: photo.isPublished,
    sentToParentAt: photo.sentToParentAt?.toISOString(),
    createdByName: photo.createdBy?.name
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "photos:upload")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền sửa ảnh lớp." }, { status: 403 })
  }

  const parsed = classPhotoUpdateSchema.safeParse(await request.json())

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Thông tin ảnh không hợp lệ." }, { status: 400 })
  }

  const { id } = await params
  const data = parsed.data
  const changesVisibility = data.isPublished !== undefined || data.markSent

  if (changesVisibility && !can(session.user.role, "photos:publish")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền duyệt gửi ảnh cho phụ huynh." }, { status: 403 })
  }

  try {
    const photo = await prisma.classPhoto.update({
      where: { id },
      data: {
        ...(data.caption !== undefined ? { caption: data.caption?.trim() || null } : {}),
        ...(data.isFeatured !== undefined ? { isFeatured: data.isFeatured } : {}),
        ...(data.isPublished !== undefined ? { isPublished: data.isPublished } : {}),
        ...(data.markSent || data.isPublished ? { sentToParentAt: new Date(), isPublished: true } : {})
      },
      include: {
        student: { select: { name: true } },
        createdBy: { select: { name: true } }
      }
    })

    return ok(toClassPhotoListItem(photo))
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return fail({ code: "PHOTO_NOT_FOUND", message: "Không tìm thấy ảnh lớp." }, { status: 404 })
    }

    throw error
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "photos:publish")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền xóa ảnh lớp." }, { status: 403 })
  }

  const { id } = await params

  try {
    await prisma.classPhoto.delete({ where: { id } })
    return ok({ deleted: true })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return fail({ code: "PHOTO_NOT_FOUND", message: "Không tìm thấy ảnh lớp." }, { status: 404 })
    }

    throw error
  }
}
