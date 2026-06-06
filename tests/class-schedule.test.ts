import assert from "node:assert/strict"
import test from "node:test"
import { dateKey, rescheduleSessionsOnBlockedDate } from "../lib/backend/class-schedule"

type MockSession = {
  id: string
  classId: string
  scheduleSlotId: string
  date: Date
  startTime: string
  endTime: string
  room: string | null
  status: "SCHEDULED"
  createdAt: Date
}

function localDate(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day)
}

function createScheduleTx(input: {
  sessions: MockSession[]
  blockedDates: string[]
}) {
  return {
    scheduleEvent: {
      findMany: async () => input.blockedDates.map((date) => ({ date: localDate(date) }))
    },
    classSession: {
      findMany: async ({
        where
      }: {
        where: {
          classId?: string
          scheduleSlotId?: string
          date: Date | { gte: Date }
          status: "SCHEDULED"
        }
      }) => {
        const rows = input.sessions
          .filter((session) => !where.classId || session.classId === where.classId)
          .filter((session) => !where.scheduleSlotId || session.scheduleSlotId === where.scheduleSlotId)
          .filter((session) => session.status === where.status)
          .filter((session) => {
            if (where.date instanceof Date) return dateKey(session.date) === dateKey(where.date)
            return session.date.getTime() >= where.date.gte.getTime()
          })

        return rows.sort((first, second) => {
          const dateDelta = second.date.getTime() - first.date.getTime()
          return dateDelta || second.startTime.localeCompare(first.startTime) || second.createdAt.getTime() - first.createdAt.getTime()
        })
      },
      findUnique: async ({ where }: { where: { classId_date: { classId: string; date: Date } } }) => {
        const session = input.sessions.find(
          (item) => item.classId === where.classId_date.classId && dateKey(item.date) === dateKey(where.classId_date.date)
        )

        return session ? { id: session.id } : null
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<MockSession> }) => {
        const session = input.sessions.find((item) => item.id === where.id)
        assert.ok(session)
        Object.assign(session, data)
        return session
      }
    }
  }
}

test("rescheduleSessionsOnBlockedDate shifts only the blocked schedule chain to the same slot next week", async () => {
  const sessions: MockSession[] = [
    {
      id: "session_1",
      classId: "class_1",
      scheduleSlotId: "slot_monday",
      date: localDate("2026-06-01"),
      startTime: "16:00",
      endTime: "17:30",
      room: "A1",
      status: "SCHEDULED",
      createdAt: localDate("2026-05-01")
    },
    {
      id: "session_2",
      classId: "class_1",
      scheduleSlotId: "slot_thursday",
      date: localDate("2026-06-04"),
      startTime: "18:00",
      endTime: "19:30",
      room: "B1",
      status: "SCHEDULED",
      createdAt: localDate("2026-05-02")
    },
    {
      id: "session_3",
      classId: "class_1",
      scheduleSlotId: "slot_monday",
      date: localDate("2026-06-08"),
      startTime: "16:00",
      endTime: "17:30",
      room: "A1",
      status: "SCHEDULED",
      createdAt: localDate("2026-05-03")
    }
  ]
  const tx = createScheduleTx({ sessions, blockedDates: ["2026-06-01"] })

  const movedSessions = await rescheduleSessionsOnBlockedDate(tx as never, localDate("2026-06-01"))

  assert.equal(movedSessions, 1)
  assert.equal(dateKey(sessions[0].date), "2026-06-08")
  assert.equal(sessions[0].scheduleSlotId, "slot_monday")
  assert.equal(sessions[0].startTime, "16:00")
  assert.equal(sessions[0].room, "A1")
  assert.equal(dateKey(sessions[1].date), "2026-06-04")
  assert.equal(sessions[1].scheduleSlotId, "slot_thursday")
  assert.equal(dateKey(sessions[2].date), "2026-06-15")
  assert.equal(sessions[2].scheduleSlotId, "slot_monday")
})

test("rescheduleSessionsOnBlockedDate does not move a Sunday class into a Monday slot", async () => {
  const sessions: MockSession[] = [
    {
      id: "session_1",
      classId: "class_1",
      scheduleSlotId: "slot_sunday",
      date: localDate("2026-06-07"),
      startTime: "16:30",
      endTime: "18:00",
      room: null,
      status: "SCHEDULED",
      createdAt: localDate("2026-05-01")
    },
    {
      id: "session_2",
      classId: "class_1",
      scheduleSlotId: "slot_monday",
      date: localDate("2026-06-08"),
      startTime: "16:30",
      endTime: "18:00",
      room: null,
      status: "SCHEDULED",
      createdAt: localDate("2026-05-02")
    },
    {
      id: "session_3",
      classId: "class_1",
      scheduleSlotId: "slot_sunday",
      date: localDate("2026-06-14"),
      startTime: "16:30",
      endTime: "18:00",
      room: null,
      status: "SCHEDULED",
      createdAt: localDate("2026-05-03")
    }
  ]
  const tx = createScheduleTx({ sessions, blockedDates: ["2026-06-07"] })

  const movedSessions = await rescheduleSessionsOnBlockedDate(tx as never, localDate("2026-06-07"))

  assert.equal(movedSessions, 1)
  assert.equal(dateKey(sessions[0].date), "2026-06-14")
  assert.equal(dateKey(sessions[1].date), "2026-06-08")
  assert.equal(sessions[1].scheduleSlotId, "slot_monday")
  assert.equal(dateKey(sessions[2].date), "2026-06-21")
})
