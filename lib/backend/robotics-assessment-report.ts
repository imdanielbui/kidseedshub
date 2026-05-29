import { Prisma } from "@prisma/client"
import { assessmentItemScore, skillDescriptionForAge, skillScoreComment } from "@/lib/assessment-scoring"
import { rubricFromSnapshot } from "@/lib/backend/assessment-rubrics"
import type { FinalReportDetail, ProgressLevelKey, RoboticsAgeGroup } from "@/lib/contracts/assessment"

export type RoboticsWeeklyAssessment = {
  weekNumber: number
  rubricVersion: string
  rubricSnapshot?: Prisma.JsonValue | null
  comment?: string | null
  items: Array<{
    domainKey: string
    skillKey: string
    outcomeIndex: number
    checked: boolean
    score?: number | null
    progressLevel?: ProgressLevelKey | null
  }>
}

function roundedAverage(values: number[]) {
  if (!values.length) return 0

  return Math.round((values.reduce((total, value) => total + value, 0) / values.length) * 10) / 10
}

export function roboticsSkillSummaries(
  weeklyAssessments: RoboticsWeeklyAssessment[],
  fallbackVersion: string,
  ageGroup?: RoboticsAgeGroup
): NonNullable<FinalReportDetail["roboticsSkillSummaries"]> {
  const snapshot = weeklyAssessments.find((assessment) => assessment.rubricSnapshot)?.rubricSnapshot
  const rubric = rubricFromSnapshot(snapshot, "ROBOTICS", fallbackVersion)
  const skills = rubric.domains.flatMap((domain) => domain.skills)

  return skills.map((skill) => {
    const weeklyScores = weeklyAssessments
      .map((weekly) => {
        const scores = weekly.items
          .filter((item) => item.skillKey === skill.key && item.checked)
          .map((item) => assessmentItemScore(item))
          .filter((score) => score > 0)

        return scores.length
          ? {
              weekNumber: weekly.weekNumber,
              score: roundedAverage(scores)
            }
          : null
      })
      .filter((entry): entry is { weekNumber: number; score: number } => Boolean(entry))

    const averageScore = roundedAverage(weeklyScores.map((entry) => entry.score))
    const roundedScore = Math.max(1, Math.min(5, Math.round(averageScore || 1)))

    return {
      skillKey: skill.key,
      label: skill.label,
      description: skillDescriptionForAge(skill, ageGroup),
      averageScore,
      comment: averageScore > 0 ? skillScoreComment(skill, roundedScore, ageGroup) : "Chưa có đủ dữ liệu đánh giá kỹ năng này.",
      weeklyScores
    }
  })
}

export function roboticsReportText(weeklyAssessments: RoboticsWeeklyAssessment[], fallbackVersion: string, ageGroup?: RoboticsAgeGroup) {
  const summaries = roboticsSkillSummaries(weeklyAssessments, fallbackVersion, ageGroup)
  const observed = summaries.filter((summary) => summary.averageScore > 0)
  const overallAverage = roundedAverage(observed.map((summary) => summary.averageScore))
  const strengths = [...observed]
    .sort((a, b) => b.averageScore - a.averageScore)
    .slice(0, 3)
    .map((summary) => `${summary.label} ${summary.averageScore}/5`)
  const improvements = [...observed]
    .sort((a, b) => a.averageScore - b.averageScore)
    .slice(0, 2)
    .map((summary) => `${summary.label} ${summary.averageScore}/5`)
  const comments = weeklyAssessments.map((assessment) => assessment.comment).filter((comment): comment is string => Boolean(comment))

  return {
    rubricVersion: fallbackVersion,
    strengths: strengths.length ? strengths.join("; ") : "Hoàn thành các kỹ năng Robotics trọng tâm của khóa học.",
    improvements: improvements.length ? improvements.join("; ") : "Tiếp tục luyện độ ổn định khi giải quyết thử thách mới.",
    teacherSummary:
      comments.slice(0, 3).join(" ") ||
      `Điểm trung bình Robotics đạt ${overallAverage}/5 dựa trên ${weeklyAssessments.length} tuần đánh giá hoàn thành.`,
    nextSteps: "Gợi ý tiếp tục Robotics nâng cao hoặc dự án ứng dụng để củng cố tư duy thuật toán và trình bày sản phẩm."
  }
}
