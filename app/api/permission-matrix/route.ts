import { z } from "zod"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import type { PermissionMatrixRow } from "@/lib/contracts/permissions"
import { createAuditLog } from "@/lib/backend/activity"
import { can, permissionLabels, PERMISSIONS, roles, setRuntimePermissionMatrix, type Permission, type Role } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

const permissionKeys = Object.keys(PERMISSIONS) as Permission[]

const permissionMatrixUpdateSchema = z.object({
  entries: z
    .array(
      z.object({
        permission: z.enum(permissionKeys as [Permission, ...Permission[]]),
        roles: z.array(z.enum(roles)).min(1)
      })
    )
    .min(1)
})

function applyRuntimeMatrix(entries: Array<{ permission: string; roles: Role[] }>) {
  setRuntimePermissionMatrix(
    Object.fromEntries(entries.map((entry) => [entry.permission, entry.roles])) as Partial<Record<Permission, Role[]>>
  )
}

async function getRows(): Promise<PermissionMatrixRow[]> {
  const entries = await prisma.permissionMatrixEntry.findMany()
  const entryMap = new Map(entries.map((entry) => [entry.permission, entry]))
  applyRuntimeMatrix(entries)

  return permissionKeys.map((permission) => {
    const entry = entryMap.get(permission)
    return {
      permission,
      label: permissionLabels[permission],
      roles: entry?.roles ?? [...PERMISSIONS[permission]],
      defaultRoles: [...PERMISSIONS[permission]],
      updatedAt: entry?.updatedAt.toISOString()
    }
  })
}

export async function GET() {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "settings:manage")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền xem ma trận phân quyền." }, { status: 403 })
  }

  return ok(await getRows())
}

export async function PATCH(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "settings:manage")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền cập nhật ma trận phân quyền." }, { status: 403 })
  }

  const body = await request.json()
  const parsed = permissionMatrixUpdateSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Ma trận phân quyền không hợp lệ." }, { status: 400 })
  }

  await prisma.$transaction(async (tx) => {
    for (const entry of parsed.data.entries) {
      await tx.permissionMatrixEntry.upsert({
        where: { permission: entry.permission },
        create: {
          permission: entry.permission,
          roles: entry.roles
        },
        update: {
          roles: entry.roles
        }
      })
    }

    await createAuditLog(tx, {
      actorId: session.user.id,
      action: "permission_matrix.update",
      entityType: "PermissionMatrix",
      summary: `Cập nhật ${parsed.data.entries.length} quyền`,
      metadata: parsed.data.entries
    })
  })

  return ok(await getRows())
}
