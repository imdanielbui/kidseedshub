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

test("rescheduleSessionsOnBlockedDate shifts a class through its next scheduled study days", async () => {
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
  const slots = [
    { id: "slot_monday", classId: "class_1", weekday: 1, startTime: "16:00", endTime: "17:30", room: "A1", isActive: true },
    { id: "slot_thursday", classId: "class_1", weekday: 4, startTime: "18:00", endTime: "19:30", room: "B1", isActive: true }
  ]
  const tx = {
    scheduleEvent: {
      findMany: async () => [{ date: localDate("2026-06-01") }]
    },
    classScheduleSlot: {
      findMany: async ({ where }: { where: { classId: string; isActive: boolean } }) =>
        slots.filter((slot) => slot.classId === where.classId && slot.isActive === where.isActive)
    },
    classSession: {
      findMany: async ({ where }: { where: { classId?: string; date: Date | { gte: Date }; status: "SCHEDULED" } }) => {
        const rows = sessions
          .filter((session) => !where.classId || session.classId === where.classId)
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
        const session = sessions.find(
          (item) => item.classId === where.classId_date.classId && dateKey(item.date) === dateKey(where.classId_date.date)
        )

        return session ? { id: session.id } : null
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<MockSession> }) => {
        const session = sessions.find((item) => item.id === where.id)
        assert.ok(session)
        Object.assign(session, data)
        return session
      }
    }
  }

  const movedSessions = await rescheduleSessionsOnBlockedDate(tx as never, localDate("2026-06-01"))

  assert.equal(movedSessions, 1)
  assert.equal(dateKey(sessions[0].date), "2026-06-04")
  assert.equal(sessions[0].scheduleSlotId, "slot_thursday")
  assert.equal(sessions[0].startTime, "18:00")
  assert.equal(sessions[0].room, "B1")
  assert.equal(dateKey(sessions[1].date), "2026-06-08")
  assert.equal(sessions[1].scheduleSlotId, "slot_monday")
  assert.equal(dateKey(sessions[2].date), "2026-06-11")
  assert.equal(sessions[2].scheduleSlotId, "slot_thursday")
})
