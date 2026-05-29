"use client"

import { useCallback, useEffect, useState } from "react"
import { ShieldCheck } from "lucide-react"
import type { ApiResponse } from "@/lib/api-response"
import type { PermissionMatrixRow } from "@/lib/contracts/permissions"
import { roleLabels } from "@/lib/contracts/users"
import { roles, type Role } from "@/lib/permissions"

export function PermissionMatrixSettings() {
  const [rows, setRows] = useState<PermissionMatrixRow[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const loadMatrix = useCallback(async () => {
    const response = await fetch("/api/permission-matrix", { cache: "no-store" })
    const payload = (await response.json()) as ApiResponse<PermissionMatrixRow[]>

    if (!payload.success || !payload.data) {
      setError(payload.error?.message ?? "Không tải được ma trận phân quyền.")
      return
    }

    setRows(payload.data)
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadMatrix(), 0)
    return () => window.clearTimeout(timeout)
  }, [loadMatrix])

  function toggleRole(permission: string, role: Role) {
    setRows((current) =>
      current.map((row) => {
        if (row.permission !== permission) return row
        const hasRole = row.roles.includes(role)
        const nextRoles = hasRole ? row.roles.filter((item) => item !== role) : [...row.roles, role]
        return { ...row, roles: nextRoles.length ? nextRoles : row.roles }
      })
    )
  }

  async function saveMatrix() {
    setIsSaving(true)
    setError("")
    setMessage("")

    const response = await fetch("/api/permission-matrix", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entries: rows.map((row) => ({ permission: row.permission, roles: row.roles }))
      })
    })
    const payload = (await response.json()) as ApiResponse<PermissionMatrixRow[]>
    setIsSaving(false)

    if (!payload.success || !payload.data) {
      setError(payload.error?.message ?? "Không lưu được ma trận phân quyền.")
      return
    }

    setRows(payload.data)
    setMessage("Đã lưu ma trận phân quyền.")
  }

  return (
    <section className="neu-card rounded-3xl p-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h2 className="text-lg font-semibold text-brand-red">Ma trận phân quyền</h2>
          <p className="mt-1 text-sm text-stone-500">Phase 2 dynamic matrix: lưu DB và áp runtime cho các guard `can()` trong process hiện tại.</p>
        </div>
        <button
          type="button"
          className="glass-button-primary inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold disabled:opacity-50"
          disabled={isSaving || rows.length === 0}
          onClick={() => void saveMatrix()}
        >
          <ShieldCheck className="h-4 w-4" />
          {isSaving ? "Đang lưu" : "Lưu quyền"}
        </button>
      </div>

      {error ? <p className="mt-4 rounded-2xl border border-brand-red/15 p-3 text-sm text-brand-red">{error}</p> : null}
      {message ? <p className="mt-4 rounded-2xl border border-brand-red/15 p-3 text-sm font-semibold text-brand-red">{message}</p> : null}

      <div className="content-border mt-5 max-h-[520px] space-y-2 overflow-auto pt-5">
        {rows.map((row) => (
          <article key={row.permission} className="grid gap-3 rounded-2xl border border-brand-red/10 p-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-brand-ink">{row.label}</p>
              <p className="mt-1 truncate text-xs text-stone-500">{row.permission}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {roles.map((role) => (
                <label key={role} className="neu-list-item inline-flex cursor-pointer items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold text-stone-600">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-brand-red"
                    checked={row.roles.includes(role)}
                    onChange={() => toggleRole(row.permission, role)}
                  />
                  {roleLabels[role]}
                </label>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
