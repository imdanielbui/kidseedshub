"use client"

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Plus,
  RefreshCcw,
  Search,
  StickyNote,
  Trash2,
  UploadCloud
} from "lucide-react"
import { type ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react"
import { DialogShell } from "@/components/shared/dialog-shell"
import type { ApiResponse } from "@/lib/api-response"
import { subjectLabels } from "@/lib/contracts/assessment"
import { MonthCalendarView, WeekCalendarView } from "./class-calendar-views"
import { ScheduleEventDialog } from "./schedule-event-dialog"
import {
  ClassMetric,
  defaultDate,
  defaultMonth,
  formatFileSize,
  getMonthCells,
  getWeekCells,
  isAcceptedPhotoFile,
  shiftMonth,
  shiftWeek,
  startOfWeek,
  today,
  toDateKey,
  uniqueById,
  uniqueMonthKeys,
  weekdayColumns,
} from "./class-schedule-utils"
import {
  classPhotoUploadAcceptedMimeTypes,
  classPhotoUploadMaxBytes,
  type ClassPhotoListItem
} from "@/lib/contracts/classes"
import type { ClassCalendarSessionItem, ClassListItem, ClassStudentItem, CourseListItem } from "@/lib/contracts/courses"
import { scheduleEventTypeLabels, type ScheduleEventItem } from "@/lib/contracts/schedule-events"
import type { StudentListItem } from "@/lib/contracts/students"
import type { UserListItem } from "@/lib/contracts/users"

type SlotForm = {
  weekday: string
  startTime: string
  endTime: string
  room: string
}

type ClassFormState = {
  code: string
  name: string
  courseId: string
  teacherId: string
  startDate: string
  plannedSessions: string
  isActive: boolean
  studentIds: string[]
  slots: SlotForm[]
}

type EventFormState = {
  title: string
  date: string
  type: "HOLIDAY" | "EVENT"
  affectsScheduling: boolean
  note: string
}
type ClassPatchBody = {
  isActive?: boolean
}
type ClassSubjectFilter = "ALL" | "FUN" | "ROBOTICS"
type ClassStatusFilter = "ALL" | "ACTIVE" | "INACTIVE"
type SetupPanel = "manage" | "create" | "events"

const emptyClassForm: ClassFormState = {
  code: "",
  name: "",
  courseId: "",
  teacherId: "",
  startDate: defaultDate,
  plannedSessions: "16",
  isActive: true,
  studentIds: [],
  slots: [
    {
      weekday: "6",
      startTime: "16:30",
      endTime: "18:00",
      room: ""
    }
  ]
}

const emptyEventForm: EventFormState = {
  title: "",
  date: defaultDate,
  type: "HOLIDAY",
  affectsScheduling: true,
  note: ""
}

const dialogPanelClassName = "border border-brand-red/20 bg-white shadow-[0_32px_90px_rgba(69,38,28,0.28)] ring-1 ring-white"
const dialogBodyClassName = "bg-[#fffaf7] p-5"

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
      <div className="flex flex-col gap-3 p-4 xl:flex-row xl:items-center xl:justify-between">
        <h2 className="text-lg font-semibold text-brand-ink">{view === "week" ? "Lịch tuần" : "Lịch tháng"}</h2>
        <div className="flex flex-wrap gap-2 xl:justify-end">
          <button
            type="button"
            className="neu-list-item rounded-2xl p-3 text-brand-red"
            onClick={() => {
              if (view === "week") {
                setWeekStart((current) => shiftWeek(current, -1))
                return
              }
              setMonth(shiftMonth(month, -1))
            }}
            aria-label={view === "week" ? "Tuần trước" : "Tháng trước"}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="neu-list-item rounded-2xl px-4 py-3 text-sm font-semibold text-brand-ink"
            onClick={() => {
              setMonth(defaultMonth)
              setWeekStart(startOfWeek(today))
            }}
          >
            Hôm nay
          </button>
          <button
            type="button"
            className="neu-list-item rounded-2xl p-3 text-brand-red"
            onClick={() => {
              if (view === "week") {
                setWeekStart((current) => shiftWeek(current, 1))
                return
              }
              setMonth(shiftMonth(month, 1))
            }}
            aria-label={view === "week" ? "Tuần sau" : "Tháng sau"}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button type="button" className="neu-list-item inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-stone-600 hover:text-brand-red" onClick={() => void loadSchedule()}>
            <RefreshCcw className="h-4 w-4" />
            Tải lại
          </button>
          <button
            type="button"
            className="neu-list-item inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-stone-600 hover:text-brand-red"
            onClick={() => setIsFullscreen((current) => !current)}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            {isFullscreen ? "Thu nhỏ" : "Toàn màn hình"}
          </button>
        </div>
      </div>
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
      <>
      <div className="content-border grid grid-cols-[1fr_1fr_1fr_auto] gap-2 p-3">
        {([
          { id: "manage", label: "Quản lý lớp", meta: `${filteredManagedClasses.length}/${classes.length} lớp` },
          { id: "create", label: "Tạo lớp", meta: `${activeCourses.length} khóa active` },
          { id: "events", label: "Lịch nghỉ", meta: `${scheduleEvents.length} mục` }
        ] satisfies Array<{ id: SetupPanel; label: string; meta: string }>).map((item) => {
          const isActive = setupPanel === item.id

          return (
            <button
              key={item.id}
              type="button"
              className={`rounded-2xl border px-4 py-3 text-left transition ${
                isActive
                  ? "border-brand-red/20 bg-white/70 text-brand-red shadow-[0_10px_24px_rgba(165,36,39,0.10)]"
                  : "border-brand-red/10 bg-white/35 text-stone-600 hover:text-brand-red"
              }`}
              onClick={() => setSetupPanel(item.id)}
            >
              <span className="block text-sm font-semibold">{item.label}</span>
              <span className="mt-1 block text-xs text-stone-500">{item.meta}</span>
            </button>
          )
        })}
        <button
          type="button"
          className="neu-list-item flex h-full min-h-[62px] items-center justify-center rounded-2xl px-3 text-stone-500 hover:text-brand-red"
          onClick={() => void loadSchedule()}
          title="Tải lại dữ liệu"
          aria-label="Tải lại dữ liệu"
        >
          <RefreshCcw className="h-4 w-4" />
        </button>
      </div>

      {setupPanel === "manage" ? (
      <div className="content-border p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm font-semibold text-brand-ink">Quản lý lớp học</p>
            <p className="mt-1 text-xs text-stone-500">Danh sách lớp, lịch lặp, học sinh và trạng thái đang mở.</p>
          </div>
          <div className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_160px_160px_auto] xl:min-w-[720px]">
            <label className="neu-pressed flex items-center gap-2 rounded-2xl px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-brand-red" />
              <input
                className="min-w-0 flex-1 bg-transparent text-sm text-brand-ink outline-none placeholder:text-stone-400"
                value={classSearch}
                onChange={(event) => setClassSearch(event.target.value)}
                placeholder="Tìm lớp, khóa, giáo viên..."
              />
            </label>
            <select
              className="neu-pressed rounded-2xl bg-transparent px-3 py-2 text-sm font-semibold text-stone-600 outline-none"
              value={classSubjectFilter}
              onChange={(event) => setClassSubjectFilter(event.target.value as ClassSubjectFilter)}
            >
              <option value="ALL">Tất cả môn</option>
              <option value="FUN">FUN</option>
              <option value="ROBOTICS">Robotics</option>
            </select>
            <select
              className="neu-pressed rounded-2xl bg-transparent px-3 py-2 text-sm font-semibold text-stone-600 outline-none"
              value={classStatusFilter}
              onChange={(event) => setClassStatusFilter(event.target.value as ClassStatusFilter)}
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang mở</option>
              <option value="INACTIVE">Tạm tắt</option>
            </select>
            <span className="rounded-2xl border border-brand-red/10 px-3 py-2 text-center text-xs font-semibold text-brand-red">
              {filteredManagedClasses.length}/{classes.length} lớp
            </span>
          </div>
        </div>
        <div className="mt-4 grid max-h-[52vh] gap-3 overflow-auto pr-1 lg:grid-cols-2 2xl:grid-cols-3">
          {filteredManagedClasses.length ? filteredManagedClasses.map((klass) => {
            const activeStudents = klass.students.filter((student) => student.isActive).length

            return (
              <button
                key={klass.id}
                type="button"
                className="neu-list-item rounded-2xl p-4 text-left transition hover:shadow-md"
                onClick={() => setSelectedManagedClassId(klass.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-brand-ink">{klass.name}</p>
                    {klass.code ? <p className="mt-1 truncate text-xs font-semibold text-brand-red">{klass.code}</p> : null}
                    <p className="mt-1 truncate text-xs text-stone-500">
                      Khóa: {klass.courseName} - {subjectLabels[klass.subject]}
                    </p>
                    <p className="mt-1 truncate text-xs text-stone-500">
                      GV {klass.teacherName}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-semibold ${klass.isActive ? "border-emerald-500/25 text-emerald-700" : "border-stone-300 text-stone-500"}`}>
                    {klass.isActive ? "Đang mở" : "Tạm tắt"}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-stone-600">
                  <span className="rounded-xl border border-brand-red/10 px-2 py-1.5">{activeStudents} học sinh</span>
                  <span className="rounded-xl border border-brand-red/10 px-2 py-1.5">{klass.generatedSessionCount} buổi</span>
                  <span className="truncate rounded-xl border border-brand-red/10 px-2 py-1.5">{klass.startTime}-{klass.endTime}</span>
                </div>
              </button>
            )
          }) : (
            <p className="rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500">
              {classes.length ? "Không có lớp phù hợp bộ lọc." : "Chưa có lớp học."}
            </p>
          )}
        </div>
      </div>
      ) : null}

      {setupPanel === "create" ? (
      <form className="content-border grid gap-3 p-5 xl:grid-cols-4" onSubmit={createClass}>
        <label className="block text-sm font-semibold text-stone-700">
          Mã lớp học
          <input className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none" value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} placeholder="VD: RO 001_25/05/31" />
        </label>
        <label className="block text-sm font-semibold text-stone-700">
          Tên lớp / khóa học mở
          <input className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
        </label>
        <label className="block text-sm font-semibold text-stone-700">
          Khóa học
          <select className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none" value={form.courseId} onChange={(event) => setForm((current) => ({ ...current, courseId: event.target.value }))} required>
            <option value="">Chọn khóa học</option>
            {activeCourses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name} - {subjectLabels[course.subject]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold text-stone-700">
          Giáo viên
          <select className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none" value={form.teacherId} onChange={(event) => setForm((current) => ({ ...current, teacherId: event.target.value }))} required>
            <option value="">Chọn giáo viên</option>
            {teacherOptions.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold text-stone-700">
          Ngày bắt đầu
          <input className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none" type="date" value={form.startDate} onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))} required />
        </label>
        <label className="block text-sm font-semibold text-stone-700">
          Số buổi sinh lịch
          <input className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none" type="number" min="1" max="200" value={form.plannedSessions} onChange={(event) => setForm((current) => ({ ...current, plannedSessions: event.target.value }))} required />
        </label>
        <label className="block text-sm font-semibold text-stone-700">
          Trạng thái lớp
          <select className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none" value={form.isActive ? "active" : "inactive"} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.value === "active" }))}>
            <option value="active">Đang mở</option>
            <option value="inactive">Tạm tắt</option>
          </select>
        </label>
        <div className="xl:col-span-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-stone-700">Lịch lặp trong tuần</p>
            <button type="button" className="neu-list-item inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold text-brand-red" onClick={addSlot}>
              <Plus className="h-3.5 w-3.5" />
              Thêm lịch học
            </button>
          </div>
          <div className="space-y-2">
            {form.slots.map((slot, index) => (
              <div key={`${slot.weekday}-${index}`} className="grid gap-2 rounded-2xl border border-brand-red/10 p-3 md:grid-cols-5">
                <select className="neu-pressed rounded-2xl bg-transparent px-3 py-2 text-sm outline-none" value={slot.weekday} onChange={(event) => setForm((current) => ({ ...current, slots: current.slots.map((item, slotIndex) => (slotIndex === index ? { ...item, weekday: event.target.value } : item)) }))}>
                  {weekdayColumns.map((day) => (
                    <option key={day.value} value={day.value}>
                      {day.short}
                    </option>
                  ))}
                </select>
                <input className="neu-pressed rounded-2xl bg-transparent px-3 py-2 text-sm outline-none" type="time" value={slot.startTime} onChange={(event) => setForm((current) => ({ ...current, slots: current.slots.map((item, slotIndex) => (slotIndex === index ? { ...item, startTime: event.target.value } : item)) }))} required />
                <input className="neu-pressed rounded-2xl bg-transparent px-3 py-2 text-sm outline-none" type="time" value={slot.endTime} onChange={(event) => setForm((current) => ({ ...current, slots: current.slots.map((item, slotIndex) => (slotIndex === index ? { ...item, endTime: event.target.value } : item)) }))} required />
                <input className="neu-pressed rounded-2xl bg-transparent px-3 py-2 text-sm outline-none" placeholder="Phòng" value={slot.room} onChange={(event) => setForm((current) => ({ ...current, slots: current.slots.map((item, slotIndex) => (slotIndex === index ? { ...item, room: event.target.value } : item)) }))} />
                <button type="button" className="neu-list-item rounded-2xl px-3 py-2 text-xs font-semibold text-brand-red disabled:opacity-40" disabled={form.slots.length === 1} onClick={() => removeSlot(index)}>
                  Xóa
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="xl:col-span-4">
          <p className="mb-3 text-sm font-semibold text-stone-700">Học sinh trong lớp</p>
          <div className="grid max-h-56 gap-2 overflow-auto rounded-2xl border border-brand-red/10 p-3 md:grid-cols-2 xl:grid-cols-3">
            {students.length ? (
              students.map((student) => (
                <label key={student.id} className="neu-list-item flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    checked={form.studentIds.includes(student.id)}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        studentIds: event.target.checked
                          ? [...current.studentIds, student.id]
                          : current.studentIds.filter((studentId) => studentId !== student.id)
                      }))
                    }
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-brand-ink">{student.name}</span>
                    <span className="block truncate text-xs text-stone-500">{student.parentName} - {student.parentPhone}</span>
                  </span>
                </label>
              ))
            ) : (
              <p className="text-sm text-stone-500">Chưa có học sinh để chọn.</p>
            )}
          </div>
        </div>
        <button type="submit" disabled={!canManageSchedule || isCreating || !form.courseId || !form.teacherId || !form.slots.length} className="glass-button-primary inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 xl:col-span-4">
          <CalendarDays className="h-4 w-4" />
          {isCreating ? "Đang sinh lịch" : "Tạo lớp và sinh thời khóa biểu"}
        </button>
      </form>
      ) : null}

      {setupPanel === "events" ? (
      <section className="content-border space-y-4 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-brand-ink">Lịch nghỉ lễ / sự kiện</p>
            <p className="mt-1 text-xs text-stone-500">Ngày có bật tự động chuyển lịch sẽ chuyển các buổi học chưa điểm danh sang ngày học kế tiếp.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!canManageSchedule || isSaving === "vietnam-holidays"}
              className="glass-button-secondary inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold disabled:opacity-60"
              onClick={() => void importVietnamHolidays()}
            >
              <CalendarDays className="h-4 w-4" />
              {isSaving === "vietnam-holidays" ? "Đang nạp" : `Nạp lễ/sự kiện VN ${selectedYear}`}
            </button>
            <button
              type="button"
              disabled={!canManageSchedule}
              className="glass-button-primary inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold disabled:opacity-60"
              onClick={() => setIsEventDialogOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Thêm lịch nghỉ
            </button>
          </div>
        </div>
        <div>
          <div className="grid max-h-[42vh] gap-2 overflow-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
            {scheduleEvents.length ? (
              scheduleEvents.map((event) => (
                <div key={event.id} className="neu-list-item flex items-center justify-between gap-3 rounded-2xl px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-brand-ink">{event.title}</p>
                    <p className="truncate text-xs text-stone-500">
                      {event.date.slice(0, 10)} - {scheduleEventTypeLabels[event.type]}
                      {event.affectsScheduling ? " - tự chuyển lịch" : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={!canManageSchedule || isSaving === event.id}
                    className="rounded-xl border border-brand-red/15 p-2 text-brand-red disabled:opacity-50"
                    onClick={() => void deleteScheduleEvent(event.id)}
                    aria-label="Xóa lịch nghỉ"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            ) : (
              <p className="rounded-2xl border border-brand-red/10 p-3 text-sm text-stone-500">Chưa có lịch nghỉ/sự kiện trong tháng.</p>
            )}
          </div>
        </div>
      </section>
      ) : null}
      </>
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
        <DialogShell
          eyebrow="Thông tin buổi học"
          title={selectedSession.className}
          description={`${selectedSession.courseName} - ${subjectLabels[selectedSession.subject]} - GV ${selectedSession.teacherName}`}
          onClose={() => {
            clearSessionPhotoFiles()
            setSelectedSession(null)
          }}
          closeLabel="Đóng thông tin buổi học"
          size="lg"
          panelClassName={dialogPanelClassName}
          bodyClassName={dialogBodyClassName}
        >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-brand-red/10 p-4">
                <p className="text-sm text-stone-500">Thời gian</p>
                <p className="mt-2 text-lg font-semibold text-brand-ink">
                  {selectedSession.date.slice(0, 10)} - {selectedSession.startTime} đến {selectedSession.endTime}
                </p>
                <p className="mt-2 text-sm text-stone-500">Phòng: {selectedSession.room || "Chưa chọn"}</p>
                <p className="mt-1 text-sm text-stone-500">Học viên: {selectedSession.studentCount}</p>
              </div>
              <div className="rounded-2xl border border-brand-red/10 p-4">
                <label className="block text-sm font-semibold text-stone-700">
                  Trạng thái buổi học
                  <select className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none" value={selectedSession.status} disabled={!canManageSchedule || isSaving === selectedSession.id} onChange={(event) => void patchSession(selectedSession.id, { status: event.target.value as ClassCalendarSessionItem["status"] })}>
                    <option value="SCHEDULED">Đã lên lịch</option>
                    <option value="COMPLETED">Đã học</option>
                    <option value="CANCELED">Nghỉ / hủy buổi</option>
                  </select>
                </label>
              </div>
            </div>
            <section className="content-border mt-4 rounded-2xl p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-brand-red">Album buổi học</p>
                  <h3 className="mt-1 text-base font-semibold text-brand-ink">Ảnh lớp nội bộ</h3>
                  <p className="mt-1 text-xs text-stone-500">
                    Quản lý ảnh theo buổi học. Ảnh riêng của bé sẽ được duyệt gửi trong profile học viên.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-semibold text-stone-600">
                  <span className="rounded-2xl border border-brand-red/10 px-3 py-2">{selectedSessionPhotos.length} ảnh</span>
                  <span className="rounded-2xl border border-brand-red/10 px-3 py-2">
                    {selectedSessionPhotos.filter((photo) => !photo.studentId).length} ảnh chung
                  </span>
                </div>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px_auto]">
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-stone-600">
                    Chọn ảnh lớp
                    <input
                      className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-3 py-2 text-sm text-brand-ink outline-none file:mr-3 file:rounded-xl file:border-0 file:bg-brand-red file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
                      type="file"
                      multiple
                      accept={classPhotoUploadAcceptedMimeTypes.join(",")}
                      onChange={selectSessionPhotoFiles}
                    />
                  </label>
                  {sessionPhotoPreviewUrls.length ? (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {sessionPhotoPreviewUrls.map((url, index) => (
                        <div key={url} className="rounded-2xl border border-brand-red/10 bg-white/45 p-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt={`Ảnh lớp ${index + 1}`} className="h-24 w-full rounded-xl object-cover" />
                          <p className="mt-2 truncate text-xs font-semibold text-brand-ink">{sessionPhotoFiles[index]?.name}</p>
                          <p className="mt-1 text-xs text-stone-500">{formatFileSize(sessionPhotoFiles[index]?.size ?? 0)}</p>
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
                      value={sessionPhotoCaption}
                      onChange={(event) => setSessionPhotoCaption(event.target.value)}
                      placeholder="Hoạt động, sản phẩm, khoảnh khắc nổi bật..."
                    />
                  </label>
                  <label className="block text-xs font-semibold text-stone-600">
                    URL ảnh dự phòng
                    <input
                      className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-3 py-2 text-sm text-brand-ink outline-none placeholder:text-stone-400 disabled:opacity-60"
                      value={sessionPhotoUrl}
                      disabled={sessionPhotoFiles.length > 0}
                      onChange={(event) => setSessionPhotoUrl(event.target.value)}
                      placeholder="https://..."
                    />
                  </label>
                </div>
                <div className="flex flex-col gap-2 lg:items-end lg:justify-end">
                  <button
                    type="button"
                    disabled={photoSavingId === "session-album"}
                    onClick={() => void submitSessionAlbumPhotos()}
                    className="glass-button-primary inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold disabled:opacity-50"
                  >
                    <UploadCloud className="h-4 w-4" />
                    {photoSavingId === "session-album" ? "Đang lưu" : "Lưu album"}
                  </button>
                  {sessionPhotoFiles.length ? (
                    <button
                      type="button"
                      className="rounded-2xl border border-brand-red/15 px-4 py-2 text-xs font-semibold text-brand-red"
                      onClick={clearSessionPhotoFiles}
                    >
                      Gỡ ảnh chọn
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {selectedSessionPhotos.length ? selectedSessionPhotos.map((photo) => (
                  <article key={photo.id} className="overflow-hidden rounded-2xl border border-brand-red/10 bg-white/45">
                    <a href={photo.url} target="_blank" rel="noreferrer" className="block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.url} alt={photo.caption || "Ảnh lớp học"} className="h-40 w-full object-cover" />
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
                  <p className="rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500 md:col-span-2">
                    Chưa có ảnh cho buổi học này.
                  </p>
                )}
              </div>
            </section>
            <div className="mt-4 rounded-2xl border border-brand-red/10 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-brand-ink">Học sinh trong lớp</p>
                  <p className="mt-1 text-xs text-stone-500">Danh sách này áp dụng cho tất cả buổi học được sinh từ lớp.</p>
                </div>
                <select
                  className="neu-pressed rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none disabled:opacity-50"
                  disabled={!canManageSchedule || !selectedClass}
                  defaultValue=""
                  onChange={(event) => {
                    if (!selectedClass || !event.target.value) return
                    void updateClassStudents(selectedClass.id, [
                      ...selectedClassStudents.map((student) => student.studentId),
                      event.target.value
                    ])
                    event.target.value = ""
                  }}
                >
                  <option value="">Thêm học sinh</option>
                  {availableStudentsForSelectedClass
                    .filter((student) => !selectedClassStudents.some((item) => item.studentId === student.id))
                    .map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.name} - {student.parentName}
                      </option>
                    ))}
                </select>
              </div>
              <div className="mt-3 space-y-2">
                {selectedClassStudents.length ? (
                  selectedClassStudents.map((student) => (
                    <div key={student.id} className="neu-list-item flex items-center justify-between gap-3 rounded-2xl px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-brand-ink">{student.studentName}</p>
                        <p className="truncate text-xs text-stone-500">
                          {student.parentName} - {student.parentPhone}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={!canManageSchedule || isSaving === selectedClass?.id}
                        className="rounded-xl border border-brand-red/15 px-3 py-2 text-xs font-semibold text-brand-red disabled:opacity-50"
                        onClick={() =>
                          selectedClass
                            ? void updateClassStudents(
                                selectedClass.id,
                                selectedClassStudents.filter((item) => item.studentId !== student.studentId).map((item) => item.studentId)
                              )
                            : undefined
                        }
                      >
                        Xóa
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl border border-brand-red/10 p-3 text-sm text-stone-500">Lớp này chưa có học sinh.</p>
                )}
              </div>
            </div>
        </DialogShell>
      ) : null}

      {selectedManagedClass ? (
        <DialogShell
          eyebrow="Quản lý lớp học"
          title={selectedManagedClass.name}
          description={`Khóa: ${selectedManagedClass.courseName} - ${subjectLabels[selectedManagedClass.subject]} - GV ${selectedManagedClass.teacherName}`}
          onClose={() => setSelectedManagedClassId(null)}
          closeLabel="Đóng quản lý lớp"
          size="xl"
          panelClassName={dialogPanelClassName}
          bodyClassName="bg-[#fffaf7] p-0"
        >
            <div className="content-border grid gap-3 p-5 md:grid-cols-3 xl:grid-cols-4">
              <ClassMetric label="Khóa học" value={selectedManagedClass.courseName} />
              <ClassMetric label="Mã lớp học" value={selectedManagedClass.code ?? "Chưa có"} />
              <ClassMetric label="Môn học" value={subjectLabels[selectedManagedClass.subject]} />
              <ClassMetric label="Giáo viên" value={selectedManagedClass.teacherName} />
              <ClassMetric label="Trạng thái" value={selectedManagedClass.isActive ? "Đang mở" : "Tạm tắt"} />
              <ClassMetric label="Học sinh active" value={`${selectedManagedClassStudents.length}`} />
              <ClassMetric label="Buổi đã sinh" value={`${selectedManagedClass.generatedSessionCount}`} />
              <ClassMetric label="Ngày bắt đầu" value={selectedManagedClass.startDate?.slice(0, 10) ?? "Chưa có"} />
              <ClassMetric label="Số buổi dự kiến" value={`${selectedManagedClass.plannedSessions ?? "-"} buổi`} />
            </div>

            <div className="grid gap-4 p-5 lg:grid-cols-[0.9fr_1.1fr]">
              <section className="rounded-2xl border border-brand-red/10 bg-white/45 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-brand-ink">Lịch lặp</p>
                    <p className="mt-1 text-xs text-stone-500">Các ngày dùng để sinh thời khóa biểu.</p>
                  </div>
                  <button
                    type="button"
                    disabled={!canManageSchedule || isSaving === selectedManagedClass.id}
                    className="rounded-2xl border border-brand-red/20 px-3 py-2 text-xs font-semibold text-brand-red disabled:opacity-50"
                    onClick={() => void patchClass(selectedManagedClass.id, { isActive: !selectedManagedClass.isActive })}
                  >
                    {selectedManagedClass.isActive ? "Tạm tắt lớp" : "Mở lại lớp"}
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  {selectedManagedClass.scheduleSlots.length ? selectedManagedClass.scheduleSlots.map((slot) => (
                    <div key={slot.id} className="rounded-2xl border border-brand-red/10 px-3 py-2 text-sm text-stone-600">
                      {weekdayColumns.find((day) => day.value === slot.weekday)?.label ?? `Thứ ${slot.weekday}`} · {slot.startTime}-{slot.endTime}
                      {slot.room ? ` · ${slot.room}` : ""}
                    </div>
                  )) : (
                    <p className="rounded-2xl border border-brand-red/10 p-3 text-sm text-stone-500">Chưa có lịch lặp.</p>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-brand-red/10 bg-white/45 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-brand-ink">Học sinh trong lớp</p>
                    <p className="mt-1 text-xs text-stone-500">Roster active dùng cho điểm danh và cổng phụ huynh.</p>
                  </div>
                  <select
                    className="neu-pressed rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none disabled:opacity-50"
                    disabled={!canManageSchedule}
                    defaultValue=""
                    onChange={(event) => {
                      if (!event.target.value) return
                      void updateClassStudents(selectedManagedClass.id, [
                        ...selectedManagedClassStudents.map((student) => student.studentId),
                        event.target.value
                      ])
                      event.target.value = ""
                    }}
                  >
                    <option value="">Thêm học sinh</option>
                    {availableStudentsForManagedClass
                      .filter((student) => !selectedManagedClassStudents.some((item) => item.studentId === student.id))
                      .map((student) => (
                        <option key={student.id} value={student.id}>
                          {student.name} - {student.parentName}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="mt-3 max-h-72 space-y-2 overflow-auto">
                  {selectedManagedClassStudents.length ? selectedManagedClassStudents.map((student) => (
                    <div key={student.id} className="neu-list-item flex items-center justify-between gap-3 rounded-2xl px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-brand-ink">{student.studentName}</p>
                        <p className="truncate text-xs text-stone-500">
                          {student.parentName} - {student.parentPhone}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={!canManageSchedule || isSaving === selectedManagedClass.id}
                        className="rounded-xl border border-brand-red/15 px-3 py-2 text-xs font-semibold text-brand-red disabled:opacity-50"
                        onClick={() =>
                          void updateClassStudents(
                            selectedManagedClass.id,
                            selectedManagedClassStudents.filter((item) => item.studentId !== student.studentId).map((item) => item.studentId)
                          )
                        }
                      >
                        Xóa
                      </button>
                    </div>
                  )) : (
                    <p className="rounded-2xl border border-brand-red/10 p-3 text-sm text-stone-500">Lớp này chưa có học sinh active.</p>
                  )}
                </div>
              </section>
            </div>
        </DialogShell>
      ) : null}
    </section>
  )
}
