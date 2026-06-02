import { Prisma } from "@prisma/client"
import { dateKey } from "@/lib/backend/class-schedule"
import type { StaffTimesheetEntryItem } from "@/lib/contracts/timesheets"

export const staffTimesheetEntryInclude = Prisma.validator<Prisma.StaffTimesheetEntryInclude>()({
  staff: true,
  approvedBy: true,
  linkedClassSession: {
    include: {
      class: {
        include: {
          course: true
        }
      }
    }
  }
})

export type StaffTimesheetEntryRecord = Prisma.StaffTimesheetEntryGetPayload<{ include: typeof staffTimesheetEntryInclude }>

function parseTimeToMinutes(value: string | null) {
  if (!value) {
    return null
  }

  const [hour, minute] = value.split(":").map(Number)

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    return null
  }

  return hour * 60 + minute
}

export function calculateTimesheetHours(startTime: string | null, endTime: string | null) {
  const startMinutes = parseTimeToMinutes(startTime)
  const endMinutes = parseTimeToMinutes(endTime)

  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
    return new Prisma.Decimal(0)
  }

  return new Prisma.Decimal((endMinutes - startMinutes) / 60).toDecimalPlaces(2)
}

export async function syncClassSessionTimesheetEntry(
  tx: Prisma.TransactionClient,
  input: {
    classSessionId: string
  }
) {
  const classSession = await tx.classSession.findUnique({
    where: { id: input.classSessionId },
    include: {
      class: true,
      timesheetEntry: true
    }
  })

  if (!classSession || classSession.status !== "COMPLETED") {
    return null
  }

  const staffId = classSession.substituteTeacherId ?? classSession.class.teacherId
  const hours = calculateTimesheetHours(classSession.startTime, classSession.endTime)

  if (hours.lessThanOrEqualTo(0)) {
    return null
  }

  if (classSession.timesheetEntry?.status === "APPROVED") {
    return classSession.timesheetEntry
  }

  return tx.staffTimesheetEntry.upsert({
    where: { linkedClassSessionId: classSession.id },
    create: {
      staffId,
      date: classSession.date,
      source: "CLASS_SESSION",
      startTime: classSession.startTime,
      endTime: classSession.endTime,
      hours,
      linkedClassSessionId: classSession.id,
      note: `Tự động từ buổi học ${classSession.class.name}`
    },
    update: {
      staffId,
      date: classSession.date,
      startTime: classSession.startTime,
      endTime: classSession.endTime,
      hours,
      status: "DRAFT",
      approvedById: null,
      approvedAt: null,
      note: `Tự động từ buổi học ${classSession.class.name}`
    }
  })
}

export function toStaffTimesheetEntryItem(entry: StaffTimesheetEntryRecord): StaffTimesheetEntryItem {
  return {
    id: entry.id,
    staffId: entry.staffId,
    staffName: entry.staff.name,
    staffRole: entry.staff.role,
    date: dateKey(entry.date),
    source: entry.source,
    startTime: entry.startTime ?? undefined,
    endTime: entry.endTime ?? undefined,
    hours: entry.hours.toString(),
    status: entry.status,
    linkedClassSessionId: entry.linkedClassSessionId ?? undefined,
    className: entry.linkedClassSession?.class.name,
    courseName: entry.linkedClassSession?.class.course.name,
    approvedByName: entry.approvedBy?.name,
    approvedAt: entry.approvedAt?.toISOString(),
    note: entry.note ?? undefined,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString()
  }
}
