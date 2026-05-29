import type { Role } from "@/lib/permissions"

declare module "next-auth" {
  interface User {
    phone: string
    role: Role
  }

  interface Session {
    user: {
      id: string
      name: string
      email?: string | null
      phone: string
      role: Role
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    phone: string
    role: Role
  }
}
