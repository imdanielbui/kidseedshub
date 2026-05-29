"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { History, RefreshCcw, Save, ShieldCheck, UserCog } from "lucide-react"
import { CourseSettings } from "./course-settings"
import { PermissionMatrixSettings } from "./permission-matrix-settings"
import { RubricSettings } from "./rubric-settings"
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

export default function SettingsPage() {
  const [users, setUsers] = useState<UserListItem[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([])
  const [form, setForm] = useState<UserFormState>(emptyForm)
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
    <div className="space-y-6">
      <section className="neu-card rounded-3xl p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-red">Settings</p>
        <div className="mt-2 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="text-3xl font-semibold text-brand-red">Quản lý tài khoản</h1>
            <p className="mt-2 text-sm text-stone-600">Admin tạo nhân sự, phân role cố định và reset mật khẩu khi cần.</p>
          </div>
          <div className="neu-pressed inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-brand-red">
            <ShieldCheck className="h-4 w-4" />
            {activeCount}/{users.length} đang hoạt động
          </div>
        </div>
      </section>

      {error ? <p className="rounded-3xl border border-brand-red/15 bg-white/50 p-4 text-sm text-brand-red">{error}</p> : null}
      {message ? <p className="rounded-3xl border border-brand-red/15 bg-white/50 p-4 text-sm font-semibold text-brand-red">{message}</p> : null}

      <CourseSettings />
      <RubricSettings />
      <StudentImportSettings />
      <PermissionMatrixSettings />

      <section className="neu-card rounded-3xl p-6">
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
        <div className="content-border mt-5 space-y-3 pt-5">
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

      <form className="neu-card rounded-3xl p-6" onSubmit={submitForm}>
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

        <div className="content-border mt-5 grid gap-4 pt-5 md:grid-cols-2">
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

      <section className="neu-card rounded-3xl p-6">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <h2 className="text-lg font-semibold text-brand-red">Danh sách nhân sự</h2>
          <button
            type="button"
            className="neu-list-item inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-stone-600 hover:text-brand-red"
            onClick={() => void loadUsers()}
          >
            <RefreshCcw className="h-4 w-4" />
            Tải lại
          </button>
        </div>

        <div className="content-border mt-5 space-y-3 pt-5">
          {isLoading ? <p className="rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500">Đang tải tài khoản...</p> : null}
          {!isLoading &&
            users.map((user) => (
              <article key={user.id} className="neu-list-item rounded-2xl p-4">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                  <div className="flex items-start gap-3">
                    <div className="neu-pressed flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl">
                      <UserCog className="h-5 w-5 text-brand-red" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-brand-ink">{user.name}</h3>
                        <span className="rounded-full border border-brand-red/15 px-2 py-1 text-xs font-semibold text-brand-red">
                          {roleLabels[user.role]}
                        </span>
                        <span className="rounded-full border border-brand-red/10 px-2 py-1 text-xs text-stone-500">
                          {user.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-stone-500">
                        {user.phone}
                        {user.email ? ` - ${user.email}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
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
