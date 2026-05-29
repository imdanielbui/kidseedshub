import type { Role } from "@/lib/permissions"

export const roleLabels = {
  ADMIN: "Admin",
  SALE: "Sale",
  TEACHER: "Teacher",
  PARENT: "Parent"
} as const satisfies Record<Role, string>

export const staffRoles = ["ADMIN", "SALE", "TEACHER"] as const

export type StaffRole = (typeof staffRoles)[number]

export type UserListItem = {
  id: string
  name: string
  phone: string
  email?: string
  role: Role
  isActive: boolean
  createdAt: string
  updatedAt: string
}
