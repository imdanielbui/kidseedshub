import bcrypt from "bcryptjs"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { toParentAccountInfo } from "@/lib/backend/parent-account"
import { createParentInitialPassword } from "@/lib/backend/parent-password"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

type RouteContext = {
  params: Promise<{ id: string }>
}

const parentAccountSchema = z.object({
  action: z.enum(["activate", "reset_default_password"])
})

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "students:edit")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền quản lý tài khoản phụ huynh." }, { status: 403 })
  }

  const body = await request.json()
  const parsed = parentAccountSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Thao tác tài khoản phụ huynh không hợp lệ." }, { status: 400 })
  }

  const { id } = await context.params
  const student = await prisma.student.findUnique({
    where: { id },
    include: { parent: { include: { user: true } } }
  })

  if (!student) {
    return fail({ code: "NOT_FOUND", message: "Học viên không tồn tại." }, { status: 404 })
  }

  const parentPassword =
    parsed.data.action === "reset_default_password"
      ? createParentInitialPassword(student.parent.user.phone)
      : undefined
  const password = parentPassword ? await bcrypt.hash(parentPassword.plainText, 10) : undefined

  const user = await prisma.user.update({
    where: { id: student.parent.userId },
    data: {
      role: "PARENT",
      isActive: true,
      password
    }
  })

  return ok({
    ...toParentAccountInfo(user),
    temporaryPassword: parentPassword?.isTemporary ? parentPassword.plainText : undefined
  })
}
