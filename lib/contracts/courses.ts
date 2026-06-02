import type { SubjectKey } from "@/lib/contracts/assessment"

export type CourseListItem = {
  id: string
  name: string
  subject: SubjectKey
  description?: string
  totalSessions: number
  price: string
  isActive: boolean
}

export type ClassListItem = {
  id: string
  name: string
  courseId: string
  courseName: string
  subject: SubjectKey
  teacherId: string
  teacherName: string
  weekday: number
  startTime: string
  endTime: string
  room?: string
  startDate?: string
  plannedSessions?: number
  isActive: boolean
  scheduleSlots: ClassScheduleSlotItem[]
  students: ClassStudentItem[]
  generatedSessionCount: number
}

export type ClassStudentItem = {
  id: string
  studentId: string
  studentName: string
  parentName: string
  parentPhone: string
  isActive: boolean
}

export type ClassScheduleSlotItem = {
  id: string
  weekday: number
  startTime: string
  endTime: string
  room?: string
  isActive: boolean
}

export type ClassSessionStatusKey = "SCHEDULED" | "CANCELED" | "COMPLETED"

export type ClassCalendarSessionItem = {
  id: string
  classId: string
  className: string
  courseName: string
  subject: SubjectKey
  teacherName: string
  substituteTeacherName?: string
  studentCount: number
  date: string
  weekday: number
  startTime: string
  endTime: string
  room?: string
  status: ClassSessionStatusKey
}
