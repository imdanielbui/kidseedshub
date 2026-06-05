"use client"

import { CalendarDays, ChevronLeft, ChevronRight, Maximize2, Minimize2, Plus, RefreshCcw, Search, Trash2 } from "lucide-react"
import { FormEvent, useEffect, useMemo, useState } from "react"
import { DialogFormShell, DialogShell } from "@/components/shared/dialog-shell"
import type { ApiResponse } from "@/lib/api-response"
import { subjectLabels } from "@/lib/contracts/assessment"
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

const weekdayColumns = [
  { value: 1, label: "Thứ Hai", short: "T2" },
  { value: 2, label: "Thứ Ba", short: "T3" },
  { value: 3, label: "Thứ Tư", short: "T4" },
  { value: 4, label: "Thứ Năm", short: "T5" },
  { value: 5, label: "Thứ Sáu", short: "T6" },
  { value: 6, label: "Thứ Bảy", short: "T7" },
  { value: 0, label: "Chủ Nhật", short: "CN" }
]

const today = new Date()
const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`
const defaultDate = today.toISOString().slice(0, 10)

const emptyClassForm: ClassFormState = {
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

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function monthTitle(month: string) {
  const [year, value] = month.split("-").map(Number)
  return new Intl.DateTimeFormat("vi-VN", { month: "long", year: "numeric" }).format(new Date(year, value - 1, 1))
}

function shiftMonth(month: string, delta: number) {
  const [year, value] = month.split("-").map(Number)
  const date = new Date(year, value - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

function getMonthCells(month: string) {
  const [year, value] = month.split("-").map(Number)
  const firstDay = new Date(year, value - 1, 1)
  const startOffset = (firstDay.getDay() + 6) % 7
  const firstCell = new Date(firstDay)
  firstCell.setDate(firstDay.getDate() - startOffset)

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstCell)
    date.setDate(firstCell.getDate() + index)
    return date
  })
}

function sessionTone(session: ClassCalendarSessionItem) {
  if (session.status === "CANCELED") return "border-stone-300 bg-stone-200 text-stone-600"
  if (session.status === "COMPLETED") return "border-emerald-600 bg-emerald-600 text-white"
  return session.subject === "FUN" ? "border-lime-500 bg-lime-500 text-white" : "border-indigo-500 bg-indigo-500 text-white"
}

type ClassScheduleBoardProps = {
  view?: "calendar" | "setup"
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
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [canManageSchedule, setCanManageSchedule] = useState(false)

  const activeCourses = useMemo(() => courses.filter((course) => course.isActive), [courses])
  const teacherOptions = useMemo(() => users.filter((user) => user.role === "TEACHER" && user.isActive), [users])
  const selectedYear = Number(month.slice(0, 4))
  const selectedClass = useMemo(
    () => (selectedSession ? classes.find((klass) => klass.id === selectedSession.classId) : undefined),
    [classes, selectedSession]
  )
  const selectedClassStudents = selectedClass?.students.filter((student) => student.isActive) ?? []
  const selectedManagedClass = useMemo(
    () => classes.find((klass) => klass.id === selectedManagedClassId),
    [classes, selectedManagedClassId]
  )
  const filteredManagedClasses = useMemo(() => {
    const query = classSearch.trim().toLowerCase()

    return classes.filter((klass) => {
      const matchesSearch = !query || [klass.name, klass.courseName, klass.teacherName, subjectLabels[klass.subject]]
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
  const sessionsByDate = useMemo(
    () =>
      sessions.reduce<Record<string, ClassCalendarSessionItem[]>>((grouped, session) => {
        const key = session.date.slice(0, 10)
        grouped[key] = [...(grouped[key] ?? []), session].sort((first, second) => first.startTime.localeCompare(second.startTime))
        return grouped
      }, {}),
    [sessions]
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

    const [sessionsResponse, eventsResponse, classesResponse, coursesResponse, studentsResponse, usersResponse] = await Promise.all([
      fetch(`/api/class-sessions?month=${month}`, { cache: "no-store" }),
      fetch(`/api/schedule-events?month=${month}`, { cache: "no-store" }),
      fetch("/api/classes", { cache: "no-store" }),
      fetch("/api/courses", { cache: "no-store" }),
      fetch("/api/students", { cache: "no-store" }),
      fetch("/api/users", { cache: "no-store" })
    ])
    const [sessionsPayload, eventsPayload, classesPayload, coursesPayload, studentsPayload, usersPayload] = (await Promise.all([
      sessionsResponse.json(),
      eventsResponse.json(),
      classesResponse.json(),
      coursesResponse.json(),
      studentsResponse.json(),
      usersResponse.json()
    ])) as [
      ApiResponse<ClassCalendarSessionItem[]>,
      ApiResponse<ScheduleEventItem[]>,
      ApiResponse<ClassListItem[]>,
      ApiResponse<CourseListItem[]>,
      ApiResponse<StudentListItem[]>,
      ApiResponse<UserListItem[]>
    ]

    if (sessionsPayload.success && sessionsPayload.data) {
      setSessions(sessionsPayload.data)
    } else {
      setSessions([])
      setError(sessionsPayload.error?.message ?? "Không tải được lịch học.")
    }

    if (eventsPayload.success && eventsPayload.data) {
      setScheduleEvents(eventsPayload.data)
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
  }, [month])

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

      setMessage(`Đã tạo lịch nghỉ/sự kiện. Đã dời ${payload.data.movedSessions ?? 0} buổi học sang ngày học kế tiếp.`)
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

      setMessage(`Đã nạp lịch ngày lễ/sự kiện Việt Nam ${payload.data.year}: thêm ${payload.data.created} mục, bỏ qua ${payload.data.skipped} mục đã có, dời ${payload.data.movedSessions} buổi học.`)
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

  return (
    <section className={`neu-card rounded-3xl ${isFullscreen ? "fixed inset-0 z-40 overflow-auto rounded-none bg-brand-bg p-4" : ""}`}>
      {view === "calendar" ? (
      <div className="flex flex-col gap-3 p-4 xl:flex-row xl:items-center xl:justify-between">
        <h2 className="text-lg font-semibold text-brand-ink">Lịch tháng</h2>
        <div className="flex flex-wrap gap-2 xl:justify-end">
          <button type="button" className="neu-list-item rounded-2xl p-3 text-brand-red" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Tháng trước">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" className="neu-list-item rounded-2xl px-4 py-3 text-sm font-semibold text-brand-ink" onClick={() => setMonth(defaultMonth)}>
            Hôm nay
          </button>
          <button type="button" className="neu-list-item rounded-2xl p-3 text-brand-red" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Tháng sau">
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
      <div className="content-border mt-5 p-3">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xl font-semibold capitalize text-brand-ink">{monthTitle(month)}</h3>
          <div className="flex gap-2 text-xs font-semibold">
            <span className="rounded-full bg-lime-500 px-2 py-1 text-white">FUN</span>
            <span className="rounded-full bg-indigo-500 px-2 py-1 text-white">Robotics</span>
            <span className="rounded-full bg-brand-red px-2 py-1 text-white">Nghỉ lễ</span>
          </div>
        </div>
        <div className="grid grid-cols-7 border-l border-t border-brand-red/10">
          {weekdayColumns.map((day) => (
            <div key={day.value} className="border-b border-r border-brand-red/10 bg-white/40 p-2 text-center text-xs font-semibold text-brand-ink">
              {day.label}
            </div>
          ))}
          {monthCells.map((date) => {
            const key = toDateKey(date)
            const daySessions = sessionsByDate[key] ?? []
            const dayEvents = eventsByDate[key] ?? []
            const isCurrentMonth = key.startsWith(month)
            const isToday = key === defaultDate
            const isBlocked = dayEvents.some((event) => event.affectsScheduling)

            return (
              <div
                key={key}
                className={`min-h-32 border-b border-r border-brand-red/10 p-1 transition-colors ${isCurrentMonth ? "bg-white/25" : "bg-stone-100/40"} ${
                  isToday ? "bg-brand-red/5" : ""
                } ${isBlocked ? "bg-brand-red/10" : ""}`}
                onDragOver={(event) => {
                  if (!canManageSchedule) return
                  event.preventDefault()
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  dropSessionOnDate(date)
                }}
              >
                <div className={`mb-1 text-right text-xs ${isCurrentMonth ? "text-brand-ink" : "text-stone-400"}`}>{date.getDate()}</div>
                <div className="space-y-1">
                  {dayEvents.map((event) => (
                    <div
                      key={event.id}
                      className={`rounded px-1.5 py-1 text-[11px] font-semibold ${
                        event.affectsScheduling ? "bg-brand-red text-white" : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      <span className="block truncate">{event.title}</span>
                    </div>
                  ))}
                  {isLoading ? <p className="rounded border border-brand-red/10 p-1 text-xs text-stone-400">...</p> : null}
                  {daySessions.map((session) => (
                    <button
                      key={session.id}
                      type="button"
                      draggable={canManageSchedule}
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", session.id)
                        setDraggingSessionId(session.id)
                      }}
                      onDragEnd={() => setDraggingSessionId(null)}
                      onClick={() => setSelectedSession(session)}
                      className={`w-full rounded border px-1.5 py-1 text-left text-[11px] font-semibold leading-4 shadow-sm transition hover:shadow-md ${sessionTone(session)} ${
                        draggingSessionId === session.id ? "opacity-60" : ""
                      }`}
                    >
                      <span className="block truncate">
                        {session.startTime} - {session.endTime}
                      </span>
                      <span className="block truncate">{session.className}</span>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
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
        <label className="block text-sm font-semibold text-stone-700 xl:col-span-2">
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
        <DialogFormShell
          eyebrow="Lịch nghỉ"
          title="Thêm lịch nghỉ / sự kiện"
          description="Ngày nghỉ có bật tự động chuyển lịch sẽ chuyển các buổi học chưa điểm danh sang ngày học kế tiếp của lớp."
          onClose={() => setIsEventDialogOpen(false)}
          closeLabel="Đóng form lịch nghỉ"
          size="lg"
          overlayClassName="items-start justify-center px-4 pb-4 pt-6"
          panelClassName="border border-brand-red/20 bg-white shadow-[0_32px_90px_rgba(69,38,28,0.28)] ring-1 ring-white"
          bodyClassName="bg-[#fffaf7] p-5"
          onSubmit={createScheduleEvent}
          footer={
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                className="neu-list-item inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold text-stone-600 hover:text-brand-red"
                onClick={() => setIsEventDialogOpen(false)}
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={!canManageSchedule || isSaving === "schedule-event"}
                className="glass-button-primary inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                {isSaving === "schedule-event" ? "Đang lưu" : "Thêm lịch nghỉ"}
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="rounded-3xl border border-brand-red/15 bg-white p-4 shadow-sm">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500 md:col-span-2">
                  Tên ngày nghỉ / sự kiện
                  <input
                    className="mt-2 w-full rounded-2xl border border-brand-red/10 bg-[#fffaf7] px-3 py-2 text-sm normal-case tracking-normal text-brand-ink outline-none"
                    value={eventForm.title}
                    onChange={(event) => setEventForm((current) => ({ ...current, title: event.target.value }))}
                    required
                  />
                </label>
                <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Ngày
                  <input
                    className="mt-2 w-full rounded-2xl border border-brand-red/10 bg-[#fffaf7] px-3 py-2 text-sm normal-case tracking-normal text-brand-ink outline-none"
                    type="date"
                    value={eventForm.date}
                    onChange={(event) => setEventForm((current) => ({ ...current, date: event.target.value }))}
                    required
                  />
                </label>
                <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Loại
                  <select
                    className="mt-2 w-full rounded-2xl border border-brand-red/10 bg-[#fffaf7] px-3 py-2 text-sm normal-case tracking-normal text-brand-ink outline-none"
                    value={eventForm.type}
                    onChange={(event) => setEventForm((current) => ({ ...current, type: event.target.value as EventFormState["type"] }))}
                  >
                    <option value="HOLIDAY">Nghỉ lễ</option>
                    <option value="EVENT">Sự kiện</option>
                  </select>
                </label>
                <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500 md:col-span-2">
                  Ghi chú
                  <input
                    className="mt-2 w-full rounded-2xl border border-brand-red/10 bg-[#fffaf7] px-3 py-2 text-sm normal-case tracking-normal text-brand-ink outline-none"
                    value={eventForm.note}
                    onChange={(event) => setEventForm((current) => ({ ...current, note: event.target.value }))}
                  />
                </label>
              </div>
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-3xl border border-brand-red/15 bg-white p-4 shadow-sm">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-brand-red"
                checked={eventForm.affectsScheduling}
                onChange={(event) => setEventForm((current) => ({ ...current, affectsScheduling: event.target.checked }))}
              />
              <span>
                <span className="block text-sm font-semibold text-brand-ink">Tự động chuyển lịch học</span>
                <span className="mt-1 block text-xs leading-5 text-stone-500">
                  Chỉ các buổi chưa điểm danh mới được chuyển. Hệ thống chuyển lịch theo chuỗi ngày học kế tiếp của lớp để tránh trùng lịch.
                </span>
              </span>
            </label>
          </div>
        </DialogFormShell>
      ) : null}

      {selectedSession ? (
        <DialogShell
          eyebrow="Thông tin buổi học"
          title={selectedSession.className}
          description={`${selectedSession.courseName} - ${subjectLabels[selectedSession.subject]} - GV ${selectedSession.teacherName}`}
          onClose={() => setSelectedSession(null)}
          closeLabel="Đóng thông tin buổi học"
          size="lg"
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
          bodyClassName="p-0"
        >
            <div className="content-border grid gap-3 p-5 md:grid-cols-3 xl:grid-cols-4">
              <ClassMetric label="Khóa học" value={selectedManagedClass.courseName} />
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

function ClassMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-brand-red/10 bg-white/45 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-brand-ink">{value}</p>
    </div>
  )
}
