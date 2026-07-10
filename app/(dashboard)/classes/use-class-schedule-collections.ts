import { useMemo } from "react"
import { subjectLabels } from "@/lib/contracts/assessment"
import type { ClassCalendarSessionItem, ClassListItem, CourseListItem } from "@/lib/contracts/courses"
import type { ScheduleEventItem } from "@/lib/contracts/schedule-events"
import type { StudentListItem } from "@/lib/contracts/students"
import type { UserListItem } from "@/lib/contracts/users"
import type { ClassStatusFilter, ClassSubjectFilter } from "./class-schedule-state"
import { getMonthCells, getWeekCells, uniqueMonthKeys } from "./class-schedule-utils"

type UseClassScheduleCollectionsInput = {
  courses: CourseListItem[]
  users: UserListItem[]
  classes: ClassListItem[]
  students: StudentListItem[]
  sessions: ClassCalendarSessionItem[]
  scheduleEvents: ScheduleEventItem[]
  selectedSession: ClassCalendarSessionItem | null
  selectedManagedClassId: string | null
  classSearch: string
  classSubjectFilter: ClassSubjectFilter
  classStatusFilter: ClassStatusFilter
  month: string
  weekStart: Date
  view: "calendar" | "week" | "setup"
}

export function useClassScheduleCollections({
  courses,
  users,
  classes,
  students,
  sessions,
  scheduleEvents,
  selectedSession,
  selectedManagedClassId,
  classSearch,
  classSubjectFilter,
  classStatusFilter,
  month,
  weekStart,
  view
}: UseClassScheduleCollectionsInput) {
  const activeCourses = useMemo(() => courses.filter((course) => course.isActive), [courses])
  const teacherOptions = useMemo(() => users.filter((user) => user.role === "TEACHER" && user.isActive), [users])
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

  return {
    activeCourses,
    teacherOptions,
    selectedClass,
    selectedClassStudents,
    selectedManagedClass,
    filteredManagedClasses,
    selectedManagedClassStudents,
    availableStudentsForSelectedClass,
    availableStudentsForManagedClass,
    monthCells,
    weekCells,
    calendarCells,
    calendarFetchMonths,
    sessionsByDate,
    eventsByDate
  }
}
