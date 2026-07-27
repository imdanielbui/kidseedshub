import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { listEnrollmentHolds, toEnrollmentHoldItem, createEnrollmentHold } from "@/lib/modules/enrollments/application/enrollment-holds"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { enrollmentHoldCreateSchema } from "@/lib/validations/enrollment-hold"

export async function GET(request: Request) {
  const session = await auth()
  if (!session) return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  if (!can(session.user.role, "enrollments:manage")) return fail({ code: "FORBIDDEN", message: "Bạn không có quyền xem bảo lưu học phí." }, { status: 403 })
  const studentId = new URL(request.url).searchParams.get("studentId")
  if (!studentId) return fail({ code: "STUDENT_REQUIRED", message: "Cần chọn học viên." }, { status: 400 })
  const holds = await prisma.$transaction((tx) => listEnrollmentHolds(tx, studentId))
  return ok(holds.map(toEnrollmentHoldItem))
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  if (!can(session.user.role, "enrollments:manage")) return fail({ code: "FORBIDDEN", message: "Bạn không có quyền bảo lưu học phí." }, { status: 403 })
  const parsed = enrollmentHoldCreateSchema.safeParse(await request.json())
  if (!parsed.success) return fail({ code: "INVALID_BODY", message: "Thông tin bảo lưu không hợp lệ." }, { status: 400 })
  try {
    const hold = await prisma.$transaction((tx) => createEnrollmentHold(tx, { ...parsed.data, actorId: session.user.id }))
    return ok(toEnrollmentHoldItem(hold), { status: 201 })
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN"
    const message = code === "ENROLLMENT_NOT_FOUND" ? "Không tìm thấy khóa đã đăng ký." : code === "ENROLLMENT_INACTIVE" ? "Khóa này đang không hoạt động." : code === "HOLD_ALREADY_ACTIVE" ? "Khóa này đã có bảo lưu còn hiệu lực." : "Không tạo được bảo lưu học phí."
    return fail({ code, message }, { status: code === "ENROLLMENT_NOT_FOUND" ? 404 : 400 })
  }
}
