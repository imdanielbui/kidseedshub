import { Suspense } from "react"
import { BrandLogo } from "@/components/shared/brand-logo"
import { LoginForm } from "./login-form"

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <section className="neu-panel w-full max-w-md rounded-3xl p-8">
        <BrandLogo className="mb-6 flex w-full justify-center" imageClassName="block h-24 w-auto max-w-full object-contain" />
        <h1 className="text-2xl font-semibold text-brand-red">Đăng nhập hệ thống</h1>
        <p className="mt-2 text-sm text-stone-600">Dùng tài khoản đã seed để kiểm tra CRM, lớp học, đánh giá và tài chính.</p>
        <Suspense fallback={<p className="mt-6 rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500">Đang tải form đăng nhập...</p>}>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  )
}
