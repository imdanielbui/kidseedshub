import bcrypt from "bcryptjs"
import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/backend/activity"
import type { UserListItem } from "@/lib/contracts/users"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { userCreateSchema } from "@/lib/validations/user"

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

export async function GET() {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "users:manage")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền quản lý tài khoản." }, { status: 403 })
  }

  const users = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "SALE", "TEACHER"] } },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }]
  })

  return ok(users.map(toUserListItem))
}

export async function POST(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "users:manage")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền tạo tài khoản." }, { status: 403 })
  }

  const body = await request.json()
  const parsed = userCreateSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Thông tin tài khoản không hợp lệ." }, { status: 400 })
  }

  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          ...parsed.data,
          password: await bcrypt.hash(parsed.data.password, 10)
        }
      })

      await createAuditLog(tx, {
        actorId: session.user.id,
        action: "user.create",
        entityType: "User",
        entityId: created.id,
        summary: `Tạo tài khoản ${created.name}`,
        metadata: {
          role: created.role,
          isActive: created.isActive
        }
      })

      return created
    })

    return ok(toUserListItem(user), { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail({ code: "DUPLICATE_USER", message: "Số điện thoại hoặc email đã tồn tại." }, { status: 409 })
    }

    throw error
  }
}
