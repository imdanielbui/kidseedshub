import type { ContactResultKey, TaskStatusKey } from "@/lib/contracts/crm"
import type { ClassProgressSummary } from "@/lib/contracts/class-progress"
import type { AssessmentStatusKey, SubjectKey } from "@/lib/contracts/assessment"
import type { AttendanceStatusKey } from "@/lib/contracts/classes"

export const studentStatusLabels = {
  LEAD: "Lead",
  TRIAL: "Học thử",
  EVALUATION: "Đánh giá",
  CONVERTED: "Đã chốt",
  RETENTION: "Retention",
  NURTURE: "Nurture",
  ACTIVE: "Đang học",
  INACTIVE: "Tạm dừng",
  GRADUATED: "Hoàn thành"
} as const

export type StudentStatusKey = keyof typeof studentStatusLabels

export const genderLabels = {
  MALE: "Nam",
  FEMALE: "Nữ",
  OTHER: "Khác",
  UNKNOWN: "Chưa rõ"
} as const

export type StudentGenderKey = keyof typeof genderLabels

export type StudentCourseBalance = {
  enrollmentId: string
  classId?: string
  className?: string
  courseId: string
  courseName: string
  courseSubject: "FUN" | "ROBOTICS"
  courseTotalSessions: number
  coursePrice: string
  sessionsBought: number
  sessionsUsed: number
  sessionsRemaining: number
  startDate?: string
  endDate?: string
  joinSessionNumber?: number
  totalCourseSessionsAtJoin?: number
  freeTrialSessions: number
  paidSessionsBeforeReceipt: number
  classProgress?: ClassProgressSummary
  isActive: boolean
}

export type ParentAccountInfo = {
  phone: string
  email?: string
  isActive: boolean
  canLogin: boolean
  activatedAt?: string
  temporaryPassword?: string
}

export type StudentListItem = {
  id: string
  code: string
  name: string
  status: StudentStatusKey
  gender: StudentGenderKey
  address?: string
  parentName: string
  parentPhone: string
  leadSource?: string
  healthNote?: string
  assignedTeacherName?: string
  saleOwnerName?: string
  createdByName?: string
  sessionsRemaining: number
  courses: StudentCourseBalance[]
  createdAt: string
  updatedAt: string
}

export type StudentStatusUpdateResult = {
  id: string
  code: string
  name: string
  status: StudentStatusKey
  stageChangedAt: string
  parentName: string
  parentPhone: string
  assignedTeacherName?: string
  updatedAt: string
}

export type StudentContactLogItem = {
  id: string
  content: string
  result: ContactResultKey
  loggedByName: string
  createdAt: string
}

export type StudentTaskItem = {
  id: string
  title: string
  note?: string
  status: TaskStatusKey
  studentName?: string
  assignedToName: string
  dueDate: string
}

export type StudentClassItem = {
  id: string
  name: string
  courseName: string
  teacherName: string
  weekday: number
  startTime: string
  endTime: string
  progress?: ClassProgressSummary
}

export type StudentPhotoItem = {
  id: string
  studentId?: string
  url: string
  caption?: string
  attendanceId?: string
  classSessionId?: string
  className?: string
  courseName?: string
  attendanceStatus?: AttendanceStatusKey
  takenAt: string
  isFeatured: boolean
  isPublished: boolean
  sentToParentAt?: string
  createdByName?: string
}

export type StudentLearningTimelineItem = {
  id: string
  type: "course" | "attendance" | "photo" | "weekly_assessment" | "final_assessment"
  title: string
  description?: string
  date: string
  meta?: string
  status?: AttendanceStatusKey | AssessmentStatusKey
  subject?: SubjectKey
}

export type StudentAssessmentProgressItem = {
  enrollmentId: string
  courseName: string
  subject: SubjectKey
  completedWeeks: number
  totalWeeks: number
  latestWeek?: number
  checkedItems: number
  totalItems: number
  finalAssessmentId?: string
  finalCreatedAt?: string
}

export type StudentDetail = StudentListItem & {
  birthDate?: string
  parentEmail?: string
  leadNote?: string
  saleOwnerName?: string
  createdByName?: string
  parentAccount: ParentAccountInfo
  classes: StudentClassItem[]
  photos: StudentPhotoItem[]
  learningTimeline: StudentLearningTimelineItem[]
  assessmentProgress: StudentAssessmentProgressItem[]
  contactLogs: StudentContactLogItem[]
  tasks: StudentTaskItem[]
  permissions: {
    canPublishPhotos: boolean
  }
}
