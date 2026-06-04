"use client"

import { FormEvent, useMemo, useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { LogIn } from "lucide-react"

const demoAccounts = [
  { label: "Admin", phone: "0900000001", password: "Admin@123" },
  { label: "Sale", phone: "0900000002", password: "Sale@123" },
  { label: "Teacher FUN", phone: "0900000005", password: "Teacher@123" },
  { label: "Parent", phone: "0911000004", password: "Parent@123" }
]
const showDemoAccounts = process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN === "true"

type SessionPayload = {
  user?: {
    role?: string
  }
} | null

async function loadSessionRole() {
  const sessionResponse = await fetch("/api/auth/session", { cache: "no-store" })

  if (!sessionResponse.ok) {
    return undefined
  }

  const session = (await sessionResponse.json()) as SessionPayload
  return session?.user?.role
}

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const redirectTo = useMemo(() => {
    const callbackUrl = searchParams.get("callbackUrl")

    if (callbackUrl?.startsWith("/")) {
      return callbackUrl
    }

    return "/dashboard"
  }, [searchParams])

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setIsSubmitting(true)

    try {
      const result = await signIn("credentials", {
        phone: phone.trim(),
        password,
        redirect: false,
        redirectTo
      })

      if (!result?.ok) {
        setError("Số điện thoại hoặc mật khẩu chưa đúng.")
        return
      }

      const role = await loadSessionRole()
      const nextPath = role === "PARENT" ? "/parent" : redirectTo

      router.push(nextPath)
      router.refresh()
    } catch {
      setError("Không đăng nhập được. Vui lòng thử lại.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <form className="mt-6 space-y-4" onSubmit={submitLogin}>
        <label className="block text-sm font-semibold text-stone-700">
          Số điện thoại
          <input
            className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none placeholder:text-stone-400"
            inputMode="tel"
            autoComplete="username"
            placeholder="0900000001"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            required
          />
        </label>
        <label className="block text-sm font-semibold text-stone-700">
          Mật khẩu
          <input
            className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none placeholder:text-stone-400"
            type="password"
            autoComplete="current-password"
            placeholder="Nhập mật khẩu"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        {error ? <p className="rounded-2xl border border-brand-red/15 px-4 py-3 text-sm font-semibold text-brand-red">{error}</p> : null}

        <button
          type="submit"
          className="neu-button inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting}
        >
          <LogIn className="h-4 w-4" />
          {isSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
      </form>

      {showDemoAccounts ? (
        <div className="content-border mt-6 pt-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-red">Tài khoản demo</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            {demoAccounts.map((account) => (
              <button
                key={account.phone}
                type="button"
                className="neu-list-item rounded-2xl px-3 py-2 text-left text-xs font-semibold text-stone-600 hover:text-brand-red"
                onClick={() => {
                  setPhone(account.phone)
                  setPassword(account.password)
                  setError("")
                }}
              >
                {account.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </>
  )
}
