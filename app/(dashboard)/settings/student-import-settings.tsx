"use client"

import { ChangeEvent, useState } from "react"
import { FileSpreadsheet, UploadCloud } from "lucide-react"
import type { ApiResponse } from "@/lib/api-response"
import type { StudentImportResult } from "@/lib/contracts/imports"

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? "")
      resolve(result.includes(",") ? result.split(",")[1] : result)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function StudentImportSettings() {
  const [fileName, setFileName] = useState("")
  const [fileBase64, setFileBase64] = useState("")
  const [result, setResult] = useState<StudentImportResult | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    setResult(null)
    setError("")

    if (!file) return

    setFileName(file.name)
    setFileBase64(await fileToBase64(file))
  }

  async function submitImport(mode: "preview" | "commit") {
    if (!fileName || !fileBase64) {
      setError("Chọn file Excel trước khi import.")
      return
    }

    setIsSaving(true)
    setError("")

    try {
      const response = await fetch("/api/imports/students", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, fileName, fileBase64 })
      })
      const payload = (await response.json()) as ApiResponse<StudentImportResult>

      if (!response.ok || !payload.success || !payload.data) {
        setError(payload.error?.message ?? "Không xử lý được file import.")
        return
      }

      setResult(payload.data)
    } catch {
      setError("Không xử lý được file import.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="neu-card rounded-3xl p-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h2 className="text-lg font-semibold text-brand-red">Import học viên từ Excel</h2>
          <p className="mt-1 text-sm text-stone-500">Cột hỗ trợ: studentName, parentName, parentPhone, parentEmail, status, leadSource, healthNote.</p>
        </div>
        <FileSpreadsheet className="h-5 w-5 text-brand-red" />
      </div>

      <div className="content-border mt-5 grid gap-3 pt-5 lg:grid-cols-[1fr_auto_auto] lg:items-end">
        <label className="block text-sm font-semibold text-stone-700">
          File .xlsx
          <input
            className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none"
            type="file"
            accept=".xlsx"
            onChange={(event) => void selectFile(event)}
          />
        </label>
        <button
          type="button"
          className="neu-list-item inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-stone-600 hover:text-brand-red disabled:opacity-50"
          disabled={isSaving || !fileBase64}
          onClick={() => void submitImport("preview")}
        >
          <UploadCloud className="h-4 w-4" />
          Preview
        </button>
        <button
          type="button"
          className="glass-button-primary inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold disabled:opacity-50"
          disabled={isSaving || !result || result.invalidRows > 0 || result.mode === "commit"}
          onClick={() => void submitImport("commit")}
        >
          Import
        </button>
      </div>

      {error ? <p className="mt-4 rounded-2xl border border-brand-red/15 p-3 text-sm text-brand-red">{error}</p> : null}
      {result ? (
        <div className="content-border mt-5 space-y-3 pt-5">
          <div className="grid gap-2 text-sm sm:grid-cols-4">
            <span className="rounded-2xl border border-brand-red/10 px-3 py-2">Tổng {result.totalRows}</span>
            <span className="rounded-2xl border border-brand-red/10 px-3 py-2">Hợp lệ {result.validRows}</span>
            <span className="rounded-2xl border border-brand-red/10 px-3 py-2">Lỗi {result.invalidRows}</span>
            <span className="rounded-2xl border border-brand-red/10 px-3 py-2">Đã tạo {result.createdStudents}</span>
          </div>
          <div className="max-h-80 space-y-2 overflow-auto">
            {result.rows.slice(0, 20).map((row) => (
              <article key={`${row.rowNumber}-${row.studentName}`} className="rounded-2xl border border-brand-red/10 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-brand-ink">
                    Dòng {row.rowNumber}: {row.studentName || "(thiếu tên)"}
                  </p>
                  <span className={row.errors.length ? "text-brand-red" : "text-stone-500"}>
                    {row.errors.length ? row.errors.join(", ") : "OK"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-stone-500">
                  PH {row.parentName} - {row.parentPhone} - {row.status}
                </p>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
