"use client"

import { type ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react"
import type { ApiResponse } from "@/lib/api-response"
import { subjectLabels } from "@/lib/contracts/assessment"
import { ClassScheduleToolbar } from "./class-schedule-toolbar"
import { ClassSetupWorkspace } from "./class-setup-workspace"
import { ManagedClassDialog } from "./managed-class-dialog"
import { MonthCalendarView, WeekCalendarView } from "./class-calendar-views"
import { ScheduleEventDialog } from "./schedule-event-dialog"
import { SessionDetailDialog } from "./session-detail-dialog"
import {
  dialogBodyClassName,
  dialogPanelClassName,
  emptyClassForm,
  emptyEventForm,
  type ClassFormState,
  type ClassPatchBody,
  type ClassStatusFilter,
  type ClassSubjectFilter,
  type EventFormState,
  type SetupPanel
} from "./class-schedule-state"
import {
  defaultMonth,
  getMonthCells,
  getWeekCells,
  isAcceptedPhotoFile,
  startOfWeek,
  today,
  toDateKey,
  uniqueById,
  uniqueMonthKeys,
} from "./class-schedule-utils"
import {
  classPhotoUploadMaxBytes,
  type ClassPhotoListItem
} from "@/lib/contracts/classes"
import type { ClassCalendarSessionItem, ClassListItem, ClassStudentItem, CourseListItem } from "@/lib/contracts/courses"
import type { ScheduleEventItem } from "@/lib/contracts/schedule-events"
import type { StudentListItem } from "@/lib/contracts/students"
import type { UserListItem } from "@/lib/contracts/users"

type ClassScheduleBoardProps = {
  view?: "calendar" | "week" | "setup"
}

export function ClassScheduleBoard({ view = "calendar" }: ClassScheduleBoardProps) {
  const [sessions, setSessions] = useState<ClassCalendarSessionItem[]>([])
  const [classes, setClasses] = useState<ClassListItem[]>([])
  const [scheduleEvents, setScheduleEvents] = useState<ScheduleEventItem[]>([])
  const [courses, setCourses] = useState<CourseListItem[]>([])
  const [students, setStudents] = useState<StudentListItem[]>([])
  const [users, setUsers] = useState<UserListItem[]>([])
  const [form, setForm] = useState<ClassFormState>(emptyClassForm)
  const [eventForm, setEventForm] = useState<EventFormState>(emptyEventForm)
  const [month, setMonth] = useState(defaultMonth)
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today))
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [draggingSessionId, setDraggingSessionId] = useState<string | null>(null)
  const [selectedSession, setSelectedSession] = useState<ClassCalendarSessionItem | null>(null)
  const [selectedManagedClassId, setSelectedManagedClassId] = useState<string | null>(null)
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false)
  const [classSearch, setClassSearch] = useState("")
  const [classSubjectFilter, setClassSubjectFilter] = useState<ClassSubjectFilter>("ALL")
  const [classStatusFilter, setClassStatusFilter] = useState<ClassStatusFilter>("ALL")
  const [setupPanel, setSetupPanel] = useState<SetupPanel>("manage")
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [isSaving, setIsSaving] = useState<string | null>(null)
  const [photoSavingId, setPhotoSavingId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [canManageSchedule, setCanManageSchedule] = useState(false)
  const [sessionPhotosById, setSessionPhotosById] = useState<Record<string, ClassPhotoListItem[]>>({})
  const [sessionPhotoFiles, setSessionPhotoFiles] = useState<File[]>([])
  const [sessionPhotoPreviewUrls, setSessionPhotoPreviewUrls] = useState<string[]>([])
  const [sessionPhotoUrl, setSessionPhotoUrl] = useState("")
  const [sessionPhotoCaption, setSessionPhotoCaption] = useState("")
  const [photoCaptionDrafts, setPhotoCaptionDrafts] = useState<Record<string, string>>({})
  const sessionPhotoPreviewUrlsRef = useRef<string[]>([])

  const activeCourses = useMemo(() => courses.filter((course) => course.isActive), [courses])
  const teacherOptions = useMemo(() => users.filter((user) => user.role === "TEACHER" && user.isActive), [users])
  const selectedYear = Number(month.slice(0, 4))
  const selectedClass = useMemo(
    () => (selectedSession ? classes.find((klass) => klass.id === selectedSession.classId) : undefined),
    [classes, selectedSession]
  )
  const selectedClassStudents = selectedClass?.students.filter((student) => student.isActive) ?? []
  const selectedSessionPhotos = selectedSession ? sessionPhotosById[selectedSession.id] ?? [] : []
  const selectedManagedClass = useMemo(
    () => classes.find((klass) => klass.id === selectedManagedClassId),
    [classes, selectedManagedClassId]
  )
  const filteredManagedClasses = useMemo(() => {
    const query = classSearch.trim().toLowerCase()

    return classes.filter((klass) => {
      const matchesSearch = !query || [klass.code, klass.name, klass.courseName, klass.teacherName, subjectLabels[klass.subject]]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(query))
      const matchesSubject = classSubjectFilter === "ALL" || klass.subject === classSubjectFilter
      const matchesStatus = classStatusFilter === "ALL" || (classStatusFilter === "ACTIVE" ? klass.isActive : !klass.isActive)

      return matchesSearch && matchesSubject && matchesStatus
    })
  }, [classSearch, classStatusFilter, classSubjectFilter, classes])
  const selectedManagedClassStudents = selectedManagedClass?.students.filter((student) => student.isActive) ?? []
  const availableStudentsForSelectedClass = useMemo(
    () =>
      students.filter((student) => {
        if (!selectedClass) return false
        return student.courses.some((course) => course.courseSubject === selectedClass.subject && course.isActive)
      }),
    [selectedClass, students]
  )
  const availableStudentsForManagedClass = useMemo(
    () =>
      students.filter((student) => {
        if (!selectedManagedClass) return false
        return student.courses.some((course) => course.courseSubject === selectedManagedClass.subject && course.isActive)
      }),
    [selectedManagedClass, students]
  )
  const monthCells = useMemo(() => getMonthCells(month), [month])
  const weekCells = useMemo(() => getWeekCells(weekStart), [weekStart])
  const calendarCells = view === "week" ? weekCells : monthCells
  const calendarFetchMonths = useMemo(
    () => (view === "setup" ? [month] : uniqueMonthKeys(calendarCells)),
    [calendarCells, month, view]
  )
  const blockedDateKeys = useMemo(
    () => new Set(scheduleEvents.filter((event) => event.affectsScheduling).map((event) => event.date.slice(0, 10))),
    [scheduleEvents]
  )
  const sessionsByDate = useMemo(
    () =>
      sessions.reduce<Record<string, ClassCalendarSessionItem[]>>((grouped, session) => {
        const key = session.date.slice(0, 10)
        if (blockedDateKeys.has(key)) return grouped

        grouped[key] = [...(grouped[key] ?? []), session].sort((first, second) => first.startTime.localeCompare(second.startTime))
        return grouped
      }, {}),
    [blockedDateKeys, sessions]
  )
  const eventsByDate = useMemo(
    () =>
      scheduleEvents.reduce<Record<string, ScheduleEventItem[]>>((grouped, event) => {
        const key = event.date.slice(0, 10)
        grouped[key] = [...(grouped[key] ?? []), event]
        return grouped
      }, {}),
    [scheduleEvents]
  )

  async function loadSchedule() {
    setIsLoading(true)
    setError("")

    const visibleDateKeys = new Set(calendarCells.map(toDateKey))
    const [sessionsResponse, eventsResponse, classesResponse, coursesResponse, studentsResponse, usersResponse] = await Promise.all([
      Promise.all(calendarFetchMonths.map((value) => fetch(`/api/class-sessions?month=${value}`, { cache: "no-store" }))),
      Promise.all(calendarFetchMonths.map((value) => fetch(`/api/schedule-events?month=${value}`, { cache: "no-store" }))),
      fetch("/api/classes", { cache: "no-store" }),
      fetch("/api/courses", { cache: "no-store" }),
      fetch("/api/students", { cache: "no-store" }),
      fetch("/api/users", { cache: "no-store" })
    ])
    const [sessionsPayloads, eventsPayload, classesPayload, coursesPayload, studentsPayload, usersPayload] = (await Promise.all([
      Promise.all(sessionsResponse.map((response) => response.json())),
      Promise.all(eventsResponse.map((response) => response.json())),
      classesResponse.json(),
      coursesResponse.json(),
      studentsResponse.json(),
      usersResponse.json()
    ])) as [
      ApiResponse<ClassCalendarSessionItem[]>[],
      ApiResponse<ScheduleEventItem[]>[],
      ApiResponse<ClassListItem[]>,
      ApiResponse<CourseListItem[]>,
      ApiResponse<StudentListItem[]>,
      ApiResponse<UserListItem[]>
    ]

    const failedSessionsPayload = sessionsPayloads.find((payload) => !payload.success)
    if (!failedSessionsPayload) {
      setSessions(
        uniqueById(sessionsPayloads.flatMap((payload) => payload.data ?? []))
          .filter((session) => visibleDateKeys.has(session.date.slice(0, 10)))
      )
    } else {
      setSessions([])
      setError(failedSessionsPayload.error?.message ?? "Không tải được lịch học.")
    }

    const failedEventsPayload = eventsPayload.find((payload) => !payload.success)
    if (!failedEventsPayload) {
      setScheduleEvents(uniqueById(eventsPayload.flatMap((payload) => payload.data ?? [])))
    } else {
      setScheduleEvents([])
    }

    if (classesPayload.success && classesPayload.data) {
      setClasses(classesPayload.data)
    }

    if (coursesPayload.success && coursesPayload.data) {
      setCourses(coursesPayload.data)
      setForm((current) => ({
        ...current,
        courseId: current.courseId || coursesPayload.data?.find((course) => course.isActive)?.id || ""
      }))
    }

    if (studentsPayload.success && studentsPayload.data) {
      setStudents(studentsPayload.data)
    }

    if (usersPayload.success && usersPayload.data) {
      setUsers(usersPayload.data)
      setCanManageSchedule(true)
      setForm((current) => ({
        ...current,
        teacherId:
          current.teacherId ||
          usersPayload.data?.find((user) => user.role === "TEACHER" && user.isActive)?.id ||
          ""
      }))
    } else {
      setUsers([])
      setCanManageSchedule(false)
    }

    setIsLoading(false)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSchedule()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, weekStart, view])

  useEffect(() => {
    return () => {
      sessionPhotoPreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])

  useEffect(() => {
    if (!selectedSession?.id) return

    let isMounted = true
    const classSessionId = selectedSession.id

    async function loadSelectedSessionPhotos() {
      const response = await fetch(`/api/class-photos?classSessionId=${classSessionId}`, { cache: "no-store" })
      const payload = (await response.json()) as ApiResponse<ClassPhotoListItem[]>

      if (!isMounted) return

      if (!response.ok || !payload.success || !payload.data) {
        setError(payload.error?.message ?? "Không tải được album ảnh buổi học.")
        return
      }

      const photos = payload.data
      setSessionPhotosById((current) => ({ ...current, [classSessionId]: photos }))
      setPhotoCaptionDrafts((current) => ({
        ...current,
        ...Object.fromEntries(photos.map((photo) => [photo.id, photo.caption ?? ""]))
      }))
    }

    void loadSelectedSessionPhotos()

    return () => {
      isMounted = false
    }
  }, [selectedSession?.id])

  function clearSessionPhotoFiles() {
    sessionPhotoPreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    sessionPhotoPreviewUrlsRef.current = []
    setSessionPhotoFiles([])
    setSessionPhotoPreviewUrls([])
  }

  function selectSessionPhotoFiles(event: ChangeEvent<HTMLInputElement>) {
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

    clearSessionPhotoFiles()
    const previewUrls = files.map((file) => URL.createObjectURL(file))
    sessionPhotoPreviewUrlsRef.current = previewUrls
    setError("")
    setSessionPhotoFiles(files)
    setSessionPhotoPreviewUrls(previewUrls)
    setSessionPhotoUrl("")
  }

  async function submitSessionAlbumPhotos() {
    const url = sessionPhotoUrl.trim()
    const sessionId = selectedSession?.id

    if (!sessionId) {
      setError("Chọn buổi học cụ thể trước khi đăng ảnh lớp.")
      return
    }

    if (!sessionPhotoFiles.length && !url) {
      setError("Chọn file ảnh hoặc nhập URL ảnh trước khi lưu.")
      return
    }

    setPhotoSavingId("session-album")
    setError("")

    try {
      const createdPhotos: ClassPhotoListItem[] = []

      for (const file of sessionPhotoFiles) {
        const formData = new FormData()
        formData.append("classSessionId", sessionId)
        formData.append("takenAt", new Date().toISOString())
        formData.append("caption", sessionPhotoCaption.trim())
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
            caption: sessionPhotoCaption.trim() || undefined,
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

      setSessionPhotosById((current) => ({
        ...current,
        [sessionId]: [...createdPhotos, ...(current[sessionId] ?? [])]
      }))
      setPhotoCaptionDrafts((current) => ({
        ...current,
        ...Object.fromEntries(createdPhotos.map((photo) => [photo.id, photo.caption ?? ""]))
      }))
      setSessionPhotoCaption("")
      setSessionPhotoUrl("")
      clearSessionPhotoFiles()
    } catch {
      setError("Không lưu được ảnh buổi học.")
    } finally {
      setPhotoSavingId(null)
    }
  }

  async function patchClassPhoto(photoId: string, body: { caption?: string | null; isFeatured?: boolean; isPublished?: boolean; markSent?: boolean }) {
    setPhotoSavingId(photoId)
    setError("")

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
      const sessionId = updated.classSessionId ?? selectedSession?.id
      if (!sessionId) return

      setSessionPhotosById((current) => ({
        ...current,
        [sessionId]: (current[sessionId] ?? []).map((photo) => (photo.id === updated.id ? updated : photo))
      }))
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
    setError("")

    try {
      const response = await fetch(`/api/class-photos/${photo.id}`, { method: "DELETE" })
      const payload = (await response.json()) as ApiResponse<{ deleted: boolean }>

      if (!response.ok || !payload.success) {
        setError(payload.error?.message ?? "Không xóa được ảnh lớp.")
        return
      }

      const sessionId = photo.classSessionId ?? selectedSession?.id
      if (!sessionId) return

      setSessionPhotosById((current) => ({
        ...current,
        [sessionId]: (current[sessionId] ?? []).filter((item) => item.id !== photo.id)
      }))
    } catch {
      setError("Không xóa được ảnh lớp.")
    } finally {
      setPhotoSavingId(null)
    }
  }

  async function createClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsCreating(true)
    setError("")
    setMessage("")

    const slots = form.slots.map((slot) => ({
      weekday: Number(slot.weekday),
      startTime: slot.startTime,
      endTime: slot.endTime,
      room: slot.room.trim() || undefined,
      isActive: true
    }))
    const firstSlot = slots[0]

    try {
      const response = await fetch("/api/classes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: form.code.trim() || undefined,
          name: form.name.trim(),
          courseId: form.courseId,
          teacherId: form.teacherId,
          weekday: firstSlot.weekday,
          startTime: firstSlot.startTime,
          endTime: firstSlot.endTime,
          room: firstSlot.room,
          startDate: form.startDate,
          plannedSessions: Number(form.plannedSessions),
          isActive: form.isActive,
          scheduleSlots: slots,
          studentIds: form.studentIds
        })
      })
      const payload = (await response.json()) as ApiResponse<ClassListItem>

      if (!response.ok || !payload.success) {
        setError(payload.error?.message ?? "Không tạo được lớp học.")
        return
      }

      setMessage(`Đã tạo lớp và sinh ${payload.data?.generatedSessionCount ?? 0} buổi học.`)
      setForm((current) => ({
        ...emptyClassForm,
        courseId: current.courseId,
        teacherId: current.teacherId,
        startDate: current.startDate
      }))
      await loadSchedule()
    } catch {
      setError("Không tạo được lớp học.")
    } finally {
      setIsCreating(false)
    }
  }

  async function updateClassStudents(classId: string, studentIds: string[]) {
    setIsSaving(classId)
    setError("")
    setMessage("")

    try {
      const response = await fetch(`/api/classes/${classId}/students`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ studentIds })
      })
      const payload = (await response.json()) as ApiResponse<ClassStudentItem[]>

      if (!response.ok || !payload.success || !payload.data) {
        setError(payload.error?.message ?? "Không cập nhật được học sinh trong lớp.")
        return
      }

      setClasses((current) =>
        current.map((klass) => (klass.id === classId ? { ...klass, students: payload.data as ClassStudentItem[] } : klass))
      )
      setSessions((current) =>
        current.map((session) => (session.classId === classId ? { ...session, studentCount: payload.data?.length ?? 0 } : session))
      )
    } catch {
      setError("Không cập nhật được học sinh trong lớp.")
    } finally {
      setIsSaving(null)
    }
  }

  async function patchClass(classId: string, body: ClassPatchBody) {
    setIsSaving(classId)
    setError("")
    setMessage("")

    try {
      const response = await fetch(`/api/classes/${classId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      })
      const payload = (await response.json()) as ApiResponse<ClassListItem>

      if (!response.ok || !payload.success || !payload.data) {
        setError(payload.error?.message ?? "Không cập nhật được lớp học.")
        return
      }

      setClasses((current) => current.map((klass) => (klass.id === classId ? payload.data as ClassListItem : klass)))
      setMessage("Đã cập nhật lớp học.")
    } catch {
      setError("Không cập nhật được lớp học.")
    } finally {
      setIsSaving(null)
    }
  }

  async function createScheduleEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving("schedule-event")
    setError("")
    setMessage("")

    try {
      const response = await fetch("/api/schedule-events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: eventForm.title.trim(),
          date: eventForm.date,
          type: eventForm.type,
          affectsScheduling: eventForm.affectsScheduling,
          note: eventForm.note.trim() || undefined
        })
      })
      const payload = (await response.json()) as ApiResponse<ScheduleEventItem & { movedSessions?: number }>

      if (!response.ok || !payload.success || !payload.data) {
        setError(payload.error?.message ?? "Không tạo được lịch nghỉ/sự kiện.")
        return
      }

      setMessage(`Đã tạo lịch nghỉ/sự kiện. Đã dời ${payload.data.movedSessions ?? 0} buổi học sang buổi cùng lịch ở tuần kế tiếp.`)
      setEventForm((current) => ({ ...emptyEventForm, date: current.date }))
      setIsEventDialogOpen(false)
      await loadSchedule()
    } catch {
      setError("Không tạo được lịch nghỉ/sự kiện.")
    } finally {
      setIsSaving(null)
    }
  }

  async function importVietnamHolidays() {
    setIsSaving("vietnam-holidays")
    setError("")
    setMessage("")

    try {
      const response = await fetch("/api/schedule-events/vietnam-holidays", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ year: selectedYear })
      })
      const payload = (await response.json()) as ApiResponse<{
        year: number
        created: number
        skipped: number
        movedSessions: number
      }>

      if (!response.ok || !payload.success || !payload.data) {
        setError(payload.error?.message ?? "Không nạp được ngày nghỉ lễ Việt Nam.")
        return
      }

      setMessage(`Đã nạp lịch ngày lễ/sự kiện Việt Nam ${payload.data.year}: thêm ${payload.data.created} mục, bỏ qua ${payload.data.skipped} mục đã có, dời ${payload.data.movedSessions} buổi học sang buổi cùng lịch ở tuần kế tiếp.`)
      await loadSchedule()
    } catch {
      setError("Không nạp được ngày nghỉ lễ Việt Nam.")
    } finally {
      setIsSaving(null)
    }
  }

  async function deleteScheduleEvent(eventId: string) {
    setIsSaving(eventId)
    setError("")
    setMessage("")

    try {
      const response = await fetch(`/api/schedule-events/${eventId}`, {
        method: "DELETE"
      })
      const payload = (await response.json()) as ApiResponse<{ deleted: boolean }>

      if (!response.ok || !payload.success) {
        setError(payload.error?.message ?? "Không xóa được lịch nghỉ/sự kiện.")
        return
      }

      setScheduleEvents((current) => current.filter((event) => event.id !== eventId))
    } catch {
      setError("Không xóa được lịch nghỉ/sự kiện.")
    } finally {
      setIsSaving(null)
    }
  }

  async function patchSession(sessionId: string, body: Partial<Pick<ClassCalendarSessionItem, "date" | "status" | "startTime" | "endTime" | "room">>) {
    setIsSaving(sessionId)
    setError("")
    setMessage("")

    try {
      const response = await fetch(`/api/class-sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      })
      const payload = (await response.json()) as ApiResponse<ClassCalendarSessionItem>

      if (!response.ok || !payload.success || !payload.data) {
        setError(payload.error?.message ?? "Không cập nhật được buổi học.")
        return
      }

      setSessions((current) => current.map((session) => (session.id === sessionId ? (payload.data as ClassCalendarSessionItem) : session)))
      setSelectedSession((current) => (current?.id === sessionId ? (payload.data as ClassCalendarSessionItem) : current))
    } catch {
      setError("Không cập nhật được buổi học.")
    } finally {
      setIsSaving(null)
    }
  }

  function dropSessionOnDate(date: Date) {
    if (!draggingSessionId || !canManageSchedule) return

    const nextDate = toDateKey(date)
    const session = sessions.find((item) => item.id === draggingSessionId)
    setDraggingSessionId(null)

    if (!session || session.date.slice(0, 10) === nextDate) return

    void patchSession(session.id, { date: nextDate })
  }

  function addSlot() {
    setForm((current) => ({
      ...current,
      slots: [...current.slots, { weekday: "0", startTime: "16:30", endTime: "18:00", room: "" }]
    }))
  }

  function removeSlot(index: number) {
    setForm((current) => ({
      ...current,
      slots: current.slots.filter((_, slotIndex) => slotIndex !== index)
    }))
  }

  const isScheduleView = view === "calendar" || view === "week"

  return (
    <section className={`neu-card rounded-3xl ${isFullscreen ? "fixed inset-0 z-40 overflow-auto rounded-none bg-brand-bg p-4" : ""}`}>
      {isScheduleView ? (
        <ClassScheduleToolbar
          view={view}
          month={month}
          isFullscreen={isFullscreen}
          setMonth={setMonth}
          setWeekStart={setWeekStart}
          setIsFullscreen={setIsFullscreen}
          loadSchedule={loadSchedule}
        />
      ) : null}

      {error ? <p className="mx-5 rounded-3xl border border-brand-red/15 bg-white/50 p-4 text-sm text-brand-red">{error}</p> : null}
      {message ? <p className="mx-5 rounded-3xl border border-brand-red/15 bg-white/50 p-4 text-sm font-semibold text-brand-red">{message}</p> : null}
      {!canManageSchedule ? (
        <p className="mx-5 rounded-3xl border border-brand-red/10 bg-white/40 p-4 text-sm text-stone-600">
          Chế độ xem lịch đang bật. Tạo lớp, kéo thả và đổi trạng thái cần tài khoản Admin.
        </p>
      ) : null}

      {view === "calendar" ? (
        <MonthCalendarView
          month={month}
          monthCells={monthCells}
          sessionsByDate={sessionsByDate}
          eventsByDate={eventsByDate}
          isLoading={isLoading}
          canManageSchedule={canManageSchedule}
          draggingSessionId={draggingSessionId}
          setDraggingSessionId={setDraggingSessionId}
          setSelectedSession={setSelectedSession}
          dropSessionOnDate={dropSessionOnDate}
        />
      ) : null}

      {view === "week" ? (
        <WeekCalendarView
          weekStart={weekStart}
          weekCells={weekCells}
          sessionsLength={sessions.length}
          sessionsByDate={sessionsByDate}
          eventsByDate={eventsByDate}
          isLoading={isLoading}
          canManageSchedule={canManageSchedule}
          draggingSessionId={draggingSessionId}
          setDraggingSessionId={setDraggingSessionId}
          setSelectedSession={setSelectedSession}
          dropSessionOnDate={dropSessionOnDate}
        />
      ) : null}

      {view === "setup" ? (
        <ClassSetupWorkspace
          setupPanel={setupPanel}
          setSetupPanel={setSetupPanel}
          filteredManagedClasses={filteredManagedClasses}
          classes={classes}
          activeCourses={activeCourses}
          scheduleEvents={scheduleEvents}
          classSearch={classSearch}
          setClassSearch={setClassSearch}
          classSubjectFilter={classSubjectFilter}
          setClassSubjectFilter={setClassSubjectFilter}
          classStatusFilter={classStatusFilter}
          setClassStatusFilter={setClassStatusFilter}
          setSelectedManagedClassId={setSelectedManagedClassId}
          form={form}
          setForm={setForm}
          teacherOptions={teacherOptions}
          students={students}
          addSlot={addSlot}
          removeSlot={removeSlot}
          createClass={createClass}
          canManageSchedule={canManageSchedule}
          isCreating={isCreating}
          isSaving={isSaving}
          selectedYear={selectedYear}
          loadSchedule={loadSchedule}
          importVietnamHolidays={importVietnamHolidays}
          setIsEventDialogOpen={setIsEventDialogOpen}
          deleteScheduleEvent={deleteScheduleEvent}
        />
      ) : null}

      {isEventDialogOpen ? (
        <ScheduleEventDialog
          eventForm={eventForm}
          setEventForm={setEventForm}
          onClose={() => setIsEventDialogOpen(false)}
          onSubmit={createScheduleEvent}
          canManageSchedule={canManageSchedule}
          isSaving={isSaving}
          panelClassName={dialogPanelClassName}
          bodyClassName={dialogBodyClassName}
        />
      ) : null}

      {selectedSession ? (
        <SessionDetailDialog
          selectedSession={selectedSession}
          selectedClass={selectedClass}
          selectedClassStudents={selectedClassStudents}
          availableStudentsForSelectedClass={availableStudentsForSelectedClass}
          selectedSessionPhotos={selectedSessionPhotos}
          sessionPhotoFiles={sessionPhotoFiles}
          sessionPhotoPreviewUrls={sessionPhotoPreviewUrls}
          sessionPhotoUrl={sessionPhotoUrl}
          sessionPhotoCaption={sessionPhotoCaption}
          photoCaptionDrafts={photoCaptionDrafts}
          canManageSchedule={canManageSchedule}
          isSaving={isSaving}
          photoSavingId={photoSavingId}
          panelClassName={dialogPanelClassName}
          bodyClassName={dialogBodyClassName}
          onClose={() => {
            clearSessionPhotoFiles()
            setSelectedSession(null)
          }}
          patchSession={patchSession}
          selectSessionPhotoFiles={selectSessionPhotoFiles}
          setSessionPhotoCaption={setSessionPhotoCaption}
          setSessionPhotoUrl={setSessionPhotoUrl}
          submitSessionAlbumPhotos={submitSessionAlbumPhotos}
          clearSessionPhotoFiles={clearSessionPhotoFiles}
          setPhotoCaptionDrafts={setPhotoCaptionDrafts}
          patchClassPhoto={patchClassPhoto}
          deleteClassPhoto={deleteClassPhoto}
          updateClassStudents={updateClassStudents}
        />
      ) : null}

      {selectedManagedClass ? (
        <ManagedClassDialog
          selectedManagedClass={selectedManagedClass}
          selectedManagedClassStudents={selectedManagedClassStudents}
          availableStudentsForManagedClass={availableStudentsForManagedClass}
          canManageSchedule={canManageSchedule}
          isSaving={isSaving}
          panelClassName={dialogPanelClassName}
          onClose={() => setSelectedManagedClassId(null)}
          patchClass={patchClass}
          updateClassStudents={updateClassStudents}
        />
      ) : null}
    </section>
  )
}
