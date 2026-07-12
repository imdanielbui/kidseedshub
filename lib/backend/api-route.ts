import { Prisma } from "@prisma/client"
import type { Session } from "next-auth"
import type { NextResponse } from "next/server"
import { fail } from "@/lib/api-response"
import { auth } from "@/lib/auth"
import { can, type Permission } from "@/lib/permissions"

type RouteSession = Session

export async function requireRoutePermission({
  permissions,
  forbiddenMessage,
  unauthorizedMessage = "Bạn cần đăng nhập."
}: {
  permissions: Permission[]
  forbiddenMessage: string
  unauthorizedMessage?: string
}): Promise<RouteSession | NextResponse> {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: unauthorizedMessage }, { status: 401 })
  }

  if (!permissions.some((permission) => can(session.user.role, permission))) {
    return fail({ code: "FORBIDDEN", message: forbiddenMessage }, { status: 403 })
  }

  return session as RouteSession
}

export function isPrismaErrorCode(error: unknown, code: string) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
}
