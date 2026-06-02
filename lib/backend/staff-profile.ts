import { Prisma } from "@prisma/client"
import { dateKey } from "@/lib/backend/class-schedule"
import type { StaffProfileItem } from "@/lib/contracts/staff-profiles"

export const staffProfileInclude = Prisma.validator<Prisma.StaffProfileInclude>()({
  user: true
})

export type StaffProfileRecord = Prisma.StaffProfileGetPayload<{ include: typeof staffProfileInclude }>

function decimalToString(value: Prisma.Decimal | null) {
  return value?.toString() || undefined
}

export function toStaffProfileItem(profile: StaffProfileRecord): StaffProfileItem {
  return {
    id: profile.id,
    userId: profile.userId,
    staffName: profile.user.name,
    staffRole: profile.user.role,
    employmentType: profile.employmentType,
    startDate: dateKey(profile.startDate),
    monthlySalary: decimalToString(profile.monthlySalary),
    hourlyRate: decimalToString(profile.hourlyRate),
    payrollActive: profile.payrollActive,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString()
  }
}
