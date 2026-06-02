export const subjectLabels = {
  FUN: "FUN",
  ROBOTICS: "Robotics"
} as const

export type SubjectKey = keyof typeof subjectLabels

export const rubricConfigStatusLabels = {
  DRAFT: "Bản nháp",
  ACTIVE: "Đang dùng",
  ARCHIVED: "Đã lưu trữ"
} as const

export type RubricConfigStatusKey = keyof typeof rubricConfigStatusLabels

export const finalAssessmentStatusLabels = {
  DRAFT: "Bản nháp",
  READY: "Chờ gửi",
  PUBLISHED: "Đã gửi phụ huynh"
} as const

export type FinalAssessmentStatusKey = keyof typeof finalAssessmentStatusLabels

export const progressLevelLabels = {
  BEGINNING: "Mới bắt đầu",
  PROGRESSING: "Đang tiến bộ",
  PROFICIENT: "Thành thạo"
} as const

export const progressLevelDescriptions = {
  BEGINNING: "Cần giáo viên hỗ trợ nhiều.",
  PROGRESSING: "Đang thực hành tốt hơn qua từng buổi.",
  PROFICIENT: "Có thể thực hiện ổn định và chủ động."
} as const

export type ProgressLevelKey = keyof typeof progressLevelLabels

export type RoboticsAgeGroup = "5-6" | "7-10" | "11-14"

export const assessmentStatusLabels = {
  NOT_STARTED: "Chưa làm",
  IN_PROGRESS: "Đang làm",
  COMPLETE: "Hoàn thành"
} as const

export type AssessmentStatusKey = keyof typeof assessmentStatusLabels

export type WeeklyAssessmentListItem = {
  id: string
  enrollmentId: string
  studentName: string
  courseName: string
  subject: SubjectKey
  weekNumber: number
  status: AssessmentStatusKey
  teacherName: string
  checkedItems: number
  totalItems: number
  updatedAt: string
}

export type AssessmentRubricSkill = {
  key: string
  label: string
  outcomes: string[]
  description?: string
  ageDescriptions?: Partial<Record<RoboticsAgeGroup, string>>
  matrixKey?: string
  scoreDescriptions?: Partial<Record<RoboticsAgeGroup, Record<string, string>>>
}

export type AssessmentRubricDomain = {
  key: string
  label: string
  skills: AssessmentRubricSkill[]
}

export type AssessmentRubricConfigItem = {
  id?: string
  subject: SubjectKey
  version: string
  status: RubricConfigStatusKey
  domains: AssessmentRubricDomain[]
  activatedAt?: string
  createdAt?: string
  updatedAt?: string
}

export type WeeklyAssessmentMatrixItem = {
  id?: string
  studentId: string
  studentName: string
  birthDate?: string
  ageGroup?: RoboticsAgeGroup
  ageGroupIsDefault?: boolean
  parentName: string
  parentPhone: string
  healthNote?: string
  enrollmentId?: string
  status: AssessmentStatusKey
  comment?: string
  checkedItems: number
  totalItems: number
  domainProgress: Array<{
    domainKey: string
    label: string
    scoreOutOfFive: number
    checkedItems: number
    totalItems: number
    status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE"
  }>
  items: Array<{
    domainKey: string
    skillKey: string
    outcomeIndex: number
    checked: boolean
    score?: number
    progressLevel?: ProgressLevelKey
    comment?: string
    evidenceUrl?: string
  }>
}

export type WeeklyAssessmentWeekOption = {
  weekNumber: number
  label: string
  date?: string
  isDue: boolean
  completeStudents: number
  totalStudents: number
  status: "NOT_DUE" | "MISSING" | "IN_PROGRESS" | "COMPLETE"
}

export type WeeklyAssessmentSkillComparisonItem = {
  domainKey: string
  domainLabel: string
  skillKey: string
  skillLabel: string
  averageScore: number
  checkedStudents: number
  totalStudents: number
  checkedItems: number
  totalItems: number
  completionRate: number
}

export type WeeklyClassAssessmentDetail = {
  classId: string
  className: string
  courseId: string
  courseName: string
  subject: SubjectKey
  teacherName: string
  weekNumber: number
  suggestedWeekNumber: number
  availableWeeks: WeeklyAssessmentWeekOption[]
  rubric: AssessmentRubricConfigItem
  students: WeeklyAssessmentMatrixItem[]
  skillComparison: WeeklyAssessmentSkillComparisonItem[]
}

export type FinalAssessmentResult = {
  id: string
  studentId: string
  studentName: string
  enrollmentId: string
  courseName: string
  subject: SubjectKey
  rubricVersion: string
  requiredWeeks: number
  completedWeeks: number
  strengths: string
  improvements: string
  teacherSummary: string
  nextSteps?: string
  teacherName: string
  status: FinalAssessmentStatusKey
  publishedAt?: string
  publishedByName?: string
  createdAt: string
}

export type FinalReportDetail = FinalAssessmentResult & {
  parentName: string
  parentPhone: string
  className?: string
  ageGroup?: RoboticsAgeGroup
  ageGroupIsDefault?: boolean
  rubric: AssessmentRubricConfigItem
  domainSummaries: Array<{
    domainKey: string
    label: string
    scoreOutOfFive: number
    checkedItems: number
    totalItems: number
    status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE"
  }>
  weeklySummaries: Array<{
    weekNumber: number
    status: AssessmentStatusKey
    checkedItems: number
    totalItems: number
    comment?: string
  }>
  roboticsSkillSummaries?: Array<{
    skillKey: string
    label: string
    description?: string
    averageScore: number
    comment: string
    weeklyScores: Array<{
      weekNumber: number
      score: number
    }>
  }>
}
