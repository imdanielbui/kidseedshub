import type { Prisma, PrismaClient } from "@prisma/client"

type TransactionClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">

export type ScheduleSlotInput = {
  weekday: number
  startTime: string
  endTime: string
  room?: string
  isActive?: boolean
}

function startOfDay(date: Date) {
  const value = new Date(date)
  value.setHours(0, 0, 0, 0)
  return value
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day)
}

export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function nextDateForWeekday(startDate: Date, weekday: number) {
  const date = startOfDay(startDate)
  const delta = (weekday - date.getDay() + 7) % 7
  date.setDate(date.getDate() + delta)
  return date
}

async function getBlockedDateKeys(tx: TransactionClient, startDate: Date) {
  const events = await tx.scheduleEvent.findMany({
    where: {
      affectsScheduling: true,
      date: { gte: startOfDay(startDate) }
    },
    select: { date: true }
  })

  return new Set(events.map((event) => dateKey(event.date)))
}

async function findNextAvailableClassDate(
  tx: TransactionClient,
  input: {
    classId: string
    date: Date
    blockedDateKeys: Set<string>
    reservedDateKeys?: Set<string>
    excludeSessionId?: string
  }
) {
  const candidate = startOfDay(input.date)

  while (true) {
    const key = dateKey(candidate)
    const existing = await tx.classSession.findUnique({
      where: {
        classId_date: {
          classId: input.classId,
          date: startOfDay(candidate)
        }
      },
      select: { id: true }
    })
    const conflictsWithExisting = existing && existing.id !== input.excludeSessionId

    if (!input.blockedDateKeys.has(key) && !input.reservedDateKeys?.has(key) && !conflictsWithExisting) {
      return startOfDay(candidate)
    }

    candidate.setDate(candidate.getDate() + 7)
  }
}

type ActiveScheduleSlot = {
  id: string
  weekday: number
  startTime: string
  endTime: string
  room: string | null
}

function compareScheduleSlots(first: ActiveScheduleSlot, second: ActiveScheduleSlot) {
  return first.weekday - second.weekday || first.startTime.localeCompare(second.startTime)
}

function nextDateForSlot(afterDate: Date, slot: ActiveScheduleSlot) {
  const date = startOfDay(afterDate)
  const delta = (slot.weekday - date.getDay() + 7) % 7 || 7
  date.setDate(date.getDate() + delta)
  return date
}

async function findNextScheduledClassOccurrence(
  tx: TransactionClient,
  input: {
    classId: string
    date: Date
    blockedDateKeys: Set<string>
    excludeSessionId?: string
  }
) {
  const slots = (await tx.classScheduleSlot.findMany({
    where: {
      classId: input.classId,
      isActive: true
    },
    select: {
      id: true,
      weekday: true,
      startTime: true,
      endTime: true,
      room: true
    },
    orderBy: [{ weekday: "asc" }, { startTime: "asc" }]
  })).sort(compareScheduleSlots)

  if (!slots.length) {
    const date = await findNextAvailableClassDate(tx, {
      classId: input.classId,
      date: input.date,
      blockedDateKeys: input.blockedDateKeys,
      excludeSessionId: input.excludeSessionId
    })

    return { date, slot: null }
  }

  let cursor = startOfDay(input.date)

  while (true) {
    const next = slots
      .map((slot) => ({ slot, date: nextDateForSlot(cursor, slot) }))
      .sort((first, second) => first.date.getTime() - second.date.getTime() || first.slot.startTime.localeCompare(second.slot.startTime))[0]
    const key = dateKey(next.date)
    const existing = await tx.classSession.findUnique({
      where: {
        classId_date: {
          classId: input.classId,
          date: next.date
        }
      },
      select: { id: true }
    })
    const conflictsWithExisting = existing && existing.id !== input.excludeSessionId

    if (!input.blockedDateKeys.has(key) && !conflictsWithExisting) {
      return next
    }

    cursor = next.date
  }
}

export function normalizeScheduleSlots(input: {
  scheduleSlots?: ScheduleSlotInput[]
  weekday: number
  startTime: string
  endTime: string
  room?: string
}) {
  const slots = input.scheduleSlots?.length
    ? input.scheduleSlots
    : [
        {
          weekday: input.weekday,
          startTime: input.startTime,
          endTime: input.endTime,
          room: input.room,
          isActive: true
        }
      ]

  return slots.map((slot) => ({
    weekday: slot.weekday,
    startTime: slot.startTime,
    endTime: slot.endTime,
    room: slot.room,
    isActive: slot.isActive ?? true
  }))
}

export async function replaceClassSchedule(tx: TransactionClient, input: {
  classId: string
  startDate?: string
  plannedSessions: number
  slots: ScheduleSlotInput[]
}) {
  const activeSlots = input.slots.filter((slot) => slot.isActive ?? true)
  const startDate = input.startDate ? parseLocalDate(input.startDate) : new Date()
  const blockedDateKeys = await getBlockedDateKeys(tx, startDate)
  const reservedDateKeys = new Set<string>()

  await tx.classScheduleSlot.deleteMany({ where: { classId: input.classId } })
  await tx.classSession.deleteMany({
    where: {
      classId: input.classId,
      attendances: { none: {} }
    }
  })

  const createdSlots = []

  for (const slot of input.slots) {
    const created = await tx.classScheduleSlot.create({
      data: {
        classId: input.classId,
        weekday: slot.weekday,
        startTime: slot.startTime,
        endTime: slot.endTime,
        room: slot.room,
        isActive: slot.isActive ?? true
      }
    })
    createdSlots.push(created)
  }

  if (!activeSlots.length) {
    return
  }

  const sessionPlans = createdSlots
    .filter((slot) => slot.isActive)
    .map((slot) => ({
      slot,
      nextDate: nextDateForWeekday(startDate, slot.weekday)
    }))

  for (let index = 0; index < input.plannedSessions; index += 1) {
    sessionPlans.sort((first, second) => {
      const dateDelta = first.nextDate.getTime() - second.nextDate.getTime()
      return dateDelta || first.slot.startTime.localeCompare(second.slot.startTime)
    })

    const plan = sessionPlans[0]
    const sessionDate = await findNextAvailableClassDate(tx, {
      classId: input.classId,
      date: plan.nextDate,
      blockedDateKeys,
      reservedDateKeys
    })
    reservedDateKeys.add(dateKey(sessionDate))

    await tx.classSession.upsert({
      where: {
        classId_date: {
          classId: input.classId,
          date: sessionDate
        }
      },
      update: {
        scheduleSlotId: plan.slot.id,
        startTime: plan.slot.startTime,
        endTime: plan.slot.endTime,
        room: plan.slot.room,
        status: "SCHEDULED"
      },
      create: {
        classId: input.classId,
        scheduleSlotId: plan.slot.id,
        date: sessionDate,
        startTime: plan.slot.startTime,
        endTime: plan.slot.endTime,
        room: plan.slot.room,
        status: "SCHEDULED"
      }
    })

    plan.nextDate.setDate(plan.nextDate.getDate() + 7)
  }
}

export async function rescheduleSessionsOnBlockedDate(tx: TransactionClient, blockedDate: Date) {
  const blockedDateKeys = await getBlockedDateKeys(tx, blockedDate)
  const sessions = await tx.classSession.findMany({
    where: {
      date: startOfDay(blockedDate),
      status: "SCHEDULED",
      attendances: { none: {} }
    },
    orderBy: [{ startTime: "asc" }, { createdAt: "asc" }]
  })
  const affectedClassIds = Array.from(new Set(sessions.map((session) => session.classId)))

  for (const classId of affectedClassIds) {
    const movableSessions = await tx.classSession.findMany({
      where: {
        classId,
        date: { gte: startOfDay(blockedDate) },
        status: "SCHEDULED",
        attendances: { none: {} }
      },
      orderBy: [{ date: "desc" }, { startTime: "desc" }, { createdAt: "desc" }]
    })

    for (const session of movableSessions) {
      const next = await findNextScheduledClassOccurrence(tx, {
        classId: session.classId,
        date: session.date,
        blockedDateKeys,
        excludeSessionId: session.id
      })

      await tx.classSession.update({
        where: { id: session.id },
        data: {
          date: next.date,
          scheduleSlotId: next.slot?.id ?? session.scheduleSlotId,
          startTime: next.slot?.startTime ?? session.startTime,
          endTime: next.slot?.endTime ?? session.endTime,
          room: next.slot?.room ?? session.room
        }
      })
    }
  }

  return sessions.length
}

export const classCalendarSessionInclude = {
  class: {
    include: {
      course: true,
      teacher: true,
      students: { where: { isActive: true } }
    }
  },
  substituteTeacher: true
} satisfies Prisma.ClassSessionInclude
