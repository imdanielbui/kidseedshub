import { randomUUID } from "crypto"
import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import {
  ClassPhotoUploadError,
  parseClassPhotoUploadForm,
  uploadClassPhotoFile
} from "@/lib/backend/class-photo-upload"
import { isTrustedClassPhotoUrl } from "@/lib/backend/class-photo-url"
import type { ClassPhotoListItem } from "@/lib/contracts/classes"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { classPhotoCreateSchema, classPhotoListQuerySchema } from "@/lib/validations/attendance"

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
      classSessionId: parsed.data.classSessionId,
      attendanceId: parsed.data.attendanceId
    },
    include: {
      student: { select: { name: true } },
      createdBy: { select: { name: true } }
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

  const contentType = request.headers.get("content-type") ?? ""
  const isMultipart = contentType.includes("multipart/form-data")
  const parsed = isMultipart
    ? parseClassPhotoUploadForm(await request.formData())
    : classPhotoCreateSchema.safeParse(await request.json())

  if (!parsed.success) {
    if ("code" in parsed.error) {
      return fail({ code: parsed.error.code, message: parsed.error.message }, { status: 400 })
    }

    return fail({ code: "INVALID_BODY", message: "Thông tin ảnh không hợp lệ." }, { status: 400 })
  }

  const data = parsed.data
  let photoUrl = "url" in data ? data.url : ""
  let cloudinaryId = `manual:${randomUUID()}`
  let isUploadedFile = false

  if (data.studentId) {
    const student = await prisma.student.findUnique({
      where: { id: data.studentId },
      select: { id: true }
    })

    if (!student) {
      return fail({ code: "PHOTO_STUDENT_NOT_FOUND", message: "Không tìm thấy học viên để gắn ảnh." }, { status: 404 })
    }
  }

  if (data.classSessionId) {
    const classSession = await prisma.classSession.findUnique({
      where: { id: data.classSessionId },
      select: { id: true }
    })

    if (!classSession) {
      return fail({ code: "PHOTO_CLASS_SESSION_NOT_FOUND", message: "Không tìm thấy buổi học để gắn ảnh." }, { status: 404 })
    }
  }

  if (data.attendanceId) {
    const attendance = await prisma.attendance.findUnique({
      where: { id: data.attendanceId },
      select: { classSessionId: true, enrollment: { select: { studentId: true } } }
    })

    if (!attendance || (data.studentId && attendance.enrollment.studentId !== data.studentId)) {
      return fail({ code: "ATTENDANCE_NOT_MATCHED", message: "Điểm danh không khớp với học viên." }, { status: 400 })
    }

    if (data.classSessionId && attendance.classSessionId && attendance.classSessionId !== data.classSessionId) {
      return fail({ code: "ATTENDANCE_SESSION_NOT_MATCHED", message: "Điểm danh không khớp với buổi học." }, { status: 400 })
    }
  }

  if ("file" in data) {
    try {
      const upload = await uploadClassPhotoFile(data.file)
      photoUrl = upload.url
      cloudinaryId = upload.cloudinaryId
      isUploadedFile = true
    } catch (error) {
      if (error instanceof ClassPhotoUploadError) {
        const status = error.code === "PHOTO_UPLOAD_NOT_CONFIGURED" ? 503 : 502
        return fail({ code: error.code, message: error.message }, { status })
      }

      throw error
    }
  }

  if (!isUploadedFile && !isTrustedClassPhotoUrl(photoUrl)) {
    return fail(
      {
        code: "UNTRUSTED_PHOTO_URL",
        message: "Nguồn ảnh lớp không nằm trong danh sách upload/storage được tin cậy."
      },
      { status: 400 }
    )
  }

  try {
    const createData: Prisma.ClassPhotoUncheckedCreateInput = {
      studentId: data.studentId,
      classSessionId: data.classSessionId,
      attendanceId: data.attendanceId,
      url: photoUrl,
      cloudinaryId,
      caption: data.caption,
      takenAt: data.takenAt ? new Date(data.takenAt) : undefined,
      isFeatured: data.isFeatured,
      isPublished: data.isPublished,
      sentToParentAt: data.isPublished ? new Date() : undefined,
      createdById: session.user.id
    }
    const photo = await prisma.classPhoto.create({
      data: createData,
      include: {
        student: { select: { name: true } },
        createdBy: { select: { name: true } }
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
