import type { StudentCourseBalance, StudentStatusKey } from "@/lib/contracts/students"

export type EnrollmentCreateResult = {
  enrollment: StudentCourseBalance
  studentStatus: StudentStatusKey
  classAssigned: boolean
}

export type EnrollmentDeleteResult = {
  mode: "deleted" | "canceled"
  message: string
}
