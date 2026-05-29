import type { CourseFeedbackItem } from "@/lib/contracts/course-feedback"

export function toCourseFeedbackItem(feedback: {
  id: string
  studentId: string
  teachingQuality: number
  teacherAttitude: number
  studentProgress: number
  wouldRecommend: number
  comment: string | null
  createdAt: Date
  student: { name: string }
  parent: { user: { name: string } }
}): CourseFeedbackItem {
  const total = feedback.teachingQuality + feedback.teacherAttitude + feedback.studentProgress + feedback.wouldRecommend

  return {
    id: feedback.id,
    studentId: feedback.studentId,
    studentName: feedback.student.name,
    parentName: feedback.parent.user.name,
    teachingQuality: feedback.teachingQuality,
    teacherAttitude: feedback.teacherAttitude,
    studentProgress: feedback.studentProgress,
    wouldRecommend: feedback.wouldRecommend,
    averageScore: Math.round((total / 4) * 10) / 10,
    comment: feedback.comment ?? undefined,
    createdAt: feedback.createdAt.toISOString()
  }
}
