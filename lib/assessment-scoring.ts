import type { AssessmentRubricSkill, ProgressLevelKey, RoboticsAgeGroup } from "@/lib/contracts/assessment"

export function progressLevelToScore(level?: ProgressLevelKey | null) {
  if (level === "PROFICIENT") return 5
  if (level === "PROGRESSING") return 3
  if (level === "BEGINNING") return 1
  return 0
}

export function assessmentItemScore(item: { checked?: boolean; score?: number | null; progressLevel?: ProgressLevelKey | null }) {
  if (typeof item.score === "number") return item.score
  if (item.progressLevel) return progressLevelToScore(item.progressLevel)
  if (!item.checked) return 0

  return 0
}

export function averageScore(items: Array<{ checked?: boolean; score?: number | null; progressLevel?: ProgressLevelKey | null }>) {
  if (!items.length) return 0

  const totalScore = items.reduce((total, item) => total + assessmentItemScore(item), 0)
  return Math.round((totalScore / items.length) * 10) / 10
}

export function roboticsAgeGroupFromBirthDate(value?: Date | string | null): { ageGroup: RoboticsAgeGroup; isDefault: boolean } {
  if (!value) return { ageGroup: "7-10", isDefault: true }

  const birthDate = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(birthDate.getTime())) return { ageGroup: "7-10", isDefault: true }

  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1
  }

  if (age <= 6) return { ageGroup: "5-6", isDefault: false }
  if (age <= 10) return { ageGroup: "7-10", isDefault: false }

  return { ageGroup: "11-14", isDefault: false }
}

export function skillDescriptionForAge(skill: AssessmentRubricSkill, ageGroup?: RoboticsAgeGroup) {
  return (ageGroup ? skill.ageDescriptions?.[ageGroup] : undefined) ?? skill.description ?? ""
}

export function skillScoreComment(skill: AssessmentRubricSkill, score: number, ageGroup?: RoboticsAgeGroup) {
  const ageComments = ageGroup ? skill.scoreDescriptions?.[ageGroup] : undefined

  return ageComments?.[String(score)] ?? `${skill.label}: ${score}/5.`
}
