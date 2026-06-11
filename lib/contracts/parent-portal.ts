import type { FinalAssessmentResult, SubjectKey } from "@/lib/contracts/assessment"
import type { AbsenceRequestStatusKey } from "@/lib/contracts/absence-requests"
import type { AttendanceStatusKey } from "@/lib/contracts/classes"
import type { CourseFeedbackItem } from "@/lib/contracts/course-feedback"
import type { MakeupEntitlementStatusKey } from "@/lib/contracts/makeup-entitlements"
import type { StudentWalletEntryTypeKey } from "@/lib/contracts/student-wallet"

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
    caption?: string
    takenAt: string
  }>
}

export type ParentPortalNotice = {
  id: string
  type: "SCHEDULE" | "ABSENCE" | "MAKEUP" | "WALLET" | "REPORT"
  title: string
  body: string
  date: string
  status?: string
}

export type ParentPortalChild = {
  id: string
  code: string
  name: string
  status: string
  healthNote?: string
  courses: ParentPortalCourse[]
  upcomingSessions: ParentPortalSession[]
  notices: ParentPortalNotice[]
  journal: ParentPortalJournalItem[]
  finalAssessments: FinalAssessmentResult[]
  feedbacks: CourseFeedbackItem[]
  makeupEntitlements: Array<{
    id: string
    enrollmentId: string
    courseName: string
    className?: string
    month: string
    status: MakeupEntitlementStatusKey
    isEligible: boolean
    eligibilityReason?: string
    scheduledFor?: string
    resolvedAmount?: string
    resolvedAt?: string
    refundExpenseCode?: string
  }>
  walletBalance: string
  walletEntries: Array<{
    id: string
    amount: string
    type: StudentWalletEntryTypeKey
    note?: string
    receiptCode?: string
    createdByName: string
    createdAt: string
  }>
}

export type ParentPortalOverview = {
  parentName: string
  children: ParentPortalChild[]
}
