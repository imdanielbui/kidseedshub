"use client"

import { Save, Send, Star } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from "recharts"
import type { ApiResponse } from "@/lib/api-response"
import { assessmentItemScore, averageScore, skillDescriptionForAge, skillScoreComment } from "@/lib/assessment-scoring"
import {
  assessmentStatusLabels,
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

function formatScore(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function classRequiredWeeks(klass: ClassListItem) {
  return Math.max(1, klass.generatedSessionCount || klass.plannedSessions || 1)
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

        const initialClass = payload.data?.find((klass) => klass.students.length > 0) ?? payload.data?.[0]
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
                    {klass.name} - {subjectLabels[klass.subject]} - {klass.students.length} HS
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
            <InfoPill label="Học sinh trong lớp" value={`${selectedClass.students.length}`} />
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
              disabled={!finalSummary || isPublishing}
              onClick={() => void publishFinalReports()}
            >
              <Send className="h-4 w-4" />
              {isPublishing ? "Đang gửi" : "Tạo & gửi cả lớp"}
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

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-brand-red/10 bg-white/40 px-3 py-2">
      <p className="text-lg font-semibold text-brand-red">{value}</p>
      <p className="text-stone-500">{label}</p>
    </div>
  )
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-brand-red/10 bg-white/35 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">{label}</p>
      <p className="mt-1 truncate font-semibold text-brand-ink">{value}</p>
    </div>
  )
}

function AssessmentTabs({
  activeTab,
  onChangeTab,
  summaryLabel
}: {
  activeTab: AssessmentWorkspaceTab
  onChangeTab: (tab: AssessmentWorkspaceTab) => void
  summaryLabel: string
}) {
  const tabs: Array<{ key: AssessmentWorkspaceTab; label: string }> = [
    { key: "score", label: "Chấm nhanh" },
    { key: "notes", label: "Nhận xét" },
    { key: "summary", label: summaryLabel }
  ]

  return (
    <div className="mt-3 grid gap-2 rounded-3xl border border-brand-red/10 bg-white/40 p-1.5 sm:grid-cols-3">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={`rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
            activeTab === tab.key
              ? "bg-brand-red text-white shadow-[0_10px_24px_rgba(165,36,39,0.18)]"
              : "text-brand-red hover:bg-white/70"
          }`}
          onClick={() => onChangeTab(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

function AssessmentStudentRail({
  detail,
  selectedStudentId,
  onSelectStudent
}: {
  detail: WeeklyClassAssessmentDetail
  selectedStudentId: string
  onSelectStudent: (studentId: string) => void
}) {
  return (
    <aside className="rounded-3xl border border-brand-red/10 bg-white/35 p-3">
      <p className="px-2 text-xs font-semibold uppercase tracking-wide text-brand-red">Học sinh {subjectLabels[detail.subject]}</p>
      <div className="mt-3 max-h-[520px] space-y-2 overflow-auto pr-1">
        {detail.students.map((item) => {
          const isSelected = item.studentId === selectedStudentId
          const completedDomains = item.domainProgress.filter((domain) => domain.status === "COMPLETE").length
          const average = scoreOutOfFive(item.items)

          return (
            <button
              key={item.studentId}
              type="button"
              className={`w-full rounded-2xl border p-3 text-left transition ${isSelected ? "border-brand-red bg-white/70" : "border-brand-red/10 bg-white/35 hover:border-brand-red/30 hover:bg-white/55"}`}
              onClick={() => onSelectStudent(item.studentId)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-brand-ink">{item.studentName}</p>
                  <p className="mt-1 truncate text-xs text-stone-500">{item.parentName}</p>
                  {item.healthNote ? (
                    <p className="mt-2 rounded-2xl border border-brand-red/10 bg-white/60 px-2 py-1.5 text-[11px] font-semibold text-brand-red">
                      Lưu ý: {item.healthNote}
                    </p>
                  ) : null}
                </div>
                <span className="rounded-full border border-brand-red/10 bg-white/60 px-2 py-1 text-[11px] font-semibold text-brand-red">
                  {detail.subject === "FUN" ? `${completedDomains}/${item.domainProgress.length}` : `${formatScore(average)}/5`}
                </span>
              </div>
              <p className="mt-2 text-xs text-stone-500">
                {detail.subject === "FUN" ? `${item.checkedItems}/${item.totalItems} milestone` : `${item.checkedItems}/${item.totalItems} kỹ năng`} · {assessmentStatusLabels[item.status]}
              </p>
            </button>
          )
        })}
      </div>
    </aside>
  )
}

function FunAssessmentWorkspace({
  detail,
  selectedStudentId,
  selectedDomainKey,
  onSelectStudent,
  onSelectDomain,
  onUpdateComment,
  onUpdateStatus,
  onUpdateItem,
  activeTab,
  onChangeTab
}: {
  detail: WeeklyClassAssessmentDetail
  selectedStudentId: string | null
  selectedDomainKey: string | null
  onSelectStudent: (studentId: string) => void
  onSelectDomain: (domainKey: string) => void
  onUpdateComment: (studentId: string, comment: string) => void
  onUpdateStatus: (studentId: string, status: AssessmentStatusKey) => void
  onUpdateItem: (studentId: string, targetKey: string, updates: Partial<WeeklyAssessmentMatrixItem["items"][number]>) => void
  activeTab: AssessmentWorkspaceTab
  onChangeTab: (tab: AssessmentWorkspaceTab) => void
}) {
  const student = detail.students.find((item) => item.studentId === selectedStudentId) ?? detail.students[0]

  if (!student) {
    return <p className="rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500">Lớp FUN này chưa có học sinh để đánh giá.</p>
  }

  const selectedDomain = detail.rubric.domains.find((domain) => domain.key === selectedDomainKey) ?? detail.rubric.domains[0]
  const selectedProgress = student.domainProgress.find((domain) => domain.domainKey === selectedDomain?.key)

  if (!selectedDomain) {
    return <p className="rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500">Rubric FUN chưa có domain active.</p>
  }

  return (
    <div className="grid items-start gap-3 xl:grid-cols-[220px_minmax(0,1fr)]">
      <AssessmentStudentRail detail={detail} selectedStudentId={student.studentId} onSelectStudent={onSelectStudent} />

      <section className="min-w-0 overflow-hidden rounded-3xl border border-brand-red/10 bg-white/35">
        <div className="shrink-0 border-b border-brand-red/10 p-4">
          <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-start">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-red">FUN weekly observation - tuần {detail.weekNumber}</p>
              <h3 className="mt-1 text-xl font-semibold text-brand-ink">{student.studentName}</h3>
              <p className="mt-1 text-sm text-stone-500">
                {detail.className} · {selectedProgress?.checkedItems ?? 0}/{selectedProgress?.totalItems ?? 0} milestone trong domain đang chọn
              </p>
              {student.healthNote ? (
                <p className="mt-2 rounded-2xl border border-brand-red/10 bg-white/55 px-3 py-2 text-xs font-semibold text-brand-red">
                  Lưu ý sức khỏe: {student.healthNote}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end">
              <select
                aria-label="Trạng thái đánh giá"
                className="rounded-2xl border border-brand-red/10 bg-white/60 px-3 py-2 text-xs font-semibold text-brand-ink outline-none"
                value={student.status}
                disabled={!student.enrollmentId}
                onChange={(event) => onUpdateStatus(student.studentId, event.target.value as AssessmentStatusKey)}
              >
                {Object.entries(assessmentStatusLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              <span className="rounded-2xl border border-brand-red/10 bg-white/55 px-3 py-2 text-xs font-semibold text-stone-500">
                {student.domainProgress.filter((domain) => domain.status === "COMPLETE").length}/{student.domainProgress.length} domain
              </span>
            </div>
          </div>
          <AssessmentTabs activeTab={activeTab} onChangeTab={onChangeTab} summaryLabel="Tiến độ" />
        </div>

        {activeTab === "score" ? (
          <div className="space-y-3 p-3">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {student.domainProgress.map((domain) => (
                <button
                  key={domain.domainKey}
                  type="button"
                  className={`shrink-0 rounded-2xl border px-3 py-2 text-xs font-semibold transition ${selectedDomain.key === domain.domainKey ? "border-brand-red bg-brand-red text-white" : "border-brand-red/10 bg-white/55 text-brand-red hover:border-brand-red/30"}`}
                  onClick={() => onSelectDomain(domain.domainKey)}
                >
                  {domain.label} · {formatScore(domain.scoreOutOfFive)}/5
                </button>
              ))}
            </div>
            <div className="overflow-hidden rounded-3xl border border-brand-red/10 bg-white/35">
              <div className="grid grid-cols-[minmax(0,1fr)_420px] border-b border-brand-red/10 bg-white/45 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-stone-400 max-xl:hidden">
                <span>Milestone quan sát</span>
                <span>Mức đánh giá</span>
              </div>
              {selectedDomain.skills.flatMap((skill) =>
                skill.outcomes.map((outcome, outcomeIndex) => {
                  const key = `${selectedDomain.key}:${skill.key}:${outcomeIndex}`
                  const item = student.items.find((candidate) => itemKey(candidate) === key)

                  return (
                    <article key={key} className="border-b border-brand-red/10 bg-white/30 p-3 last:border-b-0">
                      <div className="grid gap-3 2xl:grid-cols-[minmax(0,1fr)_420px] 2xl:items-center">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-wide text-brand-red">{skill.label}</p>
                          <p className="mt-1 text-base font-semibold text-brand-ink">{outcome}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <button
                            type="button"
                            className={`rounded-2xl border px-3 py-3 text-xs font-semibold transition ${!item?.checked ? "border-stone-300 bg-stone-100 text-stone-700" : "border-brand-red/10 bg-white/60 text-stone-500 hover:border-brand-red/30"}`}
                            disabled={!student.enrollmentId}
                            onClick={() => onUpdateItem(student.studentId, key, { checked: false, progressLevel: undefined })}
                          >
                            Chưa quan sát
                          </button>
                          {Object.entries(progressLevelLabels).map(([level, label]) => (
                            <button
                              key={level}
                              type="button"
                              className={`rounded-2xl border px-3 py-3 text-xs font-semibold transition ${item?.checked && item.progressLevel === level ? "border-brand-red bg-brand-red text-white" : "border-brand-red/10 bg-white/60 text-brand-red hover:border-brand-red/30 hover:bg-white"}`}
                              disabled={!student.enrollmentId}
                              onClick={() => onUpdateItem(student.studentId, key, { checked: true, progressLevel: level as ProgressLevelKey })}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <details className="mt-2 rounded-2xl border border-brand-red/10 bg-white/45 px-3 py-2">
                        <summary className="cursor-pointer text-xs font-semibold text-brand-red">Ghi chú / minh chứng cho dòng này</summary>
                        <div className="mt-2 grid gap-2 md:grid-cols-2">
                          <input
                            className="rounded-2xl border border-brand-red/10 bg-white/60 px-3 py-2 text-sm text-brand-ink outline-none placeholder:text-stone-400"
                            value={item?.comment ?? ""}
                            disabled={!student.enrollmentId}
                            onChange={(event) => onUpdateItem(student.studentId, key, { comment: event.target.value })}
                            placeholder="Nhận xét ngắn..."
                          />
                          <input
                            className="rounded-2xl border border-brand-red/10 bg-white/60 px-3 py-2 text-sm text-brand-ink outline-none placeholder:text-stone-400"
                            value={item?.evidenceUrl ?? ""}
                            disabled={!student.enrollmentId}
                            onChange={(event) => onUpdateItem(student.studentId, key, { evidenceUrl: event.target.value || undefined })}
                            placeholder="Link ảnh/video nếu có..."
                          />
                        </div>
                      </details>
                    </article>
                  )
                })
              )}
            </div>
          </div>
        ) : null}

        {activeTab === "notes" ? (
          <div className="grid gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_260px]">
            <label className="block rounded-3xl border border-brand-red/10 bg-white/45 p-4 text-xs font-semibold uppercase tracking-wide text-stone-400">
              Nhận xét tuần
              <textarea
                className="mt-3 min-h-40 w-full rounded-2xl border border-brand-red/10 bg-white/70 px-3 py-2 text-sm font-normal normal-case tracking-normal text-brand-ink outline-none placeholder:text-stone-400"
                value={student.comment ?? ""}
                disabled={!student.enrollmentId}
                onChange={(event) => onUpdateComment(student.studentId, event.target.value)}
                placeholder="Nhận xét tổng quan cho tuần này..."
              />
            </label>
            <div className="rounded-3xl border border-brand-red/10 bg-white/45 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-red">Quy ước nhanh</p>
              <div className="mt-3 space-y-2 text-xs text-stone-600">
                <p className="rounded-2xl border border-brand-red/10 bg-white/60 px-3 py-2">Chưa quan sát: chưa đủ dữ liệu quan sát.</p>
                {Object.entries(progressLevelLabels).map(([key, label]) => (
                  <p key={key} className="rounded-2xl border border-brand-red/10 bg-white/60 px-3 py-2">
                    <span className="font-semibold text-brand-red">{label}</span> - {progressLevelDescriptions[key as ProgressLevelKey]}
                  </p>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === "summary" ? (
          <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
            {student.domainProgress.map((domain) => (
              <button
                key={domain.domainKey}
                type="button"
                className={`rounded-3xl border p-4 text-left transition ${selectedDomain.key === domain.domainKey ? "border-brand-red bg-white/70" : "border-brand-red/10 bg-white/45 hover:border-brand-red/30"}`}
                onClick={() => {
                  onSelectDomain(domain.domainKey)
                  onChangeTab("score")
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-brand-ink">{domain.label}</p>
                  <span className="rounded-full border border-brand-red/10 bg-white/70 px-2 py-1 text-xs font-semibold text-brand-red">
                    {formatScore(domain.scoreOutOfFive)}/5
                  </span>
                </div>
                <p className="mt-3 text-sm text-stone-500">{domain.checkedItems}/{domain.totalItems} milestone đã quan sát</p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-stone-400">{domain.status}</p>
              </button>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  )
}

function RoboticsAssessmentWorkspace({
  detail,
  selectedStudentId,
  onSelectStudent,
  onUpdateScore,
  onUpdateComment,
  onUpdateStatus,
  activeTab,
  onChangeTab
}: {
  detail: WeeklyClassAssessmentDetail
  selectedStudentId: string | null
  onSelectStudent: (studentId: string) => void
  onUpdateScore: (studentId: string, skillKey: string, score?: number) => void
  onUpdateComment: (studentId: string, comment: string) => void
  onUpdateStatus: (studentId: string, status: AssessmentStatusKey) => void
  activeTab: AssessmentWorkspaceTab
  onChangeTab: (tab: AssessmentWorkspaceTab) => void
}) {
  const student = detail.students.find((item) => item.studentId === selectedStudentId) ?? detail.students[0]
  const skills = detail.rubric.domains.flatMap((domain) => domain.skills)

  if (!student) {
    return <p className="rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500">Lớp Robotics này chưa có học sinh để đánh giá.</p>
  }

  const skillRows = skills.map((skill) => {
    const item = student.items.find((candidate) => candidate.skillKey === skill.key)
    const score = item?.checked ? item.score ?? assessmentItemScore(item) : undefined

    return {
      skill,
      item,
      score,
      description: skillDescriptionForAge(skill, student.ageGroup),
      comment: typeof score === "number" ? skillScoreComment(skill, score, student.ageGroup) : skillDescriptionForAge(skill, student.ageGroup)
    }
  })
  const chartData = skillRows.map((row) => ({ skill: row.skill.label, score: row.score ?? 0, fullMark: 5 }))
  const observedRows = skillRows.filter((row) => typeof row.score === "number")
  const average = scoreOutOfFive(student.items)
  const strongest = [...observedRows].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]
  const focus = [...observedRows].sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0]

  return (
    <div className="grid items-start gap-3 xl:grid-cols-[220px_minmax(0,1fr)]">
      <AssessmentStudentRail detail={detail} selectedStudentId={student.studentId} onSelectStudent={onSelectStudent} />

      <section className="min-w-0 overflow-hidden rounded-3xl border border-brand-red/10 bg-white/35">
        <div className="shrink-0 border-b border-brand-red/10 p-4">
          <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-start">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-red">Robotics weekly scoring - tuần {detail.weekNumber}</p>
              <h3 className="mt-1 text-xl font-semibold text-brand-ink">{student.studentName}</h3>
              <p className="mt-1 text-sm text-stone-500">
                {detail.className} · {student.ageGroup ?? "7-10"}{student.ageGroupIsDefault ? " mặc định do thiếu ngày sinh" : ""} · {student.checkedItems}/{student.totalItems} kỹ năng đã chấm
              </p>
              {student.healthNote ? (
                <p className="mt-2 rounded-2xl border border-brand-red/10 bg-white/55 px-3 py-2 text-xs font-semibold text-brand-red">
                  Lưu ý sức khỏe: {student.healthNote}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end">
              <select
                aria-label="Trạng thái đánh giá"
                className="rounded-2xl border border-brand-red/10 bg-white/60 px-3 py-2 text-xs font-semibold text-brand-ink outline-none"
                value={student.status}
                disabled={!student.enrollmentId}
                onChange={(event) => onUpdateStatus(student.studentId, event.target.value as AssessmentStatusKey)}
              >
                {Object.entries(assessmentStatusLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              <span className="rounded-2xl border border-brand-red/10 bg-white/55 px-3 py-2 text-xs font-semibold text-stone-500">
                TB {formatScore(average)}/5
              </span>
            </div>
          </div>
          <AssessmentTabs activeTab={activeTab} onChangeTab={onChangeTab} summaryLabel="Radar" />
        </div>

        {activeTab === "score" ? (
          <div className="p-3">
            <div className="overflow-hidden rounded-3xl border border-brand-red/10 bg-white/35">
              <div className="grid grid-cols-[minmax(0,1fr)_360px_84px] border-b border-brand-red/10 bg-white/45 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-stone-400 max-xl:hidden">
                <span>Kỹ năng Robotics</span>
                <span>Chấm sao</span>
                <span>Điểm</span>
              </div>
              {skillRows.map((row) => (
                <article key={row.skill.key} className="border-b border-brand-red/10 bg-white/30 p-3 last:border-b-0">
                  <div className="grid gap-3 2xl:grid-cols-[minmax(0,1fr)_360px_84px] 2xl:items-center">
                    <div className="min-w-0">
                      <h4 className="text-base font-semibold text-brand-ink">{row.skill.label}</h4>
                      <p className="mt-1 text-xs text-stone-500">{row.description}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {[1, 2, 3, 4, 5].map((score) => (
                        <button
                          key={score}
                          type="button"
                          className={`flex h-11 w-11 items-center justify-center rounded-2xl border transition ${typeof row.score === "number" && row.score >= score ? "border-brand-red bg-brand-red text-white" : "border-brand-red/10 bg-white/70 text-brand-red hover:border-brand-red/30 hover:bg-white"}`}
                          disabled={!student.enrollmentId}
                          aria-label={`${row.skill.label} ${score} sao`}
                          onClick={() => onUpdateScore(student.studentId, row.skill.key, score)}
                        >
                          <Star className={`h-5 w-5 ${typeof row.score === "number" && row.score >= score ? "fill-current" : ""}`} />
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 2xl:justify-end">
                      <span className="rounded-full border border-brand-red/10 bg-white/70 px-3 py-2 text-xs font-semibold text-brand-red">
                        {typeof row.score === "number" ? `${row.score}/5` : "-"}
                      </span>
                      <button
                        type="button"
                        className="rounded-2xl border border-brand-red/10 bg-white/50 px-3 py-2 text-xs font-semibold text-stone-500 hover:border-brand-red/30"
                        disabled={!student.enrollmentId || typeof row.score !== "number"}
                        onClick={() => onUpdateScore(student.studentId, row.skill.key, undefined)}
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                  <details className="mt-2 rounded-2xl border border-brand-red/10 bg-white/45 px-3 py-2">
                    <summary className="cursor-pointer text-xs font-semibold text-brand-red">Nhận xét tự động</summary>
                    <p className="mt-2 text-xs text-stone-600">{row.comment}</p>
                  </details>
                </article>
              ))}
            </div>
          </div>
        ) : null}

        {activeTab === "notes" ? (
          <div className="grid gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_260px]">
            <label className="block rounded-3xl border border-brand-red/10 bg-white/45 p-4 text-xs font-semibold uppercase tracking-wide text-stone-400">
              Nhận xét tuần
              <textarea
                className="mt-3 min-h-40 w-full rounded-2xl border border-brand-red/10 bg-white/70 px-3 py-2 text-sm font-normal normal-case tracking-normal text-brand-ink outline-none placeholder:text-stone-400"
                value={student.comment ?? ""}
                disabled={!student.enrollmentId}
                onChange={(event) => onUpdateComment(student.studentId, event.target.value)}
                placeholder={student.enrollmentId ? "Nhận xét tổng quan cho tuần này..." : "Học sinh chưa có khóa đã đăng ký của lớp"}
              />
            </label>
            <div className="rounded-3xl border border-brand-red/10 bg-white/45 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-red">Gợi ý theo điểm</p>
              <div className="mt-3 space-y-2">
                {skillRows
                  .filter((row) => typeof row.score === "number")
                  .slice(0, 4)
                  .map((row) => (
                    <p key={row.skill.key} className="rounded-2xl border border-brand-red/10 bg-white/60 px-3 py-2 text-xs text-stone-600">
                      <span className="font-semibold text-brand-red">{row.skill.label}:</span> {row.comment}
                    </p>
                  ))}
                {observedRows.length === 0 ? <p className="text-sm text-stone-500">Chưa có điểm để sinh nhận xét.</p> : null}
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === "summary" ? (
          <div className="grid gap-3 p-3 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="rounded-3xl border border-brand-red/10 bg-white/45 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-red">Radar 8 kỹ năng</p>
                  <h3 className="mt-1 text-xl font-semibold text-brand-ink">{formatScore(average)}/5</h3>
                </div>
                <span className="rounded-2xl border border-brand-red/10 bg-white/70 px-3 py-2 text-xs font-semibold text-stone-500">
                  {student.checkedItems}/{student.totalItems}
                </span>
              </div>
              <div className="mt-3 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={chartData} outerRadius="72%">
                    <PolarGrid stroke="#e7d8d2" />
                    <PolarAngleAxis dataKey="skill" tick={{ fontSize: 9, fill: "#57534e" }} />
                    <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fontSize: 9, fill: "#78716c" }} />
                    <Radar dataKey="score" stroke="#a52427" fill="#a52427" fillOpacity={0.24} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <p className="rounded-3xl border border-brand-red/10 bg-white/45 p-4 text-sm text-stone-600">
                <span className="block text-xs font-semibold uppercase tracking-wide text-brand-red">Điểm mạnh</span>
                {strongest ? `${strongest.skill.label} ${strongest.score}/5` : "Chưa có dữ liệu"}
              </p>
              <p className="rounded-3xl border border-brand-red/10 bg-white/45 p-4 text-sm text-stone-600">
                <span className="block text-xs font-semibold uppercase tracking-wide text-brand-red">Cần luyện</span>
                {focus ? `${focus.skill.label} ${focus.score}/5` : "Chưa có dữ liệu"}
              </p>
              {skillRows.map((row) => (
                <article key={row.skill.key} className="rounded-3xl border border-brand-red/10 bg-white/45 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-brand-ink">{row.skill.label}</p>
                    <span className="rounded-full border border-brand-red/10 bg-white/70 px-2 py-1 text-xs font-semibold text-brand-red">
                      {typeof row.score === "number" ? `${row.score}/5` : "-"}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-stone-500">{row.description}</p>
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  )
}
