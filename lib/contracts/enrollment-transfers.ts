import type { StudentCourseBalance } from "@/lib/contracts/students"

export type EnrollmentTransferResult = {
  id: string
  studentId: string
  fromEnrollmentId: string
  toEnrollmentId?: string
  fromClassId?: string
  toClassId?: string
  isCourseTransfer: boolean
  remainingSessions: number
  creditAmount: string
  walletBalanceAfterTransfer: string
  reason: string
  createdByName: string
  createdAt: string
  enrollment: StudentCourseBalance
}
