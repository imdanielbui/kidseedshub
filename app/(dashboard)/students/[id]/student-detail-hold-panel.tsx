"use client"

import { PauseCircle, PlayCircle } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { DialogFormShell } from "@/components/shared/dialog-shell"
import type { ApiResponse } from "@/lib/api-response"
import type { ClassListItem } from "@/lib/contracts/courses"
import type { EnrollmentHoldItem } from "@/lib/contracts/enrollment-holds"
import type { StudentDetail } from "@/lib/contracts/students"

type HoldDraft = { enrollmentId: string; months: string; reason: string }

export function StudentEnrollmentHoldPanel({ student, classes, formatCurrency, formatDate }: { student: StudentDetail; classes: ClassListItem[]; formatCurrency: (value: number) => string; formatDate: (value: string) => string }) {
  const [holds, setHolds] = useState<EnrollmentHoldItem[]>([])
  const [draft, setDraft] = useState<HoldDraft | null>(null)
  const [resuming, setResuming] = useState<EnrollmentHoldItem | null>(null)
  const [classId, setClassId] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const load = useCallback(async () => {
    const response = await fetch(`/api/enrollment-holds?studentId=${student.id}`, { cache: "no-store" })
    const payload = await response.json() as ApiResponse<EnrollmentHoldItem[]>
    if (response.ok && payload.success && payload.data) setHolds(payload.data)
  }, [student.id])
  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])
  const submitHold = async () => {
    if (!draft) return
    setIsSaving(true); setError("")
    const response = await fetch("/api/enrollment-holds", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ enrollmentId: draft.enrollmentId, holdMonths: Number(draft.months), reason: draft.reason }) })
    const payload = await response.json() as ApiResponse<EnrollmentHoldItem>
    if (!response.ok || !payload.success) setError(payload.error?.message ?? "Không bảo lưu được học phí.")
    else { setDraft(null); await load(); window.location.reload() }
    setIsSaving(false)
  }
  const submitResume = async () => {
    if (!resuming || !classId) return
    setIsSaving(true); setError("")
    const response = await fetch(`/api/enrollment-holds/${resuming.id}/resume`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ classId }) })
    const payload = await response.json() as ApiResponse<EnrollmentHoldItem>
    if (!response.ok || !payload.success) setError(payload.error?.message ?? "Không mở lại được bảo lưu.")
    else { setResuming(null); setClassId(""); await load(); window.location.reload() }
    setIsSaving(false)
  }
  const activeHolds = holds.filter((hold) => hold.status === "ACTIVE")
  return <section className="neu-card rounded-3xl"><div className="flex items-start justify-between gap-3 p-5"><div><h2 className="font-semibold text-brand-ink">Bảo lưu học phí</h2><p className="mt-1 text-sm text-stone-500">Tạm dừng lớp, giữ quyền học trong thời hạn đã chọn.</p></div><span className="rounded-2xl border border-brand-red/10 px-3 py-2 text-xs font-semibold text-brand-red">{activeHolds.length} còn hiệu lực</span></div><div className="content-border space-y-3 p-5">{student.courses.filter((course) => course.isActive).map((course) => <div key={course.enrollmentId} className="neu-list-item flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4"><div><p className="text-sm font-semibold text-brand-ink">{course.courseName}</p><p className="mt-1 text-xs text-stone-500">Còn {course.sessionsRemaining} buổi · Giá trị đối soát {formatCurrency(course.courseTotalSessions ? Number(course.coursePrice) / course.courseTotalSessions * course.sessionsRemaining : 0)}</p></div><button type="button" onClick={() => setDraft({ enrollmentId: course.enrollmentId, months: "1", reason: "" })} className="glass-button-secondary inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold"><PauseCircle className="h-4 w-4" />Bảo lưu</button></div>)}{holds.map((hold) => <div key={hold.id} className="rounded-2xl border border-brand-red/10 bg-white/45 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-brand-ink">{hold.courseName} · {hold.status === "ACTIVE" ? "Đang bảo lưu" : hold.status === "RESUMED" ? "Đã mở lại" : "Đã hết hạn"}</p><p className="mt-1 text-xs text-stone-500">{hold.remainingSessions} buổi · {formatCurrency(Number(hold.creditAmount))} · hết hạn {formatDate(hold.expiresAt)}</p><p className="mt-1 text-xs text-stone-500">Lý do: {hold.reason}</p></div>{hold.status === "ACTIVE" ? <button type="button" onClick={() => { setResuming(hold); setClassId(hold.sourceClassName ? classes.find((klass) => klass.name === hold.sourceClassName)?.id ?? "" : "") }} className="glass-button-primary inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold"><PlayCircle className="h-4 w-4" />Mở lại</button> : null}</div></div>)}</div>
    {draft ? <DialogFormShell eyebrow="Bảo lưu học phí" title="Tạm dừng lớp học" description="Bé sẽ được rút khỏi lớp và không xuất hiện trong điểm danh. Hết thời hạn, quyền học này không còn hiệu lực." onClose={() => setDraft(null)} onSubmit={(event) => { event.preventDefault(); void submitHold() }} footer={<div className="flex justify-end gap-2"><button type="button" onClick={() => setDraft(null)} className="glass-button-secondary px-4 py-3 text-sm font-semibold">Hủy</button><button type="submit" disabled={isSaving || !draft.reason.trim()} className="glass-button-primary px-4 py-3 text-sm font-semibold disabled:opacity-60">{isSaving ? "Đang lưu" : "Xác nhận bảo lưu"}</button></div>}><div className="space-y-4 p-5"><label className="block text-sm font-semibold text-stone-700">Số tháng bảo lưu<input type="number" min={1} max={24} value={draft.months} onChange={(event) => setDraft({ ...draft, months: event.target.value })} className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 outline-none" /></label><label className="block text-sm font-semibold text-stone-700">Lý do<input value={draft.reason} onChange={(event) => setDraft({ ...draft, reason: event.target.value })} className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 outline-none" required /></label>{error ? <p className="text-sm text-brand-red">{error}</p> : null}</div></DialogFormShell> : null}
    {resuming ? <DialogFormShell eyebrow="Mở lại bảo lưu" title={resuming.courseName} description="Chọn lớp cũ hoặc lớp khác đang mở trong cùng khóa." onClose={() => setResuming(null)} onSubmit={(event) => { event.preventDefault(); void submitResume() }} footer={<div className="flex justify-end gap-2"><button type="button" onClick={() => setResuming(null)} className="glass-button-secondary px-4 py-3 text-sm font-semibold">Hủy</button><button type="submit" disabled={isSaving || !classId} className="glass-button-primary px-4 py-3 text-sm font-semibold disabled:opacity-60">{isSaving ? "Đang mở lại" : "Mở lại lớp"}</button></div>}><div className="space-y-4 p-5"><label className="block text-sm font-semibold text-stone-700">Lớp học<select value={classId} onChange={(event) => setClassId(event.target.value)} className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 outline-none"><option value="">Chọn lớp</option>{classes.filter((klass) => klass.isActive && klass.courseId === student.courses.find((course) => course.enrollmentId === resuming.enrollmentId)?.courseId).map((klass) => <option key={klass.id} value={klass.id}>{klass.code ? `${klass.code} · ` : ""}{klass.name}</option>)}</select></label>{error ? <p className="text-sm text-brand-red">{error}</p> : null}</div></DialogFormShell> : null}
  </section>
}
