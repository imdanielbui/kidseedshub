import type { FinalAssessmentResult, SubjectKey } from "@/lib/contracts/assessment"
import type { AbsenceRequestStatusKey } from "@/lib/contracts/absence-requests"
import type { AttendanceStatusKey } from "@/lib/contracts/classes"
import type { CourseFeedbackItem } from "@/lib/contracts/course-feedback"

export type ParentPortalCourse = {
  enrollmentId: string
  courseName: string
  subject: SubjectKey
  sessionsBought: number
  sessionsUsed: number
  sessionsRemaining: number
  isActive: boolean
}

export type ParentPortalSession = {
  id: string
  className: string
  courseName: string
  subject: SubjectKey
  teacherName: string
  date: string
  startTime: string
  endTime: string
  room?: string
  absenceRequest?: {
    id: string
    status: AbsenceRequestStatusKey
    reason: string
  }
}

export type ParentPortalJournalItem = {
  id: string
  date: string
  courseName: string
  subject: SubjectKey
  className?: string
  status: AttendanceStatusKey
  note?: string
  photos: Array<{
    id: string
    url: string
    takenAt: string
  }>
}

export type ParentPortalChild = {
  id: string
  code: string
  name: string
  status: string
  healthNote?: string
  courses: ParentPortalCourse[]
  upcomingSessions: ParentPortalSession[]
  journal: ParentPortalJournalItem[]
  finalAssessments: FinalAssessmentResult[]
  feedbacks: CourseFeedbackItem[]
}

export type ParentPortalOverview = {
  parentName: string
  children: ParentPortalChild[]
}
