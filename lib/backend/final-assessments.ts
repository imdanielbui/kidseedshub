export function requiredWeeksFromClass(klass: {
  plannedSessions?: number | null
  course?: { totalSessions?: number | null }
  _count?: { sessions?: number | null }
}) {
  return Math.max(1, klass._count?.sessions ?? 0, klass.plannedSessions ?? 0, klass.course?.totalSessions ?? 0)
}

export function finalAssessmentMeetsRequiredWeeks(
  assessment: {
    requiredWeeks: number
    completedWeeks: number
  },
  requiredWeeks: number
) {
  return assessment.requiredWeeks >= requiredWeeks && assessment.completedWeeks >= requiredWeeks
}
