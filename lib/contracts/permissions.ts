import type { Permission, Role } from "@/lib/permissions"

export type PermissionMatrixRow = {
  permission: Permission
  label: string
  roles: Role[]
  defaultRoles: Role[]
  updatedAt?: string
}
