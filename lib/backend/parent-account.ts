import type { Prisma, StudentStatus, User } from "@prisma/client"

export type ParentAccountUser = Pick<User, "phone" | "email" | "role" | "isActive" | "updatedAt">

export function shouldActivateParentAccount(status?: StudentStatus | null) {
  return status === "CONVERTED" || status === "ACTIVE"
}

export function toParentAccountInfo(user: ParentAccountUser) {
  const canLogin = user.role === "PARENT" && user.isActive

  return {
    phone: user.phone,
    email: user.email ?? undefined,
    isActive: user.isActive,
    canLogin,
    activatedAt: canLogin ? user.updatedAt.toISOString() : undefined
  }
}

export async function activateParentAccountForStatus(tx: Prisma.TransactionClient, userId: string, status?: StudentStatus | null) {
  if (!shouldActivateParentAccount(status)) return

  await tx.user.update({
    where: { id: userId },
    data: { role: "PARENT", isActive: true }
  })
}
