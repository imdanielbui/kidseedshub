import bcrypt from "bcryptjs"
import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/backend/activity"
import type { UserListItem } from "@/lib/contracts/users"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { userUpdateSchema } from "@/lib/validations/user"

type RouteContext = {
  params: Promise<{ id: string }>
}

function toUserListItem(user: {
  id: string
  name: string
  phone: string
  email: string | null
  role: UserListItem["role"]
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}): UserListItem {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email ?? undefined,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString()
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "users:manage")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền cập nhật tài khoản." }, { status: 403 })
  }

  const body = await request.json()
  const parsed = userUpdateSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Thông tin cập nhật tài khoản không hợp lệ." }, { status: 400 })
  }

  const { id } = await context.params
  const data = parsed.data

  if (id === session.user.id && data.isActive === false) {
    return fail({ code: "CANNOT_DEACTIVATE_SELF", message: "Bạn không thể tắt chính tài khoản đang dùng." }, { status: 400 })
  }

  if (id === session.user.id && data.role && data.role !== "ADMIN") {
    return fail({ code: "CANNOT_DOWNGRADE_SELF", message: "Bạn không thể tự hạ quyền Admin của mình." }, { status: 400 })
  }

  try {
    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id, role: { in: ["ADMIN", "SALE", "TEACHER"] } },
        data: {
          name: data.name,
          phone: data.phone,
          email: data.email === null ? null : data.email,
          password: data.password ? await bcrypt.hash(data.password, 10) : undefined,
          role: data.role,
          isActive: data.isActive
        }
      })

      await createAuditLog(tx, {
        actorId: session.user.id,
        action: "user.update",
        entityType: "User",
        entityId: updated.id,
        summary: `Cập nhật tài khoản ${updated.name}`,
        metadata: {
          role: updated.role,
          isActive: updated.isActive,
          passwordChanged: Boolean(data.password)
        }
      })

      return updated
    })

    return ok(toUserListItem(user))
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail({ code: "DUPLICATE_USER", message: "Số điện thoại hoặc email đã tồn tại." }, { status: 409 })
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return fail({ code: "USER_NOT_FOUND", message: "Không tìm thấy tài khoản nhân sự." }, { status: 404 })
    }

    throw error
  }
}
