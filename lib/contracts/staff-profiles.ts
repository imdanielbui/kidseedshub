export const employmentTypeLabels = {
  FULL_TIME: "Toàn thời gian",
  PART_TIME: "Bán thời gian"
} as const

export type EmploymentTypeKey = keyof typeof employmentTypeLabels

export type StaffProfileItem = {
  id: string
  userId: string
  staffName: string
  staffRole: string
  employmentType: EmploymentTypeKey
  startDate: string
  monthlySalary?: string
  hourlyRate?: string
  payrollActive: boolean
  createdAt: string
  updatedAt: string
}
