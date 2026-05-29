import type { Role } from "@/lib/permissions"
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { prisma } from "@/lib/prisma"

const loginSchema = z.object({
  phone: z.string().min(8),
  password: z.string().min(6)
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: getAuthSecret(),
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/login"
  },
  providers: [
    Credentials({
      credentials: {
        phone: { label: "Số điện thoại", type: "text" },
        password: { label: "Mật khẩu", type: "password" }
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials)

        if (!parsed.success) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { phone: parsed.data.phone }
        })

        if (!user || !user.isActive) {
          return null
        }

        const isValid = await bcrypt.compare(parsed.data.password, user.password)

        if (!isValid) {
          return null
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role
        }
      }
    })
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.phone = user.phone
        token.role = user.role as Role
      }

      return token
    },
    session({ session, token }) {
      session.user.id = token.id as string
      session.user.phone = token.phone as string
      session.user.role = token.role as Role

      return session
    }
  }
})

function getAuthSecret() {
  if (process.env.NEXTAUTH_SECRET) {
    return process.env.NEXTAUTH_SECRET
  }

  if (process.env.AUTH_SECRET) {
    return process.env.AUTH_SECRET
  }

  if (process.env.NODE_ENV !== "production") {
    return "kidseedshub-development-secret-change-before-production"
  }

  return undefined
}
