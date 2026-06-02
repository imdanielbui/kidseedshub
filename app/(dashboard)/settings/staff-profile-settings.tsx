"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { BriefcaseBusiness, RefreshCcw, Save } from "lucide-react"
import type { ApiResponse } from "@/lib/api-response"
import { employmentTypeLabels, type EmploymentTypeKey, type StaffProfileItem } from "@/lib/contracts/staff-profiles"
import { roleLabels, staffRoles, type StaffRole, type UserListItem } from "@/lib/contracts/users"

type StaffProfileFormState = {
  userId: string
  employmentType: EmploymentTypeKey
  startDate: string
  monthlySalary: string
  hourlyRate: string
  payrollActive: boolean
}

const emptyStaffProfileForm: StaffProfileFormState = {
  userId: "",
  employmentType: "FULL_TIME",
  startDate: new Date().toISOString().slice(0, 10),
  monthlySalary: "",
  hourlyRate: "",
  payrollActive: true
}

function formatMoney(value?: string) {
  if (!value) return "-"

  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
  }).format(Number(value))
}

export function StaffProfileSettings({ users }: { users: UserListItem[] }) {
  const [profiles, setProfiles] = useState<StaffProfileItem[]>([])
  const [form, setForm] = useState<StaffProfileFormState>(emptyStaffProfileForm)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const staffOptions = useMemo(
    () =>
      users.filter((user) => {
        if (!user.isActive) return false

        return staffRoles.includes(user.role as StaffRole)
      }),
    [users]
  )

  useEffect(() => {
    void loadProfiles()
  }, [])

  async function loadProfiles() {
    setIsLoading(true)
    setError("")

    const response = await fetch("/api/staff-profiles", { cache: "no-store" })
    const payload = (await response.json()) as ApiResponse<StaffProfileItem[]>

    if (!response.ok || !payload.success || !payload.data) {
      setProfiles([])
      setError(payload.error?.message ?? "Không tải được hồ sơ lương nhân sự.")
      setIsLoading(false)
      return
    }

    setProfiles(payload.data)
    setIsLoading(false)
  }

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setMessage("")
    setIsSaving(true)

    const response = await fetch("/api/staff-profiles", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId: form.userId,
        employmentType: form.employmentType,
        startDate: form.startDate,
        monthlySalary: form.employmentType === "FULL_TIME" ? form.monthlySalary : undefined,
        hourlyRate: form.employmentType === "PART_TIME" ? form.hourlyRate : undefined,
        payrollActive: form.payrollActive
      })
    })
    const payload = (await response.json()) as ApiResponse<StaffProfileItem>

    setIsSaving(false)

    if (!response.ok || !payload.success || !payload.data) {
      setError(payload.error?.message ?? "Không lưu được hồ sơ lương nhân sự.")
      return
    }

    setMessage("Đã lưu hồ sơ lương nhân sự.")
    setForm(emptyStaffProfileForm)
    await loadProfiles()
  }

  function editProfile(profile: StaffProfileItem) {
    setError("")
    setMessage("")
    setForm({
      userId: profile.userId,
      employmentType: profile.employmentType,
      startDate: profile.startDate.slice(0, 10),
      monthlySalary: profile.monthlySalary ?? "",
      hourlyRate: profile.hourlyRate ?? "",
      payrollActive: profile.payrollActive
    })
  }

  return (
    <section className="neu-card rounded-3xl p-6">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
        <div>
          <h2 className="text-lg font-semibold text-brand-red">Hồ sơ lương nhân sự</h2>
          <p className="mt-1 text-sm text-stone-500">
            Thiết lập lương tháng hoặc đơn giá giờ để payroll sinh dòng lương tự động.
          </p>
        </div>
        <button
          type="button"
          className="neu-list-item inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-stone-600 hover:text-brand-red"
          onClick={() => void loadProfiles()}
        >
          <RefreshCcw className="h-4 w-4" />
          Tải lại
        </button>
      </div>

      {error ? <p className="mt-4 rounded-2xl border border-brand-red/15 bg-white/50 p-4 text-sm text-brand-red">{error}</p> : null}
      {message ? <p className="mt-4 rounded-2xl border border-brand-red/15 bg-white/50 p-4 text-sm font-semibold text-brand-red">{message}</p> : null}

      <form className="content-border mt-5 grid gap-4 pt-5 lg:grid-cols-6" onSubmit={submitProfile}>
        <label className="block text-sm font-semibold text-stone-700 lg:col-span-2">
          Nhân sự
          <select
            className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none"
            value={form.userId}
            onChange={(event) => setForm((current) => ({ ...current, userId: event.target.value }))}
            required
          >
            <option value="">Chọn nhân sự</option>
            {staffOptions.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} - {roleLabels[user.role]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold text-stone-700">
          Loại
          <select
            className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none"
            value={form.employmentType}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                employmentType: event.target.value as EmploymentTypeKey
              }))
            }
          >
            {Object.entries(employmentTypeLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <StaffProfileInput label="Ngày bắt đầu" type="date" value={form.startDate} onChange={(value) => setForm((current) => ({ ...current, startDate: value }))} required />
        {form.employmentType === "FULL_TIME" ? (
          <StaffProfileInput
            label="Lương tháng"
            type="number"
            value={form.monthlySalary}
            onChange={(value) => setForm((current) => ({ ...current, monthlySalary: value }))}
            required
          />
        ) : (
          <StaffProfileInput
            label="Đơn giá giờ"
            type="number"
            value={form.hourlyRate}
            onChange={(value) => setForm((current) => ({ ...current, hourlyRate: value }))}
            required
          />
        )}
        <label className="neu-list-item flex items-center gap-3 self-end rounded-2xl px-4 py-3 text-sm font-semibold text-stone-700">
          <input
            type="checkbox"
            className="h-4 w-4 accent-brand-red"
            checked={form.payrollActive}
            onChange={(event) => setForm((current) => ({ ...current, payrollActive: event.target.checked }))}
          />
          Tính payroll
        </label>
        <button
          type="submit"
          className="glass-button-primary inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 lg:col-start-6"
          disabled={isSaving}
        >
          <Save className="h-4 w-4" />
          {isSaving ? "Đang lưu..." : "Lưu hồ sơ"}
        </button>
      </form>

      <div className="content-border mt-5 space-y-3 pt-5">
        {isLoading ? <p className="rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500">Đang tải hồ sơ lương...</p> : null}
        {!isLoading &&
          profiles.map((profile) => (
            <article key={profile.id} className="neu-list-item rounded-2xl p-4">
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                <div className="flex items-start gap-3">
                  <div className="neu-pressed flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl">
                    <BriefcaseBusiness className="h-5 w-5 text-brand-red" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-brand-ink">{profile.staffName}</h3>
                      <span className="rounded-full border border-brand-red/15 px-2 py-1 text-xs font-semibold text-brand-red">
                        {employmentTypeLabels[profile.employmentType]}
                      </span>
                      <span className="rounded-full border border-brand-red/10 px-2 py-1 text-xs text-stone-500">
                        {profile.payrollActive ? "Payroll active" : "Payroll inactive"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-stone-500">
                      {profile.employmentType === "FULL_TIME" ? formatMoney(profile.monthlySalary) : `${formatMoney(profile.hourlyRate)}/giờ`} - bắt đầu {new Date(profile.startDate).toLocaleDateString("vi-VN")}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="neu-list-item rounded-2xl px-3 py-2 text-sm font-semibold text-stone-600 hover:text-brand-red"
                  onClick={() => editProfile(profile)}
                >
                  Sửa
                </button>
              </div>
            </article>
          ))}
        {!isLoading && profiles.length === 0 ? <p className="rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500">Chưa có hồ sơ lương nhân sự.</p> : null}
      </div>
    </section>
  )
}

function StaffProfileInput({
  label,
  value,
  onChange,
  type = "text",
  required = false
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  required?: boolean
}) {
  return (
    <label className="block text-sm font-semibold text-stone-700">
      {label}
      <input
        className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none placeholder:text-stone-400"
        min={type === "number" ? "0" : undefined}
        step={type === "number" ? "1000" : undefined}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      />
    </label>
  )
}
