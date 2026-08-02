"use client"

import { Save, Send } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import type { ApiResponse } from "@/lib/api-response"
import { averageScore } from "@/lib/assessment-scoring"
import {
  finalAssessmentStatusLabels,
  progressLevelDescriptions,
  progressLevelLabels,
  subjectLabels,
  type AssessmentStatusKey,
  type ProgressLevelKey,
  type WeeklyClassAssessmentDetail,
  type WeeklyAssessmentMatrixItem
} from "@/lib/contracts/assessment"
import type { ClassListItem } from "@/lib/contracts/courses"
import { ClassSkillComparisonPanel, FunAssessmentWorkspace, InfoPill, Metric, RoboticsAssessmentWorkspace } from "./assessment-workspaces"

type FinalClassSummary = {
  classId: string
  className: string
  courseName: string
  subject: "FUN" | "ROBOTICS"
  requiredWeeks: number
  students: Array<{
    studentId: string
    studentName: string
    parentName: string
    enrollmentId?: string
    completedWeeks: number
    requiredWeeks: number
    completedDomains?: number
    totalDomains?: number
    missingDomains?: string[]
    finalAssessmentId?: string
    finalStatus?: "DRAFT" | "READY" | "PUBLISHED"
    eligible: boolean
  }>
}

type BulkPublishResult = {
  classId: string
  className: string
  publishedCount: number
  alreadyPublishedCount: number
  skippedCount: number
  skippedStudents: Array<{ studentId: string; studentName: string; reason: string }>
  finalAssessmentId?: string
}

const weekStatusLabels = {
  NOT_DUE: "Chưa tới",
  MISSING: "Cần đánh giá",
  IN_PROGRESS: "Đang làm",
  COMPLETE: "Hoàn thành"
} as const

type AssessmentWorkspaceTab = "score" | "notes" | "summary"

function itemKey(item: { domainKey: string; skillKey: string; outcomeIndex: number }) {
  return `${item.domainKey}:${item.skillKey}:${item.outcomeIndex}`
}

function scoreOutOfFive(items: WeeklyAssessmentMatrixItem["items"]) {
  return averageScore(items)
}

function classRequiredWeeks(klass: ClassListItem) {
  return Math.max(1, klass.generatedSessionCount || klass.plannedSessions || 1)
}

function activeStudentCount(klass: ClassListItem) {
  return klass.students.filter((student) => student.isActive).length
}

function formatDate(value?: string) {
  if (!value) return "-"

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(value))
}

async function readApiResponse<T>(response: Response, fallbackMessage: string): Promise<ApiResponse<T>> {
  const text = await response.text()

  if (!text.trim()) {
    return {
      success: false,
      error: {
        code: "EMPTY_RESPONSE",
        message: fallbackMessage
      }
    }
  }

  try {
    return JSON.parse(text) as ApiResponse<T>
  } catch {
    return {
      success: false,
      error: {
        code: "INVALID_RESPONSE",
        message: fallbackMessage
      }
    }
  }
}

export default function AssessmentsPage() {
  const [classes, setClasses] = useState<ClassListItem[]>([])
  const [classId, setClassId] = useState("")
  const [weekNumber, setWeekNumber] = useState<number | "">("")
  const [requiredWeeks, setRequiredWeeks] = useState(4)
  const [detail, setDetail] = useState<WeeklyClassAssessmentDetail | null>(null)
  const [finalSummary, setFinalSummary] = useState<FinalClassSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingFinalDraft, setIsSavingFinalDraft] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [publishingStudentId, setPublishingStudentId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [selectedFunStudentId, setSelectedFunStudentId] = useState<string | null>(null)
  const [selectedFunDomainKey, setSelectedFunDomainKey] = useState<string | null>(null)
  const [selectedRoboticsStudentId, setSelectedRoboticsStudentId] = useState<string | null>(null)
  const [assessmentTab, setAssessmentTab] = useState<AssessmentWorkspaceTab>("score")

  const selectedClass = classes.find((klass) => klass.id === classId)
  const progress = useMemo(() => {
    if (!detail) return { complete: 0, total: 0 }

    return {
      complete: detail.students.filter((student) => student.status === "COMPLETE").length,
      total: detail.students.length
    }
  }, [detail])
  const finalCounts = useMemo(() => {
    if (!finalSummary) return { eligible: 0, missing: 0, published: 0 }

    return {
      eligible: finalSummary.students.filter((student) => student.eligible).length,
      missing: finalSummary.students.filter((student) => !student.eligible).length,
      published: finalSummary.students.filter((student) => student.finalStatus === "PUBLISHED").length
    }
  }, [finalSummary])

  useEffect(() => {
    let isMounted = true

    async function loadClasses() {
      setIsLoading(true)
      setError("")

      try {
        const response = await fetch("/api/classes?active=true", { cache: "no-store" })
        const payload = await readApiResponse<ClassListItem[]>(response, "Không tải được danh sách lớp.")

        if (!isMounted) return

        if (!response.ok || !payload.success || !payload.data) {
          setError(payload.error?.message ?? "Không tải được danh sách lớp.")
          return
        }

        const initialClass = payload.data?.find((klass) => activeStudentCount(klass) > 0) ?? payload.data?.[0]
        setClasses(payload.data)
        setClassId((current) => current || initialClass?.id || "")
        setRequiredWeeks((current) => (initialClass ? classRequiredWeeks(initialClass) : current))
      } catch {
        if (isMounted) setError("Không tải được danh sách lớp.")
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void loadClasses()

    return () => {
      isMounted = false
    }
  }, [])

  async function loadFinalSummary() {
    const params = new URLSearchParams({ classId, requiredWeeks: String(requiredWeeks) })
    const response = await fetch(`/api/final-assessments/classroom?${params.toString()}`, { cache: "no-store" })
    const payload = await readApiResponse<FinalClassSummary>(response, "Không tải được điều kiện báo cáo cuối khóa.")

    if (response.ok && payload.success && payload.data) {
      setFinalSummary(payload.data)
    }
  }

  useEffect(() => {
    if (!classId) return
    let isMounted = true

    async function loadSelectedClass() {
      const assessmentParams = new URLSearchParams({ classId })
      if (weekNumber) assessmentParams.set("weekNumber", String(weekNumber))
      const finalParams = new URLSearchParams({ classId, requiredWeeks: String(requiredWeeks) })
      const [assessmentResponse, finalResponse] = await Promise.all([
        fetch(`/api/weekly-assessments/classroom?${assessmentParams.toString()}`, { cache: "no-store" }),
        fetch(`/api/final-assessments/classroom?${finalParams.toString()}`, { cache: "no-store" })
      ])
      const assessmentPayload = await readApiResponse<WeeklyClassAssessmentDetail>(assessmentResponse, "Không tải được đánh giá lớp.")
      const finalPayload = await readApiResponse<FinalClassSummary>(finalResponse, "Không tải được điều kiện báo cáo cuối khóa.")

      if (!isMounted) return

      if (!assessmentResponse.ok || !assessmentPayload.success || !assessmentPayload.data) {
        setDetail(null)
        setError(assessmentPayload.error?.message ?? "Không tải được đánh giá lớp.")
      } else {
        setDetail(assessmentPayload.data)
        if (assessmentPayload.data.subject === "FUN") {
          setSelectedFunStudentId((current) =>
            current && assessmentPayload.data?.students.some((student) => student.studentId === current)
              ? current
              : assessmentPayload.data?.students[0]?.studentId ?? null
          )
          setSelectedFunDomainKey((current) =>
            current && assessmentPayload.data?.rubric.domains.some((domain) => domain.key === current)
              ? current
              : assessmentPayload.data?.rubric.domains[0]?.key ?? null
          )
        }
        if (assessmentPayload.data.subject === "ROBOTICS") {
          setSelectedRoboticsStudentId((current) =>
            current && assessmentPayload.data?.students.some((student) => student.studentId === current)
              ? current
              : assessmentPayload.data?.students[0]?.studentId ?? null
          )
        }
        if (weekNumber !== assessmentPayload.data.weekNumber) {
          setWeekNumber(assessmentPayload.data.weekNumber)
        }
      }

      if (finalResponse.ok && finalPayload.success && finalPayload.data) {
        setFinalSummary(finalPayload.data)
      }
    }

    void loadSelectedClass()

    return () => {
      isMounted = false
    }
  }, [classId, weekNumber, requiredWeeks])

  function updateStudent(studentId: string, updater: (student: WeeklyAssessmentMatrixItem) => WeeklyAssessmentMatrixItem) {
    setDetail((current) => {
      if (!current) return current

      return {
        ...current,
        students: current.students.map((student) => (student.studentId === studentId ? updater(student) : student))
      }
    })
  }

  function updateComment(studentId: string, comment: string) {
    updateStudent(studentId, (student) => ({ ...student, comment }))
  }

  function updateFunItem(studentId: string, targetKey: string, updates: Partial<WeeklyAssessmentMatrixItem["items"][number]>) {
    if (!detail) return

    updateStudent(studentId, (student) => {
      const items = student.items.map((item) => (itemKey(item) === targetKey ? { ...item, ...updates } : item))
      const checkedItems = items.filter((item) => item.checked).length
      const domainProgress = detail.rubric.domains.map((domain) => {
        const domainItems = items.filter((item) => item.domainKey === domain.key)
        const domainCheckedItems = domainItems.filter((item) => item.checked).length

        return {
          domainKey: domain.key,
          label: domain.label,
          scoreOutOfFive: scoreOutOfFive(domainItems),
          checkedItems: domainCheckedItems,
          totalItems: domainItems.length,
          status: domainItems.length > 0 && domainCheckedItems >= domainItems.length ? "COMPLETE" as const : domainCheckedItems > 0 ? "IN_PROGRESS" as const : "NOT_STARTED" as const
        }
      })

      return {
        ...student,
        items,
        checkedItems,
        domainProgress,
        status: student.status === "COMPLETE" ? "COMPLETE" : checkedItems > 0 ? "IN_PROGRESS" : "NOT_STARTED"
      }
    })
  }

  function updateRoboticsScore(studentId: string, skillKey: string, score?: number) {
    if (!detail) return

    updateStudent(studentId, (student) => {
      const items = student.items.map((item) =>
        item.skillKey === skillKey
          ? {
              ...item,
              checked: typeof score === "number",
              score,
              progressLevel: undefined
            }
          : item
      )
      const checkedItems = items.filter((item) => item.checked).length
      const domainProgress = detail.rubric.domains.map((domain) => {
        const domainItems = items.filter((item) => item.domainKey === domain.key)
        const domainCheckedItems = domainItems.filter((item) => item.checked).length

        return {
          domainKey: domain.key,
          label: domain.label,
          scoreOutOfFive: scoreOutOfFive(domainItems),
          checkedItems: domainCheckedItems,
          totalItems: domainItems.length,
          status: domainItems.length > 0 && domainCheckedItems >= domainItems.length ? "COMPLETE" as const : domainCheckedItems > 0 ? "IN_PROGRESS" as const : "NOT_STARTED" as const
        }
      })

      return {
        ...student,
        items,
        checkedItems,
        domainProgress,
        status: checkedItems >= student.totalItems && student.totalItems > 0 ? "COMPLETE" : checkedItems > 0 ? "IN_PROGRESS" : "NOT_STARTED"
      }
    })
  }

  function updateStatus(studentId: string, status: AssessmentStatusKey) {
    updateStudent(studentId, (student) => ({ ...student, status }))
  }

  async function saveWeekly() {
    if (!detail) return

    setIsSaving(true)
    setError("")
    setMessage("")

    const assessments = detail.students
      .filter((student) => student.enrollmentId)
      .map((student) => ({
        studentId: student.studentId,
        enrollmentId: student.enrollmentId as string,
        status: student.status,
        comment: student.comment?.trim() || undefined,
        items: student.items
      }))

    const response = await fetch("/api/weekly-assessments/classroom", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        classId: detail.classId,
        weekNumber: Number(weekNumber || detail.weekNumber),
        assessments
      })
    })
    const payload = await readApiResponse<WeeklyClassAssessmentDetail>(response, "Không lưu được đánh giá lớp.")

    setIsSaving(false)

    if (!response.ok || !payload.success || !payload.data) {
      setError(payload.error?.message ?? "Không lưu được đánh giá lớp.")
      return
    }

    setDetail(payload.data)
    setMessage("Đã lưu đánh giá tuần cho lớp.")
    await loadFinalSummary()
  }

  async function publishFinalReports() {
    if (!finalSummary) return

    const shouldSend = window.confirm(
      `Gửi báo cáo cuối khóa cho lớp ${finalSummary.className}?\n\nĐủ điều kiện: ${finalCounts.eligible}\nThiếu dữ liệu: ${finalCounts.missing}\nĐã gửi trước đó: ${finalCounts.published}`
    )

    if (!shouldSend) return

    setIsPublishing(true)
    setError("")
    setMessage("")

    const response = await fetch("/api/final-assessments/classroom", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ classId, requiredWeeks })
    })
    const payload = await readApiResponse<BulkPublishResult>(response, "Không gửi được báo cáo cuối khóa.")

    setIsPublishing(false)

    if (!response.ok || !payload.success || !payload.data) {
      setError(payload.error?.message ?? "Không gửi được báo cáo cuối khóa.")
      return
    }

    setMessage(`Đã gửi ${payload.data.publishedCount} báo cáo. Bỏ qua ${payload.data.skippedCount}, đã gửi trước đó ${payload.data.alreadyPublishedCount}.`)
    await loadFinalSummary()
  }

  async function saveFinalReportDrafts() {
    if (!finalSummary) return

    setIsSavingFinalDraft(true)
    setError("")
    setMessage("")

    try {
      const response = await fetch("/api/final-assessments/classroom", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ classId, requiredWeeks, mode: "DRAFT" })
      })
      const payload = await readApiResponse<BulkPublishResult & { draftCount?: number }>(response, "Không lưu được báo cáo nháp.")

      if (!response.ok || !payload.success || !payload.data) {
        setError(payload.error?.message ?? "Không lưu được báo cáo nháp.")
        return
      }

      setMessage(`Đã lưu ${payload.data.draftCount ?? 0} báo cáo nháp. Bỏ qua ${payload.data.skippedCount} học viên chưa đủ điều kiện.`)
      await loadFinalSummary()
    } catch {
      setError("Không lưu được báo cáo nháp.")
    } finally {
      setIsSavingFinalDraft(false)
    }
  }

  async function publishFinalReportForStudent(student: FinalClassSummary["students"][number]) {
    if (!finalSummary) return

    if (!student.eligible) {
      setError(student.missingDomains?.length ? `Chưa thể gửi: còn thiếu ${student.missingDomains.length} domain FUN.` : `Chưa thể gửi: mới đủ ${student.completedWeeks}/${student.requiredWeeks} tuần.`)
      return
    }

    const shouldSend = window.confirm(
      `Gửi báo cáo cuối khóa riêng cho phụ huynh ${student.parentName}?\n\nHọc sinh: ${student.studentName}\nLớp: ${finalSummary.className}\nTuần hoàn tất: ${student.completedWeeks}/${student.requiredWeeks}`
    )

    if (!shouldSend) return

    setPublishingStudentId(student.studentId)
    setError("")
    setMessage("")

    try {
      const response = await fetch("/api/final-assessments/classroom", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ classId, requiredWeeks, studentId: student.studentId })
      })
      const payload = await readApiResponse<BulkPublishResult>(response, "Không gửi được báo cáo riêng.")

      if (!response.ok || !payload.success || !payload.data) {
        setError(payload.error?.message ?? "Không gửi được báo cáo riêng.")
        return
      }

      if (payload.data.publishedCount > 0) {
        setMessage(`Đã gửi báo cáo cuối khóa cho phụ huynh ${student.parentName}.`)
      } else if (payload.data.alreadyPublishedCount > 0) {
        setMessage(`Báo cáo của ${student.studentName} đã gửi phụ huynh trước đó.`)
      } else {
        setError(payload.data.skippedStudents[0]?.reason ?? "Học sinh chưa đủ điều kiện gửi báo cáo.")
      }

      await loadFinalSummary()
    } catch {
      setError("Không gửi được báo cáo riêng.")
    } finally {
      setPublishingStudentId(null)
    }
  }

  return (
    <main className="space-y-4">
      <section className="neu-card rounded-3xl p-4">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-red">Assessment</p>
            <h1 className="mt-1 text-2xl font-semibold text-brand-red">Đánh giá theo lớp</h1>
            <p className="mt-1 max-w-2xl text-sm text-stone-600">
              Chọn lớp, chọn tuần, chấm theo học sinh. FUN và Robotics dùng cùng bố cục thao tác.
            </p>
          </div>
          <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-[minmax(280px,1fr)_210px_170px]">
            <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500">
              Lớp học
              <select
                className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm font-medium text-brand-ink outline-none"
                value={classId}
                onChange={(event) => {
                  const nextClass = classes.find((klass) => klass.id === event.target.value)
                  setClassId(event.target.value)
                  setWeekNumber("")
                  setSelectedFunStudentId(null)
                  setSelectedFunDomainKey(null)
                  setSelectedRoboticsStudentId(null)
                  setAssessmentTab("score")
                  if (nextClass) setRequiredWeeks(classRequiredWeeks(nextClass))
                }}
              >
                {classes.map((klass) => (
                  <option key={klass.id} value={klass.id}>
                    {klass.name} - {subjectLabels[klass.subject]} - {activeStudentCount(klass)} HS
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500">
              Tuần đánh giá
              {detail?.availableWeeks.length ? (
                <select
                  className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm font-medium text-brand-ink outline-none"
                  value={weekNumber}
                  onChange={(event) => setWeekNumber(Number(event.target.value))}
                >
                  {detail.availableWeeks.map((week) => (
                    <option key={week.weekNumber} value={week.weekNumber}>
                      {week.label} - {weekStatusLabels[week.status]} ({week.completeStudents}/{week.totalStudents})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm font-medium text-brand-ink outline-none"
                  min={1}
                  type="number"
                  value={weekNumber}
                  onChange={(event) => setWeekNumber(Number(event.target.value))}
                />
              )}
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500">
              Tuần cần đủ để gửi
              <input
                className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm font-medium text-brand-ink outline-none"
                readOnly
                value={`${requiredWeeks} tuần`}
                title="Số tuần đánh giá hoàn thành bắt buộc trước khi gửi báo cáo cuối khóa"
              />
            </label>
          </div>
        </div>
        {selectedClass ? (
          <div className="content-border mt-4 grid gap-2 pt-4 text-sm sm:grid-cols-2 xl:grid-cols-5">
            <InfoPill label="Bộ môn tự nhận" value={subjectLabels[selectedClass.subject]} />
            <InfoPill label="Khóa học" value={selectedClass.courseName} />
            <InfoPill label="Học sinh trong lớp" value={`${activeStudentCount(selectedClass)}`} />
            <InfoPill label="Giáo viên" value={selectedClass.teacherName} />
            <InfoPill label="Tuần hệ thống gợi ý" value={detail ? `Tuần ${detail.suggestedWeekNumber}` : "Đang tính"} />
          </div>
        ) : null}
      </section>

      {error ? <p className="rounded-3xl border border-brand-red/15 bg-white/50 p-4 text-sm text-brand-red">{error}</p> : null}
      {message ? <p className="rounded-3xl border border-brand-red/15 bg-white/50 p-4 text-sm font-semibold text-brand-red">{message}</p> : null}

      <section className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="neu-card rounded-3xl">
          <div className="flex flex-col justify-between gap-3 p-4 lg:flex-row lg:items-center">
            <div>
              <h2 className="font-semibold text-brand-ink">Workspace đánh giá</h2>
              <p className="mt-1 text-sm text-stone-500">
                {detail ? `${detail.className} - ${subjectLabels[detail.subject]} - ${progress.complete}/${progress.total} học sinh hoàn tất tuần ${detail.weekNumber}` : "Chọn lớp để bắt đầu đánh giá."}
              </p>
            </div>
            <button
              type="button"
              className="glass-button-primary inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold"
              disabled={!detail || isSaving}
              onClick={() => void saveWeekly()}
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Đang lưu" : "Lưu cả lớp"}
            </button>
          </div>

          <div className="content-border p-3">
            {isLoading ? <p className="rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500">Đang tải lớp học...</p> : null}
            {detail?.subject === "FUN" ? (
              <FunAssessmentWorkspace
                detail={detail}
                selectedStudentId={selectedFunStudentId}
                selectedDomainKey={selectedFunDomainKey}
                onSelectStudent={setSelectedFunStudentId}
                onSelectDomain={setSelectedFunDomainKey}
                onUpdateComment={updateComment}
                onUpdateStatus={updateStatus}
                onUpdateItem={updateFunItem}
                activeTab={assessmentTab}
                onChangeTab={setAssessmentTab}
              />
            ) : detail?.subject === "ROBOTICS" ? (
              <RoboticsAssessmentWorkspace
                detail={detail}
                selectedStudentId={selectedRoboticsStudentId}
                onSelectStudent={setSelectedRoboticsStudentId}
                onUpdateScore={updateRoboticsScore}
                onUpdateComment={updateComment}
                onUpdateStatus={updateStatus}
                activeTab={assessmentTab}
                onChangeTab={setAssessmentTab}
              />
            ) : null}
            {detail && detail.students.length === 0 ? (
              <div className="rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500">
                <p className="font-semibold text-brand-ink">Lớp này chưa có học sinh để đánh giá.</p>
                <p className="mt-1">Hãy chọn lớp khác ở ô `Lớp học`, hoặc vào `Lớp học &gt; Thiết lập` để thêm học sinh vào lớp này.</p>
              </div>
            ) : null}
          </div>
        </div>

        <aside className="space-y-4">
          <ClassSkillComparisonPanel detail={detail} />

          <section className="neu-card rounded-3xl p-5">
            <h2 className="font-semibold text-brand-ink">Báo cáo cuối khóa</h2>
            <p className="mt-1 text-sm text-stone-500">
              {selectedClass ? `${selectedClass.name} - ${subjectLabels[selectedClass.subject]}` : "Chọn lớp để xem điều kiện gửi."}
            </p>
            <p className="mt-2 rounded-2xl border border-brand-red/10 bg-white/45 px-3 py-2 text-xs text-stone-500">
              Đánh giá hàng tuần chỉ lưu nội bộ. Phụ huynh chỉ thấy báo cáo cuối khóa sau khi được gửi.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <Metric label="Đủ" value={finalCounts.eligible} />
              <Metric label="Thiếu" value={finalCounts.missing} />
              <Metric label="Đã gửi" value={finalCounts.published} />
            </div>
            <button
              type="button"
              className="glass-button-primary mt-4 inline-flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-semibold"
              disabled={!finalSummary || isPublishing || isSavingFinalDraft}
              onClick={() => void publishFinalReports()}
            >
              <Send className="h-4 w-4" />
              {isPublishing ? "Đang gửi" : "Tạo & gửi cả lớp"}
            </button>
            <button
              type="button"
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-brand-red/15 bg-white/65 px-4 py-3 text-sm font-semibold text-brand-red transition hover:border-brand-red/35 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!finalSummary || isPublishing || isSavingFinalDraft}
              onClick={() => void saveFinalReportDrafts()}
            >
              {isSavingFinalDraft ? "Đang lưu" : "Lưu bản nháp cả lớp"}
            </button>
          </section>

          <section className="neu-card rounded-3xl p-5">
            <h2 className="font-semibold text-brand-ink">Trạng thái học sinh</h2>
            <div className="mt-4 max-h-[520px] space-y-2 overflow-auto pr-1">
              {finalSummary?.students.map((student) => {
                const isPublished = student.finalStatus === "PUBLISHED"
                const isStudentPublishing = publishingStudentId === student.studentId

                return (
                  <article key={student.studentId} className="rounded-2xl border border-brand-red/10 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-brand-ink">{student.studentName}</p>
                        <p className="mt-1 text-xs text-stone-500">
                          PH: {student.parentName} · {student.completedWeeks}/{student.requiredWeeks} tuần
                        </p>
                        {selectedClass?.subject === "FUN" && student.totalDomains ? (
                          <p className="mt-1 text-xs text-stone-500">
                            FUN domain {student.completedDomains ?? 0}/{student.totalDomains}
                          </p>
                        ) : null}
                      </div>
                      {student.finalAssessmentId ? (
                        <a className="rounded-2xl border border-brand-red/10 px-3 py-2 text-xs font-semibold text-brand-red" href={`/final-assessments/${student.finalAssessmentId}/print`} target="_blank">
                          PDF
                        </a>
                      ) : null}
                    </div>
                    <p className="mt-2 rounded-2xl bg-white/50 px-3 py-2 text-xs font-semibold text-stone-600">
                      {student.finalStatus ? finalAssessmentStatusLabels[student.finalStatus] : student.eligible ? "Đủ điều kiện" : selectedClass?.subject === "FUN" && student.missingDomains?.length ? `Thiếu ${student.missingDomains.length} domain FUN` : "Thiếu đánh giá tuần"}
                    </p>
                    <button
                      type="button"
                      className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-brand-red/10 bg-white/55 px-3 py-2 text-xs font-semibold text-brand-red transition hover:border-brand-red/30 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isPublishing || Boolean(publishingStudentId) || !student.eligible || isPublished}
                      onClick={() => void publishFinalReportForStudent(student)}
                    >
                      <Send className="h-3.5 w-3.5" />
                      {isStudentPublishing ? "Đang gửi" : isPublished ? "Đã gửi phụ huynh" : "Gửi riêng phụ huynh"}
                    </button>
                  </article>
                )
              })}
            </div>
          </section>

          <section className="neu-card rounded-3xl p-5">
            <h2 className="font-semibold text-brand-ink">{detail?.subject === "ROBOTICS" ? "Thang sao Robotics" : "Mức tiến độ"}</h2>
            {detail?.subject === "ROBOTICS" ? (
              <div className="mt-3 space-y-2">
                {[1, 2, 3, 4, 5].map((score) => (
                  <p key={score} className="rounded-2xl border border-brand-red/10 px-3 py-2 text-xs text-stone-500">
                    <span className="font-semibold text-brand-red">{score} sao</span> - {score === 1 ? "cần hỗ trợ nhiều" : score === 3 ? "đạt mức ổn định" : score === 5 ? "vượt trội" : "đang phát triển"}
                  </p>
                ))}
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {Object.entries(progressLevelLabels).map(([key, label]) => (
                  <p key={key} className="rounded-2xl border border-brand-red/10 px-3 py-2 text-xs text-stone-500">
                    <span className="font-semibold text-brand-red">{label}</span> - {progressLevelDescriptions[key as ProgressLevelKey]}
                  </p>
                ))}
              </div>
            )}
            <p className="mt-3 text-xs text-stone-400">Cập nhật: {formatDate(new Date().toISOString())}</p>
          </section>
        </aside>
      </section>

    </main>
  )
}
