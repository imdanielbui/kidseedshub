"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { BookOpenCheck, BriefcaseBusiness, FileSpreadsheet, History, KeyRound, RefreshCcw, Save, ShieldCheck, SlidersHorizontal, UserCog } from "lucide-react"
import { CourseSettings } from "./course-settings"
import { PermissionMatrixSettings } from "./permission-matrix-settings"
import { RubricSettings } from "./rubric-settings"
import { StaffProfileSettings } from "./staff-profile-settings"
import { StudentImportSettings } from "./student-import-settings"
import type { ApiResponse } from "@/lib/api-response"
import type { AuditLogItem } from "@/lib/contracts/operations"
import { roleLabels, staffRoles, type StaffRole, type UserListItem } from "@/lib/contracts/users"

type UserFormState = {
  id?: string
  name: string
  phone: string
  email: string
  role: StaffRole
  password: string
  isActive: boolean
}

const emptyForm: UserFormState = {
  name: "",
  phone: "",
  email: "",
  role: "TEACHER",
  password: "",
  isActive: true
}

const settingsTabs = [
  { id: "accounts", label: "Tài khoản", icon: UserCog },
  { id: "courses", label: "Khóa học", icon: BookOpenCheck },
  { id: "rubrics", label: "Rubric", icon: SlidersHorizontal },
  { id: "imports", label: "Import", icon: FileSpreadsheet },
  { id: "permissions", label: "Phân quyền", icon: KeyRound },
  { id: "staff", label: "Nhân sự", icon: BriefcaseBusiness },
  { id: "audit", label: "Audit log", icon: History }
] as const

type SettingsTab = (typeof settingsTabs)[number]["id"]

export default function SettingsPage() {
  const [users, setUsers] = useState<UserListItem[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([])
  const [form, setForm] = useState<UserFormState>(emptyForm)
  const [activeTab, setActiveTab] = useState<SettingsTab>("accounts")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const activeCount = useMemo(() => users.filter((user) => user.isActive).length, [users])
  const isEditing = Boolean(form.id)

  useEffect(() => {
    void loadUsers()
    void loadAuditLogs()
  }, [])

  async function loadUsers() {
    setIsLoading(true)
    setError("")

    const response = await fetch("/api/users")
    const payload = (await response.json()) as ApiResponse<UserListItem[]>

    if (!payload.success || !payload.data) {
      setError(payload.error?.message ?? "Không tải được danh sách tài khoản.")
      setUsers([])
      setIsLoading(false)
      return
    }

    setUsers(payload.data)
    setIsLoading(false)
  }

  async function loadAuditLogs() {
    const response = await fetch("/api/audit-logs?limit=12", { cache: "no-store" })
    const payload = (await response.json()) as ApiResponse<AuditLogItem[]>

    if (payload.success && payload.data) {
      setAuditLogs(payload.data)
    }
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setMessage("")
    setIsSaving(true)

    const body = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || undefined,
      role: form.role,
      isActive: form.isActive,
      ...(form.password ? { password: form.password } : {})
    }

    if (!isEditing && !form.password) {
      setError("Mật khẩu là bắt buộc khi tạo tài khoản mới.")
      setIsSaving(false)
      return
    }

    const response = await fetch(isEditing ? `/api/users/${form.id}` : "/api/users", {
      method: isEditing ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    })
    const payload = (await response.json()) as ApiResponse<UserListItem>

    setIsSaving(false)

    if (!payload.success || !payload.data) {
      setError(payload.error?.message ?? "Không lưu được tài khoản.")
      return
    }

    setMessage(isEditing ? "Đã cập nhật tài khoản." : "Đã tạo tài khoản mới.")
    setForm(emptyForm)
    await loadUsers()
    await loadAuditLogs()
  }

  async function toggleActive(user: UserListItem) {
    setError("")
    setMessage("")

    const response = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: !user.isActive })
    })
    const payload = (await response.json()) as ApiResponse<UserListItem>

    if (!payload.success) {
      setError(payload.error?.message ?? "Không cập nhật được trạng thái tài khoản.")
      return
    }

    setMessage(user.isActive ? "Đã tắt tài khoản." : "Đã bật lại tài khoản.")
    await loadUsers()
    await loadAuditLogs()
  }

  function editUser(user: UserListItem) {
    setError("")
    setMessage("")
    setForm({
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email ?? "",
      role: user.role as StaffRole,
      password: "",
      isActive: user.isActive
    })
  }

  return (
    <div className="space-y-4">
      <section className="neu-card rounded-3xl p-4 md:p-5">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-red">Settings</p>
            <h1 className="mt-2 text-2xl font-semibold text-brand-red md:text-3xl">Cài đặt hệ thống</h1>
            <p className="mt-2 max-w-2xl text-sm text-stone-600">Quản lý tài khoản, khóa học, rubric, import, phân quyền và hồ sơ nhân sự theo từng tab.</p>
          </div>
          <div className="neu-pressed inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-brand-red">
            <ShieldCheck className="h-4 w-4" />
            {activeCount}/{users.length} đang hoạt động
          </div>
        </div>
        <div className="content-border mt-5 pt-4">
          <div className="neu-pressed flex gap-1 overflow-x-auto rounded-2xl p-1" role="tablist" aria-label="Settings sections">
            {settingsTabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id

              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`settings-panel-${tab.id}`}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    isActive ? "bg-brand-red text-white" : "text-stone-600 hover:text-brand-red"
                  }`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {error ? <p className="rounded-3xl border border-brand-red/15 bg-white/50 p-4 text-sm text-brand-red">{error}</p> : null}
      {message ? <p className="rounded-3xl border border-brand-red/15 bg-white/50 p-4 text-sm font-semibold text-brand-red">{message}</p> : null}

      <div className="max-h-[calc(100vh-290px)] min-h-[420px] overflow-y-auto pr-1">
        <div
          id="settings-panel-accounts"
          role="tabpanel"
          className={activeTab === "accounts" ? "grid gap-4 xl:grid-cols-[minmax(320px,0.95fr)_minmax(0,1.35fr)]" : "hidden"}
        >
          <form className="neu-card rounded-3xl p-5" onSubmit={submitForm}>
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
              <div>
                <h2 className="text-lg font-semibold text-brand-red">{isEditing ? "Sửa tài khoản nhân sự" : "Tạo tài khoản nhân sự"}</h2>
                <p className="mt-1 text-sm text-stone-500">
                  {isEditing ? "Để trống mật khẩu nếu không muốn reset." : "V1 chỉ tạo tài khoản Admin, Sale và Teacher."}
                </p>
              </div>
              {isEditing ? (
                <button
                  type="button"
                  className="neu-list-item inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold text-stone-600 hover:text-brand-red"
                  onClick={() => setForm(emptyForm)}
                >
                  Tạo mới
                </button>
              ) : null}
            </div>

            <div className="content-border mt-5 grid gap-4 pt-5 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <SettingsInput label="Tên" value={form.name} onChange={(value) => setForm((current) => ({ ...current, name: value }))} required />
              <SettingsInput label="Số điện thoại" value={form.phone} onChange={(value) => setForm((current) => ({ ...current, phone: value }))} required />
              <SettingsInput label="Email" type="email" value={form.email} onChange={(value) => setForm((current) => ({ ...current, email: value }))} />
              <label className="block text-sm font-semibold text-stone-700">
                Role
                <select
                  className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none"
                  value={form.role}
                  onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as StaffRole }))}
                >
                  {staffRoles.map((role) => (
                    <option key={role} value={role}>
                      {roleLabels[role]}
                    </option>
                  ))}
                </select>
              </label>
              <SettingsInput
                label={isEditing ? "Mật khẩu mới" : "Mật khẩu"}
                type="password"
                value={form.password}
                onChange={(value) => setForm((current) => ({ ...current, password: value }))}
                required={!isEditing}
              />
              <label className="neu-list-item flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-stone-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand-red"
                  checked={form.isActive}
                  onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                />
                Tài khoản đang hoạt động
              </label>
            </div>

            <button
              type="submit"
              className="glass-button-primary mt-5 inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSaving}
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Đang lưu..." : isEditing ? "Lưu thay đổi" : "Tạo tài khoản"}
            </button>
          </form>

          <section className="neu-card rounded-3xl p-5">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
              <div>
                <h2 className="text-lg font-semibold text-brand-red">Danh sách nhân sự</h2>
                <p className="mt-1 text-sm text-stone-500">Tài khoản staff đang được dùng cho CRM, lớp học, payroll và báo cáo.</p>
              </div>
              <button
                type="button"
                className="neu-list-item inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-stone-600 hover:text-brand-red"
                onClick={() => void loadUsers()}
              >
                <RefreshCcw className="h-4 w-4" />
                Tải lại
              </button>
            </div>

            <div className="content-border mt-5 max-h-[560px] space-y-3 overflow-y-auto pr-1 pt-5">
              {isLoading ? <p className="rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500">Đang tải tài khoản...</p> : null}
              {!isLoading &&
                users.map((user) => (
                  <article key={user.id} className="neu-list-item rounded-2xl p-4">
                    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="neu-pressed flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl">
                          <UserCog className="h-5 w-5 text-brand-red" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-brand-ink">{user.name}</h3>
                            <span className="rounded-full border border-brand-red/15 px-2 py-1 text-xs font-semibold text-brand-red">
                              {roleLabels[user.role]}
                            </span>
                            <span className="rounded-full border border-brand-red/10 px-2 py-1 text-xs text-stone-500">
                              {user.isActive ? "Active" : "Inactive"}
                            </span>
                          </div>
                          <p className="mt-1 truncate text-sm text-stone-500">
                            {user.phone}
                            {user.email ? ` - ${user.email}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <button
                          type="button"
                          className="neu-list-item rounded-2xl px-3 py-2 text-sm font-semibold text-stone-600 hover:text-brand-red"
                          onClick={() => editUser(user)}
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          className="neu-list-item rounded-2xl px-3 py-2 text-sm font-semibold text-stone-600 hover:text-brand-red"
                          onClick={() => void toggleActive(user)}
                        >
                          {user.isActive ? "Tắt" : "Bật"}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              {!isLoading && users.length === 0 ? <p className="rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500">Chưa có tài khoản nhân sự.</p> : null}
            </div>
          </section>
        </div>

        <div id="settings-panel-courses" role="tabpanel" className={activeTab === "courses" ? "block" : "hidden"}>
          <CourseSettings />
        </div>
        <div id="settings-panel-rubrics" role="tabpanel" className={activeTab === "rubrics" ? "block" : "hidden"}>
          <RubricSettings />
        </div>
        <div id="settings-panel-imports" role="tabpanel" className={activeTab === "imports" ? "block" : "hidden"}>
          <StudentImportSettings />
        </div>
        <div id="settings-panel-permissions" role="tabpanel" className={activeTab === "permissions" ? "block" : "hidden"}>
          <PermissionMatrixSettings />
        </div>
        <div id="settings-panel-staff" role="tabpanel" className={activeTab === "staff" ? "block" : "hidden"}>
          <StaffProfileSettings users={users} />
        </div>
        <div id="settings-panel-audit" role="tabpanel" className={activeTab === "audit" ? "block" : "hidden"}>
          <section className="neu-card rounded-3xl p-5">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
              <div>
                <h2 className="text-lg font-semibold text-brand-red">Log hoạt động</h2>
                <p className="mt-1 text-sm text-stone-500">Audit trail cho các thao tác quan trọng trong vận hành.</p>
              </div>
              <button
                type="button"
                className="neu-list-item inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-stone-600 hover:text-brand-red"
                onClick={() => void loadAuditLogs()}
              >
                <History className="h-4 w-4" />
                Tải log
              </button>
            </div>
            <div className="content-border mt-5 max-h-[620px] space-y-3 overflow-y-auto pr-1 pt-5">
              {auditLogs.map((log) => (
                <article key={log.id} className="neu-list-item rounded-2xl p-4">
                  <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center">
                    <div>
                      <p className="text-sm font-semibold text-brand-ink">{log.summary}</p>
                      <p className="mt-1 text-xs text-stone-500">
                        {log.actorName} - {log.action} - {log.entityType}
                      </p>
                    </div>
                    <span className="text-xs text-stone-400">{new Date(log.createdAt).toLocaleString("vi-VN")}</span>
                  </div>
                </article>
              ))}
              {auditLogs.length === 0 ? <p className="rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500">Chưa có log hoạt động.</p> : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function SettingsInput({
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
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      />
    </label>
  )
}
