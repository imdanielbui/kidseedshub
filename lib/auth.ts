import type { Role } from "@/lib/permissions"
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { getLoginAttemptState, recordBlockedLogin, recordFailedLogin, recordSuccessfulLogin } from "@/lib/backend/login-attempts"
import { ensureRuntimePermissionMatrixLoaded } from "@/lib/backend/permission-matrix"
import { prisma } from "@/lib/prisma"

const loginSchema = z.object({
  phone: z.string().trim().min(8),
  password: z.string().min(6)
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: getAuthSecret(),
  trustHost: shouldTrustHost(),
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

        const lockedState = await getLoginAttemptState(parsed.data.phone)

        if (lockedState?.lockedUntil) {
          await recordBlockedLogin(parsed.data.phone, lockedState.lockedUntil)
          return null
        }

        const user = await prisma.user.findUnique({
          where: { phone: parsed.data.phone }
        })

        if (!user || !user.isActive) {
          const failedState = await recordFailedLogin(parsed.data.phone)

          if (failedState?.lockedUntil) {
            await recordBlockedLogin(parsed.data.phone, failedState.lockedUntil)
          }

          return null
        }

        const isValid = await bcrypt.compare(parsed.data.password, user.password)

        if (!isValid) {
          const failedState = await recordFailedLogin(parsed.data.phone, user.id)

          if (failedState?.lockedUntil) {
            await recordBlockedLogin(parsed.data.phone, failedState.lockedUntil, user.id)
          }

          return null
        }

        await recordSuccessfulLogin(parsed.data.phone, user.id)

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
    async session({ session, token }) {
      await ensureRuntimePermissionMatrixLoaded()

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

  throw new Error("NEXTAUTH_SECRET or AUTH_SECRET must be set in production.")
}

function shouldTrustHost() {
  return process.env.NODE_ENV !== "production" || process.env.AUTH_TRUST_HOST === "true" || process.env.VERCEL === "1"
}
