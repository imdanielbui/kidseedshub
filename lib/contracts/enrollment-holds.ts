export type EnrollmentHoldItem = {
  id: string
  enrollmentId: string
  courseName: string
  sourceClassName?: string
  resumedClassName?: string
  remainingSessions: number
  creditAmount: string
  holdMonths: number
  expiresAt: string
  status: "ACTIVE" | "RESUMED" | "EXPIRED"
  reason: string
  createdByName: string
  resumedByName?: string
  resumedAt?: string
  createdAt: string
}
