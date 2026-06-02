import type { Role } from "@/lib/permissions"
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { ensureRuntimePermissionMatrixLoaded } from "@/lib/backend/permission-matrix"
import { prisma } from "@/lib/prisma"

const loginSchema = z.object({
  phone: z.string().trim().min(8),
  password: z.string().min(6)
})

type LoginAttemptState = {
  failedCount: number
  firstFailedAt: number
  lockedUntil?: number
}

const loginAttemptWindowMs = 15 * 60 * 1000
const loginLockoutMs = 15 * 60 * 1000
const maxFailedLoginAttempts = 5
const globalForLoginAttempts = globalThis as typeof globalThis & {
  kidSeedsLoginAttempts?: Map<string, LoginAttemptState>
}
const loginAttempts = globalForLoginAttempts.kidSeedsLoginAttempts ?? new Map<string, LoginAttemptState>()
globalForLoginAttempts.kidSeedsLoginAttempts = loginAttempts

function getLoginAttemptState(phone: string) {
  const now = Date.now()
  const current = loginAttempts.get(phone)

  if (!current) {
    return undefined
  }

  if (!current.lockedUntil && now - current.firstFailedAt > loginAttemptWindowMs) {
    loginAttempts.delete(phone)
    return undefined
  }

  if (current.lockedUntil && now >= current.lockedUntil) {
    loginAttempts.delete(phone)
    return undefined
  }

  return current
}

function recordFailedLogin(phone: string) {
  const now = Date.now()
  const current = getLoginAttemptState(phone)
  const next: LoginAttemptState = current
    ? { ...current, failedCount: current.failedCount + 1 }
    : { failedCount: 1, firstFailedAt: now }

  if (!next.lockedUntil && next.failedCount >= maxFailedLoginAttempts) {
    next.lockedUntil = now + loginLockoutMs
  }

  loginAttempts.set(phone, next)
  return next
}

async function auditBlockedLogin(phone: string, userId?: string) {
  await prisma.auditLog.create({
    data: {
      action: "auth.login_blocked",
      entityType: userId ? "User" : "Auth",
      entityId: userId,
      summary: "Credential login blocked after repeated failed attempts.",
      metadata: { phone }
    }
  })
}

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

        const lockedState = getLoginAttemptState(parsed.data.phone)

        if (lockedState?.lockedUntil) {
          await auditBlockedLogin(parsed.data.phone)
          return null
        }

        const user = await prisma.user.findUnique({
          where: { phone: parsed.data.phone }
        })

        if (!user || !user.isActive) {
          const failedState = recordFailedLogin(parsed.data.phone)

          if (failedState.lockedUntil) {
            await auditBlockedLogin(parsed.data.phone)
          }

          return null
        }

        const isValid = await bcrypt.compare(parsed.data.password, user.password)

        if (!isValid) {
          const failedState = recordFailedLogin(parsed.data.phone)

          if (failedState.lockedUntil) {
            await auditBlockedLogin(parsed.data.phone, user.id)
          }

          return null
        }

        loginAttempts.delete(parsed.data.phone)

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
