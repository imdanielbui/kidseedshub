import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { resumeEnrollmentHold, toEnrollmentHoldItem } from "@/lib/modules/enrollments/application/enrollment-holds"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { enrollmentHoldResumeSchema } from "@/lib/validations/enrollment-hold"

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  if (!can(session.user.role, "enrollments:manage")) return fail({ code: "FORBIDDEN", message: "Bạn không có quyền mở lại bảo lưu." }, { status: 403 })
  const parsed = enrollmentHoldResumeSchema.safeParse(await request.json())
  if (!parsed.success) return fail({ code: "INVALID_BODY", message: "Lớp mở lại không hợp lệ." }, { status: 400 })
  const { id } = await context.params
  try {
    const hold = await prisma.$transaction((tx) => resumeEnrollmentHold(tx, { holdId: id, classId: parsed.data.classId, actorId: session.user.id }))
    return ok(toEnrollmentHoldItem(hold))
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN"
    const message = code === "HOLD_NOT_FOUND" ? "Không tìm thấy bảo lưu." : code === "HOLD_EXPIRED" ? "Bảo lưu đã hết hạn, credit không còn hiệu lực." : code === "CLASS_NOT_MATCHED" ? "Lớp mở lại phải đang hoạt động và thuộc cùng khóa." : "Không mở lại được bảo lưu."
    return fail({ code, message }, { status: code === "HOLD_NOT_FOUND" ? 404 : 400 })
  }
}
