"use client"

import { CalendarDays, CalendarPlus, CalendarRange, Settings2, UsersRound } from "lucide-react"
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react"
import type { ApiResponse } from "@/lib/api-response"
import { ClassScheduleBoard } from "./class-schedule-board"
import { TodayClassesPanel } from "./today-classes-panel"
import { absenceRequestStatusLabels, type AbsenceRequestItem, type AbsenceRequestStatusKey } from "@/lib/contracts/absence-requests"
import {
  classPhotoUploadAcceptedMimeTypes,
  classPhotoUploadMaxBytes,
  type AttendanceMarkResult,
  type AttendanceStatusKey,
  type ClassPhotoListItem,
  type TodayClassItem,
  type TodayClassStudent
} from "@/lib/contracts/classes"
import type { MakeupScheduleItem } from "@/lib/contracts/makeup-schedules"

type ClassPageTab = "today" | "week" | "calendar" | "makeup" | "setup"

const pageTabs: Array<{ id: ClassPageTab; label: string; icon: typeof UsersRound }> = [
  { id: "today", label: "Lớp hôm nay", icon: UsersRound },
  { id: "week", label: "Lịch tuần", icon: CalendarRange },
  { id: "calendar", label: "Lịch tháng", icon: CalendarDays },
  { id: "makeup", label: "Học bù", icon: CalendarPlus },
  { id: "setup", label: "Thiết lập", icon: Settings2 }
]

function isAcceptedPhotoFile(file: File) {
  return classPhotoUploadAcceptedMimeTypes.includes(
    file.type as (typeof classPhotoUploadAcceptedMimeTypes)[number]
  )
}

export default function ClassesPage() {
  const [activeTab, setActiveTab] = useState<ClassPageTab>("today")
  const [classes, setClasses] = useState<TodayClassItem[]>([])
  const [selectedClassId, setSelectedClassId] = useState("")
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState<string | null>(null)
  const [photoSavingId, setPhotoSavingId] = useState<string | null>(null)
  const [absenceRequests, setAbsenceRequests] = useState<AbsenceRequestItem[]>([])
  const [makeupSchedules, setMakeupSchedules] = useState<MakeupScheduleItem[]>([])
  const [makeupDateDrafts, setMakeupDateDrafts] = useState<Record<string, string>>({})
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})
  const [classPhotoFiles, setClassPhotoFiles] = useState<File[]>([])
  const [classPhotoPreviewUrls, setClassPhotoPreviewUrls] = useState<string[]>([])
  const [classPhotoUrl, setClassPhotoUrl] = useState("")
  const [classPhotoCaption, setClassPhotoCaption] = useState("")
  const [studentPhotoFilesById, setStudentPhotoFilesById] = useState<Record<string, File[]>>({})
  const [studentPhotoPreviewUrlsById, setStudentPhotoPreviewUrlsById] = useState<Record<string, string[]>>({})
  const [studentPhotoCaptionsById, setStudentPhotoCaptionsById] = useState<Record<string, string>>({})
  const [classPhotosBySession, setClassPhotosBySession] = useState<Record<string, ClassPhotoListItem[]>>({})
  const [photoCaptionDrafts, setPhotoCaptionDrafts] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const classPhotoPreviewUrlsRef = useRef<string[]>([])
  const studentPhotoPreviewUrlsRef = useRef<Record<string, string[]>>({})

  const selectedClass = useMemo(
    () => classes.find((klass) => klass.id === selectedClassId) ?? classes[0],
    [classes, selectedClassId]
  )
  const attendanceSummary = useMemo(() => {
    const students = selectedClass?.students ?? []
    return {
      total: students.length,
      marked: students.filter((student) => student.attendanceStatus).length,
      present: students.filter((student) => student.attendanceStatus === "PRESENT").length,
      absent: students.filter((student) => student.attendanceStatus?.startsWith("ABSENT")).length
    }
  }, [selectedClass])
  const selectedClassPhotos = selectedClass?.sessionId ? classPhotosBySession[selectedClass.sessionId] ?? [] : []

  useEffect(() => {
    let isMounted = true

    async function loadClasses() {
      setIsLoading(true)
      setError(null)

      try {
        const [classesResponse, absenceResponse, makeupResponse] = await Promise.all([
          fetch("/api/classes/today", { cache: "no-store" }),
          fetch("/api/absence-requests?status=PENDING", { cache: "no-store" }),
          fetch("/api/makeup-schedules", { cache: "no-store" })
        ])
        const [payload, absencePayload, makeupPayload] = (await Promise.all([
          classesResponse.json(),
          absenceResponse.json(),
          makeupResponse.json()
        ])) as [
          ApiResponse<TodayClassItem[]>,
          ApiResponse<AbsenceRequestItem[]>,
          ApiResponse<MakeupScheduleItem[]>
        ]

        if (!isMounted) return

        if (!classesResponse.ok || !payload.success || !payload.data) {
          setError(payload.error?.message ?? "Không tải được lớp hôm nay.")
          return
        }

        setClasses(payload.data)
        setSelectedClassId((current) => current || payload.data?.[0]?.id || "")
        setAbsenceRequests(absencePayload.success && absencePayload.data ? absencePayload.data : [])
        setMakeupSchedules(makeupPayload.success && makeupPayload.data ? makeupPayload.data : [])
        setMakeupDateDrafts(
          makeupPayload.success && makeupPayload.data
            ? Object.fromEntries(makeupPayload.data.map((item) => [item.id, item.makeupDate ?? ""]))
            : {}
        )
      } catch {
        if (isMounted) setError("Không tải được lớp hôm nay.")
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadClasses()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    return () => {
      classPhotoPreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
      // The ref intentionally stores the latest preview URLs created by file inputs.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      Object.values(studentPhotoPreviewUrlsRef.current).flat().forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])

  function clearClassPhotoFiles() {
    classPhotoPreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    classPhotoPreviewUrlsRef.current = []
    setClassPhotoFiles([])
    setClassPhotoPreviewUrls([])
  }

  function clearStudentPhotoFiles(studentId: string) {
    studentPhotoPreviewUrlsRef.current[studentId]?.forEach((url) => URL.revokeObjectURL(url))
    delete studentPhotoPreviewUrlsRef.current[studentId]
    setStudentPhotoFilesById((current) => {
      const next = { ...current }
      delete next[studentId]
      return next
    })
    setStudentPhotoPreviewUrlsById((current) => {
      const next = { ...current }
      delete next[studentId]
      return next
    })
  }

  function selectClassPhotoFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    if (!files.length) return

    if (files.some((file) => !isAcceptedPhotoFile(file))) {
      setError("Ảnh buổi học chỉ hỗ trợ JPG, PNG, WebP hoặc GIF.")
      event.target.value = ""
      return
    }

    if (files.some((file) => file.size > classPhotoUploadMaxBytes)) {
      setError("Ảnh buổi học không được vượt quá 8MB.")
      event.target.value = ""
      return
    }

    clearClassPhotoFiles()
    const previewUrls = files.map((file) => URL.createObjectURL(file))
    classPhotoPreviewUrlsRef.current = previewUrls
    setError(null)
    setClassPhotoFiles(files)
    setClassPhotoPreviewUrls(previewUrls)
    setClassPhotoUrl("")
  }

  function selectStudentPhotoFiles(studentId: string, event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    if (!files.length) return

    if (files.some((file) => !isAcceptedPhotoFile(file))) {
      setError("Ảnh học viên chỉ hỗ trợ JPG, PNG, WebP hoặc GIF.")
      event.target.value = ""
      return
    }

    if (files.some((file) => file.size > classPhotoUploadMaxBytes)) {
      setError("Ảnh học viên không được vượt quá 8MB.")
      event.target.value = ""
      return
    }

    clearStudentPhotoFiles(studentId)
    const previewUrls = files.map((file) => URL.createObjectURL(file))
    studentPhotoPreviewUrlsRef.current[studentId] = previewUrls
    setError(null)
    setStudentPhotoFilesById((current) => ({ ...current, [studentId]: files }))
    setStudentPhotoPreviewUrlsById((current) => ({ ...current, [studentId]: previewUrls }))
  }

  async function markAttendance(classId: string, student: TodayClassStudent, status: AttendanceStatusKey) {
    if (!student.enrollmentId) {
      setError("Học viên chưa có enrollment active để điểm danh.")
      return
    }

    setIsSaving(`${student.studentId}-${status}`)
    setError(null)
    const note = noteDrafts[student.studentId] ?? student.attendanceNote ?? ""

    try {
      const response = await fetch("/api/attendance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          enrollmentId: student.enrollmentId,
          classSessionId: selectedClass?.sessionId,
          date: new Date().toISOString(),
          status,
          note: note.trim() || undefined
        })
      })
      const payload = (await response.json()) as ApiResponse<AttendanceMarkResult>

      if (!response.ok || !payload.success || !payload.data) {
        setError(payload.error?.message ?? "Không lưu được điểm danh.")
        return
      }

      const result = payload.data

      setClasses((current) =>
        current.map((klass) =>
          klass.id === classId
            ? {
                ...klass,
                students: klass.students.map((student) =>
                  student.studentId === result.studentId ? updateStudentAttendanceStatus(student, result) : student
                )
              }
            : klass
        )
      )
      setNoteDrafts((current) => ({ ...current, [result.studentId]: result.note ?? "" }))
    } catch {
      setError("Không lưu được điểm danh.")
    } finally {
      setIsSaving(null)
    }
  }

  useEffect(() => {
    if (!selectedClass?.sessionId || activeTab !== "today") return
    let isMounted = true
    const classSessionId = selectedClass.sessionId

    async function loadSelectedClassPhotos() {
      const response = await fetch(`/api/class-photos?classSessionId=${classSessionId}`, { cache: "no-store" })
      const payload = (await response.json()) as ApiResponse<ClassPhotoListItem[]>

      if (!isMounted) return

      if (!response.ok || !payload.success || !payload.data) {
        setError(payload.error?.message ?? "Không tải được album ảnh lớp.")
        return
      }

      const photos = payload.data
      setClassPhotosBySession((current) => ({ ...current, [classSessionId]: photos }))
      setPhotoCaptionDrafts((current) => ({
        ...current,
        ...Object.fromEntries(photos.map((photo) => [photo.id, photo.caption ?? ""]))
      }))
    }

    void loadSelectedClassPhotos()

    return () => {
      isMounted = false
    }
  }, [activeTab, selectedClass?.sessionId])

  async function submitClassAlbumPhotos(classId: string) {
    const url = classPhotoUrl.trim()
    const sessionId = selectedClass?.sessionId

    if (!sessionId) {
      setError("Chọn buổi học có lịch cụ thể trước khi đăng ảnh lớp.")
      return
    }

    if (!classPhotoFiles.length && !url) {
      setError("Chọn file ảnh hoặc nhập URL ảnh trước khi lưu.")
      return
    }

    setPhotoSavingId("class-album")
    setError(null)

    try {
      const createdPhotos: ClassPhotoListItem[] = []

      for (const file of classPhotoFiles) {
        const formData = new FormData()
        formData.append("classSessionId", sessionId)
        formData.append("takenAt", new Date().toISOString())
        formData.append("caption", classPhotoCaption.trim())
        formData.append("isPublished", "false")
        formData.append("photo", file)

        const response = await fetch("/api/class-photos", {
          method: "POST",
          body: formData
        })

        const payload = (await response.json()) as ApiResponse<ClassPhotoListItem>

        if (!response.ok || !payload.success || !payload.data) {
          setError(payload.error?.message ?? "Không lưu được ảnh buổi học.")
          return
        }

        createdPhotos.push(payload.data)
      }

      if (url) {
        const response = await fetch("/api/class-photos", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            classSessionId: sessionId,
            url,
            caption: classPhotoCaption.trim() || undefined,
            isPublished: false,
            takenAt: new Date().toISOString()
          })
        })
        const payload = (await response.json()) as ApiResponse<ClassPhotoListItem>

        if (!response.ok || !payload.success || !payload.data) {
          setError(payload.error?.message ?? "Không lưu được ảnh buổi học.")
          return
        }

        createdPhotos.push(payload.data)
      }

      setClasses((current) =>
        current.map((klass) =>
          klass.id === classId ? { ...klass, photoCount: klass.photoCount + createdPhotos.length } : klass
        )
      )
      setClassPhotosBySession((current) => ({
        ...current,
        [sessionId]: [...createdPhotos, ...(current[sessionId] ?? [])]
      }))
      setPhotoCaptionDrafts((current) => ({
        ...current,
        ...Object.fromEntries(createdPhotos.map((photo) => [photo.id, photo.caption ?? ""]))
      }))
      setClassPhotoCaption("")
      setClassPhotoUrl("")
      clearClassPhotoFiles()
    } catch {
      setError("Không lưu được ảnh buổi học.")
    } finally {
      setPhotoSavingId(null)
    }
  }

  async function submitStudentPhotos(classId: string, student: TodayClassStudent) {
    const sessionId = selectedClass?.sessionId
    const files = studentPhotoFilesById[student.studentId] ?? []
    const caption = studentPhotoCaptionsById[student.studentId]?.trim() ?? ""

    if (!sessionId || !student.attendanceId) {
      setError("Cần điểm danh học viên trong buổi học này trước khi upload ảnh bé.")
      return
    }

    if (!files.length) {
      setError("Chọn ảnh bé trước khi lưu.")
      return
    }

    setPhotoSavingId(`student-${student.studentId}`)
    setError(null)

    try {
      const createdPhotos: ClassPhotoListItem[] = []

      for (const file of files) {
        const formData = new FormData()
        formData.append("studentId", student.studentId)
        formData.append("attendanceId", student.attendanceId)
        formData.append("classSessionId", sessionId)
        formData.append("takenAt", new Date().toISOString())
        formData.append("caption", caption)
        formData.append("isPublished", "false")
        formData.append("photo", file)

        const response = await fetch("/api/class-photos", {
          method: "POST",
          body: formData
        })
        const payload = (await response.json()) as ApiResponse<ClassPhotoListItem>

        if (!response.ok || !payload.success || !payload.data) {
          setError(payload.error?.message ?? "Không lưu được ảnh học viên.")
          return
        }

        createdPhotos.push(payload.data)
      }

      setClasses((current) =>
        current.map((klass) =>
          klass.id === classId
            ? {
                ...klass,
                photoCount: klass.photoCount + createdPhotos.length,
                students: klass.students.map((item) =>
                  item.studentId === student.studentId
                    ? { ...item, photoCount: item.photoCount + createdPhotos.length }
                    : item
                )
              }
            : klass
        )
      )
      setClassPhotosBySession((current) => ({
        ...current,
        [sessionId]: [...createdPhotos, ...(current[sessionId] ?? [])]
      }))
      setPhotoCaptionDrafts((current) => ({
        ...current,
        ...Object.fromEntries(createdPhotos.map((photo) => [photo.id, photo.caption ?? ""]))
      }))
      setStudentPhotoCaptionsById((current) => ({ ...current, [student.studentId]: "" }))
      clearStudentPhotoFiles(student.studentId)
    } catch {
      setError("Không lưu được ảnh học viên.")
    } finally {
      setPhotoSavingId(null)
    }
  }

  async function patchClassPhoto(photoId: string, body: { caption?: string | null; isFeatured?: boolean; isPublished?: boolean; markSent?: boolean }) {
    setPhotoSavingId(photoId)
    setError(null)

    try {
      const response = await fetch(`/api/class-photos/${photoId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      })
      const payload = (await response.json()) as ApiResponse<ClassPhotoListItem>

      if (!response.ok || !payload.success || !payload.data) {
        setError(payload.error?.message ?? "Không cập nhật được ảnh lớp.")
        return
      }

      const updated = payload.data
      setClassPhotosBySession((current) => {
        const sessionId = updated.classSessionId ?? selectedClass?.sessionId
        if (!sessionId) return current

        return {
          ...current,
          [sessionId]: (current[sessionId] ?? []).map((photo) => (photo.id === updated.id ? updated : photo))
        }
      })
      setPhotoCaptionDrafts((current) => ({ ...current, [updated.id]: updated.caption ?? "" }))
    } catch {
      setError("Không cập nhật được ảnh lớp.")
    } finally {
      setPhotoSavingId(null)
    }
  }

  async function deleteClassPhoto(photo: ClassPhotoListItem) {
    if (!window.confirm("Xóa ảnh này khỏi album lớp?")) return

    setPhotoSavingId(photo.id)
    setError(null)

    try {
      const response = await fetch(`/api/class-photos/${photo.id}`, { method: "DELETE" })
      const payload = (await response.json()) as ApiResponse<{ deleted: boolean }>

      if (!response.ok || !payload.success) {
        setError(payload.error?.message ?? "Không xóa được ảnh lớp.")
        return
      }

      const sessionId = photo.classSessionId ?? selectedClass?.sessionId
      if (!sessionId) return

      setClassPhotosBySession((current) => ({
        ...current,
        [sessionId]: (current[sessionId] ?? []).filter((item) => item.id !== photo.id)
      }))
      setClasses((current) =>
        current.map((klass) =>
          klass.id === selectedClass?.id ? { ...klass, photoCount: Math.max(0, klass.photoCount - 1) } : klass
        )
      )
    } catch {
      setError("Không xóa được ảnh lớp.")
    } finally {
      setPhotoSavingId(null)
    }
  }

  async function reviewAbsenceRequest(requestId: string, status: Exclude<AbsenceRequestStatusKey, "PENDING">) {
    setIsSaving(requestId)
    setError(null)

    try {
      const response = await fetch(`/api/absence-requests/${requestId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status })
      })
      const payload = (await response.json()) as ApiResponse<AbsenceRequestItem>

      if (!response.ok || !payload.success || !payload.data) {
        setError(payload.error?.message ?? "Không duyệt được yêu cầu xin nghỉ.")
        return
      }

      setAbsenceRequests((current) => current.filter((request) => request.id !== requestId))
      if (status === "APPROVED") {
        void loadMakeupSchedules()
      }
    } catch {
      setError("Không duyệt được yêu cầu xin nghỉ.")
    } finally {
      setIsSaving(null)
    }
  }

  async function loadMakeupSchedules() {
    const response = await fetch("/api/makeup-schedules", { cache: "no-store" })
    const payload = (await response.json()) as ApiResponse<MakeupScheduleItem[]>

    if (!response.ok || !payload.success || !payload.data) {
      return
    }

    setMakeupSchedules(payload.data)
    setMakeupDateDrafts(Object.fromEntries(payload.data.map((item) => [item.id, item.makeupDate ?? ""])))
  }

  async function updateMakeupDate(attendanceId: string) {
    const makeupDate = makeupDateDrafts[attendanceId]

    setIsSaving(attendanceId)
    setError(null)

    try {
      const response = await fetch(`/api/makeup-schedules/${attendanceId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          makeupDate: makeupDate ? new Date(`${makeupDate}T00:00:00.000Z`).toISOString() : null
        })
      })
      const payload = (await response.json()) as ApiResponse<MakeupScheduleItem>

      if (!response.ok || !payload.success || !payload.data) {
        setError(payload.error?.message ?? "Không lưu được lịch học bù.")
        return
      }

      const updated = payload.data
      setMakeupSchedules((current) => current.map((item) => (item.id === attendanceId ? updated : item)))
      setMakeupDateDrafts((current) => ({ ...current, [attendanceId]: updated.makeupDate ?? "" }))
    } catch {
      setError("Không lưu được lịch học bù.")
    } finally {
      setIsSaving(null)
    }
  }

  return (
    <main className="space-y-6">
      <div className="neu-card rounded-3xl p-4 md:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-red">Classes</p>
            <h1 className="mt-2 text-2xl font-semibold text-brand-ink md:text-3xl">Lớp học</h1>
            <p className="mt-1 max-w-2xl text-sm text-stone-600">Chuyển tab để làm đúng việc: điểm danh hôm nay, xem lịch tuần/tháng, hoặc thiết lập lớp.</p>
          </div>
          <div className="neu-pressed flex gap-1 overflow-x-auto rounded-2xl p-1">
            {pageTabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id

              return (
                <button
                  key={tab.id}
                  type="button"
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
      </div>

      {error ? (
        <p className="rounded-3xl border border-brand-red/15 bg-white/50 p-4 text-sm text-brand-red">{error}</p>
      ) : null}

      {activeTab === "today" && absenceRequests.length ? (
        <section className="neu-card rounded-3xl p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-red">Xin nghỉ</p>
              <h2 className="mt-2 text-lg font-semibold text-brand-ink">Yêu cầu chờ duyệt</h2>
            </div>
            <span className="rounded-2xl border border-brand-red/10 px-3 py-2 text-xs font-semibold text-stone-600">
              {absenceRequests.length} yêu cầu
            </span>
          </div>
          <div className="content-border mt-4 grid gap-3 pt-4 lg:grid-cols-2">
            {absenceRequests.map((request) => (
              <article key={request.id} className="neu-list-item rounded-2xl p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-brand-ink">{request.studentName}</p>
                    <p className="mt-1 text-xs text-stone-500">
                      {request.className} - {request.sessionDate} {request.startTime}-{request.endTime}
                    </p>
                    <p className="mt-2 text-sm text-stone-600">{request.reason}</p>
                    <p className="mt-2 text-xs font-semibold text-brand-red">{absenceRequestStatusLabels[request.status]}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      disabled={isSaving === request.id}
                      className="rounded-2xl border border-brand-red/15 px-3 py-2 text-xs font-semibold text-brand-red disabled:opacity-50"
                      onClick={() => void reviewAbsenceRequest(request.id, "REJECTED")}
                    >
                      Từ chối
                    </button>
                    <button
                      type="button"
                      disabled={isSaving === request.id}
                      className="rounded-2xl bg-brand-red px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                      onClick={() => void reviewAbsenceRequest(request.id, "APPROVED")}
                    >
                      Duyệt
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === "week" ? <ClassScheduleBoard view="week" /> : null}
      {activeTab === "calendar" ? <ClassScheduleBoard view="calendar" /> : null}
      {activeTab === "makeup" ? (
        <section className="neu-card rounded-3xl p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-red">Makeup</p>
              <h2 className="mt-2 text-lg font-semibold text-brand-ink">Lịch học bù</h2>
              <p className="mt-1 text-sm text-stone-500">Xếp ngày học bù cho các buổi nghỉ phép đã được duyệt.</p>
            </div>
            <span className="rounded-2xl border border-brand-red/10 px-3 py-2 text-xs font-semibold text-stone-600">
              {makeupSchedules.filter((item) => !item.makeupDate).length} chưa xếp
            </span>
          </div>
          <div className="content-border mt-4 grid gap-3 pt-4">
            {makeupSchedules.length ? (
              makeupSchedules.map((item) => (
                <article key={item.id} className="neu-list-item rounded-2xl p-4">
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px_auto] xl:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-brand-ink">{item.studentName}</p>
                        <span className="rounded-full border border-brand-red/15 px-2 py-1 text-xs font-semibold text-brand-red">
                          {item.makeupDate ? "Đã xếp bù" : "Chưa xếp bù"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-stone-500">
                        Nghỉ {item.sessionDate}
                        {item.startTime && item.endTime ? ` - ${item.startTime}-${item.endTime}` : ""} - {item.courseName}
                      </p>
                      <p className="mt-2 text-sm text-stone-600">
                        {item.className ?? "Chưa gắn lớp"} · PH {item.parentName}
                        {item.teacherName ? ` · GV ${item.teacherName}` : ""}
                      </p>
                      {item.note ? <p className="mt-2 text-xs text-stone-500">{item.note}</p> : null}
                    </div>
                    <label className="block text-xs font-semibold text-stone-600">
                      Ngày học bù
                      <input
                        type="date"
                        className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-3 py-2 text-sm text-brand-ink outline-none"
                        value={makeupDateDrafts[item.id] ?? ""}
                        onChange={(event) => setMakeupDateDrafts((current) => ({ ...current, [item.id]: event.target.value }))}
                      />
                    </label>
                    <button
                      type="button"
                      disabled={isSaving === item.id}
                      className="rounded-2xl bg-brand-red px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      onClick={() => void updateMakeupDate(item.id)}
                    >
                      {isSaving === item.id ? "Đang lưu" : "Lưu lịch bù"}
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <p className="rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500">Chưa có buổi nghỉ phép cần xếp học bù.</p>
            )}
          </div>
        </section>
      ) : null}
      {activeTab === "setup" ? <ClassScheduleBoard view="setup" /> : null}
      {activeTab === "today" ? (
        <TodayClassesPanel
          isLoading={isLoading}
          classes={classes}
          selectedClass={selectedClass}
          attendanceSummary={attendanceSummary}
          selectedClassPhotos={selectedClassPhotos}
          expandedStudentId={expandedStudentId}
          isSaving={isSaving}
          photoSavingId={photoSavingId}
          classPhotoFiles={classPhotoFiles}
          classPhotoPreviewUrls={classPhotoPreviewUrls}
          classPhotoUrl={classPhotoUrl}
          classPhotoCaption={classPhotoCaption}
          studentPhotoFilesById={studentPhotoFilesById}
          studentPhotoPreviewUrlsById={studentPhotoPreviewUrlsById}
          studentPhotoCaptionsById={studentPhotoCaptionsById}
          noteDrafts={noteDrafts}
          photoCaptionDrafts={photoCaptionDrafts}
          setSelectedClassId={setSelectedClassId}
          setExpandedStudentId={setExpandedStudentId}
          selectClassPhotoFiles={selectClassPhotoFiles}
          setClassPhotoCaption={setClassPhotoCaption}
          setClassPhotoUrl={setClassPhotoUrl}
          submitClassAlbumPhotos={submitClassAlbumPhotos}
          clearClassPhotoFiles={clearClassPhotoFiles}
          setPhotoCaptionDrafts={setPhotoCaptionDrafts}
          patchClassPhoto={patchClassPhoto}
          deleteClassPhoto={deleteClassPhoto}
          markAttendance={markAttendance}
          setNoteDrafts={setNoteDrafts}
          selectStudentPhotoFiles={selectStudentPhotoFiles}
          setStudentPhotoCaptionsById={setStudentPhotoCaptionsById}
          submitStudentPhotos={submitStudentPhotos}
          clearStudentPhotoFiles={clearStudentPhotoFiles}
        />
      ) : null}
    </main>
  )
}

function updateStudentAttendanceStatus(student: TodayClassItem["students"][number], result: AttendanceMarkResult): TodayClassItem["students"][number] {
  const previousCharged = student.attendanceStatus === "PRESENT" || student.attendanceStatus === "ABSENT_NO_EXCUSE"
  const nextCharged = result.status === "PRESENT" || result.status === "ABSENT_NO_EXCUSE"
  const sessionDelta = Number(nextCharged) - Number(previousCharged)

  return {
    ...student,
    attendanceId: result.id,
    attendanceStatus: result.status,
    attendanceNote: result.note,
    sessionsRemaining: result.sessionsRemaining ?? Math.max(0, student.sessionsRemaining - sessionDelta)
  }
}
