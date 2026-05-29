export type CourseFeedbackItem = {
  id: string
  studentId: string
  studentName: string
  parentName: string
  teachingQuality: number
  teacherAttitude: number
  studentProgress: number
  wouldRecommend: number
  averageScore: number
  comment?: string
  createdAt: string
}
