"use client"

import {
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  Check,
  CircleSlash,
  Clock,
  ImagePlus,
  Settings2,
  StickyNote,
  Trash2,
  UploadCloud,
  UserRound,
  UsersRound,
  X
} from "lucide-react"
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react"
import type { ApiResponse } from "@/lib/api-response"
import { ClassScheduleBoard } from "./class-schedule-board"
import { absenceRequestStatusLabels, type AbsenceRequestItem, type AbsenceRequestStatusKey } from "@/lib/contracts/absence-requests"
import { subjectLabels } from "@/lib/contracts/assessment"
import {
  attendanceStatusLabels,
  classPhotoUploadAcceptedMimeTypes,
  classPhotoUploadMaxBytes,
  type AttendanceMarkResult,
  type AttendanceStatusKey,
  type ClassPhotoListItem,
  type TodayClassItem,
  type TodayClassStudent
} from "@/lib/contracts/classes"
import type { MakeupScheduleItem } from "@/lib/contracts/makeup-schedules"

const attendanceActions: Array<{
  status: AttendanceStatusKey
  label: string
  icon: typeof Check
}> = [
  { status: "PRESENT", label: "Có mặt", icon: Check },
  { status: "ABSENT_EXCUSED", label: "Nghỉ", icon: CircleSlash },
  { status: "ABSENT_NO_EXCUSE", label: "Vắng", icon: X }
]

type ClassPageTab = "today" | "week" | "calendar" | "makeup" | "setup"

const pageTabs: Array<{ id: ClassPageTab; label: string; icon: typeof UsersRound }> = [
  { id: "today", label: "Lớp hôm nay", icon: UsersRound },
  { id: "week", label: "Lịch tuần", icon: CalendarRange },
  { id: "calendar", label: "Lịch tháng", icon: CalendarDays },
  { id: "makeup", label: "Học bù", icon: CalendarPlus },
  { id: "setup", label: "Thiết lập", icon: Settings2 }
]

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

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
        isLoading ? (
          <p className="neu-card rounded-3xl p-6 text-sm text-stone-500">Đang tải lớp hôm nay...</p>
        ) : classes.length && selectedClass ? (
          <section className="neu-card overflow-hidden rounded-3xl">
            <div className="grid gap-0 xl:grid-cols-[320px_1fr]">
              <aside className="border-b border-brand-red/10 p-4 xl:border-b-0 xl:border-r">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-brand-red">Hôm nay</p>
                    <h2 className="mt-1 text-lg font-semibold text-brand-ink">{classes.length} lớp</h2>
                  </div>
                  <span className="rounded-2xl border border-brand-red/10 px-3 py-2 text-xs font-semibold text-stone-600">
                    {attendanceSummary.marked}/{attendanceSummary.total}
                  </span>
                </div>
                <div className="space-y-2">
                  {classes.map((klass) => {
                    const markedCount = klass.students.filter((student) => student.attendanceStatus).length
                    const isActive = klass.id === selectedClass.id

                    return (
                      <button
                        key={klass.id}
                        type="button"
                        className={`neu-list-item w-full rounded-2xl p-3 text-left transition hover:shadow-md ${
                          isActive ? "border-brand-red/30 text-brand-red" : "text-stone-700"
                        }`}
                        onClick={() => {
                          setSelectedClassId(klass.id)
                          setExpandedStudentId(null)
                        }}
                      >
                        <span className="block truncate text-sm font-semibold">{klass.name}</span>
                        <span className="mt-1 flex items-center justify-between gap-2 text-xs text-stone-500">
                          <span className="truncate">
                            {klass.startTime}-{klass.endTime}
                          </span>
                          <span>{markedCount}/{klass.students.length}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </aside>

              <div className="min-w-0 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <h2 className="truncate text-xl font-semibold text-brand-ink">{selectedClass.name}</h2>
                    <p className="mt-1 truncate text-sm text-stone-500">
                      {selectedClass.courseName} - {subjectLabels[selectedClass.subject]} - GV {selectedClass.teacherName}
                    </p>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center text-xs font-semibold text-stone-600">
                    <span className="rounded-2xl border border-brand-red/10 px-3 py-2">Tổng {attendanceSummary.total}</span>
                    <span className="rounded-2xl border border-brand-red/10 px-3 py-2">Đã {attendanceSummary.marked}</span>
                    <span className="rounded-2xl border border-brand-red/10 px-3 py-2">Có {attendanceSummary.present}</span>
                    <span className="rounded-2xl border border-brand-red/10 px-3 py-2">Vắng {attendanceSummary.absent}</span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-stone-600">
                  <span className="inline-flex items-center gap-2 rounded-2xl border border-brand-red/10 px-3 py-2">
                    <Clock className="h-4 w-4 text-brand-red" />
                    {selectedClass.startTime}-{selectedClass.endTime}
                  </span>
                  {selectedClass.room ? <span className="rounded-2xl border border-brand-red/10 px-3 py-2">{selectedClass.room}</span> : null}
                  <span className="inline-flex items-center gap-2 rounded-2xl border border-brand-red/10 px-3 py-2">
                    <ImagePlus className="h-4 w-4 text-brand-red" />
                    {selectedClass.photoCount} ảnh lớp
                  </span>
                </div>

                <section className="content-border mt-4 rounded-2xl p-3">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-brand-red">Album buổi học</p>
                      <h3 className="mt-1 text-base font-semibold text-brand-ink">Ảnh lớp nội bộ</h3>
                      <p className="mt-1 text-xs text-stone-500">Ảnh riêng của bé upload ở từng học viên và duyệt gửi trong profile.</p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs font-semibold text-stone-600">
                      <span className="rounded-2xl border border-brand-red/10 px-3 py-2">{selectedClassPhotos.length} ảnh</span>
                      <span className="rounded-2xl border border-brand-red/10 px-3 py-2">
                        {selectedClassPhotos.filter((photo) => !photo.studentId).length} ảnh chung
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_260px_auto]">
                    <div className="space-y-3">
                      <label className="block text-xs font-semibold text-stone-600">
                        Chọn ảnh lớp
                        <input
                          className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-3 py-2 text-sm text-brand-ink outline-none file:mr-3 file:rounded-xl file:border-0 file:bg-brand-red file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
                          type="file"
                          multiple
                          accept={classPhotoUploadAcceptedMimeTypes.join(",")}
                          disabled={!selectedClass.sessionId}
                          onChange={selectClassPhotoFiles}
                        />
                      </label>
                      {classPhotoPreviewUrls.length ? (
                        <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-4">
                          {classPhotoPreviewUrls.map((url, index) => (
                            <div key={url} className="rounded-2xl border border-brand-red/10 bg-white/45 p-2">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt={`Ảnh lớp ${index + 1}`} className="h-24 w-full rounded-xl object-cover" />
                              <p className="mt-2 truncate text-xs font-semibold text-brand-ink">{classPhotoFiles[index]?.name}</p>
                              <p className="mt-1 text-xs text-stone-500">{formatFileSize(classPhotoFiles[index]?.size ?? 0)}</p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="space-y-3">
                      <label className="block text-xs font-semibold text-stone-600">
                        Ghi chú ảnh
                        <textarea
                          className="neu-pressed mt-2 min-h-20 w-full resize-none rounded-2xl bg-transparent px-3 py-2 text-sm text-brand-ink outline-none placeholder:text-stone-400"
                          value={classPhotoCaption}
                          onChange={(event) => setClassPhotoCaption(event.target.value)}
                          placeholder="Hoạt động, sản phẩm, khoảnh khắc nổi bật..."
                        />
                      </label>
                      <label className="block text-xs font-semibold text-stone-600">
                        URL ảnh dự phòng
                        <input
                          className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-3 py-2 text-sm text-brand-ink outline-none placeholder:text-stone-400 disabled:opacity-60"
                          value={classPhotoUrl}
                          disabled={classPhotoFiles.length > 0}
                          onChange={(event) => setClassPhotoUrl(event.target.value)}
                          placeholder="https://..."
                        />
                      </label>
                    </div>
                    <div className="flex flex-col gap-2 xl:items-end xl:justify-end">
                      <button
                        type="button"
                        disabled={photoSavingId === "class-album" || !selectedClass.sessionId}
                        onClick={() => void submitClassAlbumPhotos(selectedClass.id)}
                        className="glass-button-primary inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold disabled:opacity-50"
                      >
                        <UploadCloud className="h-4 w-4" />
                        {photoSavingId === "class-album" ? "Đang lưu" : "Lưu album"}
                      </button>
                      {classPhotoFiles.length ? (
                        <button
                          type="button"
                          className="rounded-2xl border border-brand-red/15 px-4 py-2 text-xs font-semibold text-brand-red"
                          onClick={clearClassPhotoFiles}
                        >
                          Gỡ ảnh chọn
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                    {selectedClassPhotos.length ? selectedClassPhotos.map((photo) => (
                      <article key={photo.id} className="overflow-hidden rounded-2xl border border-brand-red/10 bg-white/45">
                        <a href={photo.url} target="_blank" rel="noreferrer" className="block">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={photo.url} alt={photo.caption || "Ảnh lớp học"} className="h-44 w-full object-cover" />
                        </a>
                        <div className="space-y-3 p-3">
                          <div className="flex flex-wrap gap-2 text-xs font-semibold">
                            <span className={`rounded-full border px-2 py-1 ${photo.isPublished ? "border-emerald-200 text-emerald-700" : "border-brand-red/15 text-stone-500"}`}>
                              {photo.isPublished ? "Phụ huynh thấy" : "Nháp"}
                            </span>
                            {photo.sentToParentAt ? <span className="rounded-full border border-brand-red/10 px-2 py-1 text-stone-500">Đã gửi</span> : null}
                            {photo.studentName ? <span className="rounded-full border border-brand-red/10 px-2 py-1 text-stone-500">{photo.studentName}</span> : null}
                          </div>
                          <textarea
                            className="neu-pressed min-h-16 w-full resize-none rounded-2xl bg-transparent px-3 py-2 text-sm text-brand-ink outline-none placeholder:text-stone-400"
                            value={photoCaptionDrafts[photo.id] ?? ""}
                            onChange={(event) => setPhotoCaptionDrafts((current) => ({ ...current, [photo.id]: event.target.value }))}
                            placeholder="Ghi chú gửi phụ huynh..."
                          />
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={photoSavingId === photo.id}
                              className="neu-list-item inline-flex items-center gap-1 rounded-2xl px-3 py-2 text-xs font-semibold text-stone-600 hover:text-brand-red disabled:opacity-50"
                              onClick={() => void patchClassPhoto(photo.id, { caption: photoCaptionDrafts[photo.id] ?? "" })}
                            >
                              <StickyNote className="h-3.5 w-3.5" />
                              Lưu
                            </button>
                            <button
                              type="button"
                              disabled={photoSavingId === photo.id}
                              className="neu-list-item inline-flex items-center gap-1 rounded-2xl px-3 py-2 text-xs font-semibold text-brand-red disabled:opacity-50"
                              onClick={() => void deleteClassPhoto(photo)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Xóa
                            </button>
                          </div>
                        </div>
                      </article>
                    )) : (
                      <p className="rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500 md:col-span-2 2xl:col-span-3">Chưa có ảnh cho buổi học này.</p>
                    )}
                  </div>
                </section>

                <div className="content-border mt-4 overflow-hidden rounded-2xl">
                  {selectedClass.students.length ? (
                    <div className="divide-y divide-brand-red/10">
                      {selectedClass.students.map((student) => {
                        const isExpanded = expandedStudentId === student.studentId

                        return (
                          <article key={student.studentId} className="p-3 transition hover:bg-white/35 hover:shadow-sm">
                            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
                              <div className="flex min-w-0 items-center gap-3">
                                <div className="neu-pressed flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl">
                                  <UserRound className="h-5 w-5 text-brand-red" />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="truncate text-sm font-semibold text-brand-ink">{student.studentName}</h3>
                                    {student.attendanceStatus ? (
                                      <span className="rounded-full border border-brand-red/15 px-2 py-1 text-xs font-semibold text-brand-red">
                                        {attendanceStatusLabels[student.attendanceStatus]}
                                      </span>
                                    ) : null}
                                  </div>
                                  <p className="mt-1 truncate text-xs text-stone-500">
                                    {student.parentName} - {student.parentPhone} - còn {student.sessionsRemaining} buổi
                                  </p>
                                  {student.healthNote ? (
                                    <p className="mt-2 rounded-2xl border border-brand-red/10 bg-white/55 px-3 py-2 text-xs font-semibold text-brand-red">
                                      Lưu ý sức khỏe: {student.healthNote}
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2 xl:justify-end">
                                {attendanceActions.map((action) => {
                                  const Icon = action.icon
                                  const isActive = student.attendanceStatus === action.status
                                  const saving = isSaving === `${student.studentId}-${action.status}`

                                  return (
                                    <button
                                      key={action.status}
                                      type="button"
                                      disabled={saving || !student.enrollmentId}
                                      onClick={() => markAttendance(selectedClass.id, student, action.status)}
                                      className={`neu-list-item inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
                                        isActive ? "text-brand-red" : "text-stone-600 hover:text-brand-red"
                                      }`}
                                    >
                                      <Icon className="h-4 w-4" />
                                      {saving ? "Lưu" : action.label}
                                    </button>
                                  )
                                })}
                                <button
                                  type="button"
                                  className="neu-list-item inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold text-stone-600 hover:text-brand-red"
                                  onClick={() => setExpandedStudentId(isExpanded ? null : student.studentId)}
                                >
                                <StickyNote className="h-4 w-4" />
                                  Ghi chú
                                </button>
                              </div>
                            </div>
                            {isExpanded ? (
                              <div className="content-border mt-3 grid gap-4 pt-3">
                                <label className="block text-xs font-semibold text-stone-600">
                                  Ghi chú buổi học
                                  <input
                                    className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-3 py-2 text-sm text-brand-ink outline-none placeholder:text-stone-400"
                                    value={noteDrafts[student.studentId] ?? student.attendanceNote ?? ""}
                                    onChange={(event) => setNoteDrafts((current) => ({ ...current, [student.studentId]: event.target.value }))}
                                    placeholder="Điểm nổi bật, lưu ý cần follow-up..."
                                  />
                                </label>
                                <div className="rounded-2xl border border-brand-red/10 bg-white/35 p-3">
                                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                    <div>
                                      <p className="text-xs font-semibold uppercase tracking-widest text-brand-red">Ảnh bé</p>
                                      <p className="mt-1 text-xs text-stone-500">
                                        Ảnh lưu nháp vào profile học viên. Admin/Sale duyệt trước khi phụ huynh thấy.
                                      </p>
                                    </div>
                                    <span className="rounded-2xl border border-brand-red/10 px-3 py-2 text-xs font-semibold text-stone-600">
                                      {student.photoCount} ảnh đã lưu
                                    </span>
                                  </div>
                                  <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px_auto]">
                                    <div className="space-y-3">
                                      <label className="block text-xs font-semibold text-stone-600">
                                        Chọn ảnh của bé
                                        <input
                                          className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-3 py-2 text-sm text-brand-ink outline-none file:mr-3 file:rounded-xl file:border-0 file:bg-brand-red file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white disabled:opacity-60"
                                          type="file"
                                          multiple
                                          accept={classPhotoUploadAcceptedMimeTypes.join(",")}
                                          disabled={!student.attendanceId}
                                          onChange={(event) => selectStudentPhotoFiles(student.studentId, event)}
                                        />
                                      </label>
                                      {studentPhotoPreviewUrlsById[student.studentId]?.length ? (
                                        <div className="grid gap-2 sm:grid-cols-3">
                                          {studentPhotoPreviewUrlsById[student.studentId].map((url, index) => (
                                            <div key={url} className="rounded-2xl border border-brand-red/10 bg-white/45 p-2">
                                              {/* eslint-disable-next-line @next/next/no-img-element */}
                                              <img src={url} alt={`Ảnh ${student.studentName} ${index + 1}`} className="h-24 w-full rounded-xl object-cover" />
                                              <p className="mt-2 truncate text-xs font-semibold text-brand-ink">{studentPhotoFilesById[student.studentId]?.[index]?.name}</p>
                                              <p className="mt-1 text-xs text-stone-500">{formatFileSize(studentPhotoFilesById[student.studentId]?.[index]?.size ?? 0)}</p>
                                            </div>
                                          ))}
                                        </div>
                                      ) : null}
                                      {!student.attendanceId ? (
                                        <p className="text-xs font-semibold text-stone-500">Điểm danh học viên trước, sau đó mới upload ảnh bé.</p>
                                      ) : null}
                                    </div>
                                    <label className="block text-xs font-semibold text-stone-600">
                                      Ghi chú ảnh
                                      <textarea
                                        className="neu-pressed mt-2 min-h-20 w-full resize-none rounded-2xl bg-transparent px-3 py-2 text-sm text-brand-ink outline-none placeholder:text-stone-400"
                                        value={studentPhotoCaptionsById[student.studentId] ?? ""}
                                        onChange={(event) => setStudentPhotoCaptionsById((current) => ({ ...current, [student.studentId]: event.target.value }))}
                                        placeholder="Khoảnh khắc, sản phẩm, hoạt động của bé..."
                                      />
                                    </label>
                                    <div className="flex flex-col gap-2 lg:items-end lg:justify-end">
                                      <button
                                        type="button"
                                        disabled={!student.attendanceId || photoSavingId === `student-${student.studentId}`}
                                        onClick={() => void submitStudentPhotos(selectedClass.id, student)}
                                        className="glass-button-primary inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold disabled:opacity-50"
                                      >
                                        <UploadCloud className="h-4 w-4" />
                                        {photoSavingId === `student-${student.studentId}` ? "Đang lưu" : "Lưu nháp"}
                                      </button>
                                      {studentPhotoFilesById[student.studentId]?.length ? (
                                        <button
                                          type="button"
                                          className="rounded-2xl border border-brand-red/15 px-4 py-2 text-xs font-semibold text-brand-red"
                                          onClick={() => clearStudentPhotoFiles(student.studentId)}
                                        >
                                          Gỡ ảnh chọn
                                        </button>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : null}
                            {!isExpanded && (student.attendanceNote || student.photoCount > 0) ? (
                              <div className="mt-2 flex flex-wrap gap-2 text-xs text-stone-500">
                                {student.attendanceNote ? (
                                  <span className="inline-flex items-center gap-1 rounded-2xl border border-brand-red/10 px-3 py-1.5">
                                    <StickyNote className="h-3.5 w-3.5 text-brand-red" />
                                    {student.attendanceNote}
                                  </span>
                                ) : null}
                                {student.photoCount > 0 ? (
                                  <span className="inline-flex items-center gap-1 rounded-2xl border border-brand-red/10 px-3 py-1.5">
                                    <ImagePlus className="h-3.5 w-3.5 text-brand-red" />
                                    {student.photoCount} ảnh
                                  </span>
                                ) : null}
                              </div>
                            ) : null}
                          </article>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="p-4 text-sm text-stone-500">Lớp này chưa có học viên active.</p>
                  )}
                </div>
              </div>
            </div>
          </section>
        ) : (
          <p className="neu-card rounded-3xl p-6 text-sm text-stone-500">Hôm nay chưa có lớp active theo lịch.</p>
        )
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
