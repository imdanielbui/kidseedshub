export type ScheduleEventTypeKey = "HOLIDAY" | "EVENT"

export const scheduleEventTypeLabels = {
  HOLIDAY: "Nghỉ lễ",
  EVENT: "Sự kiện"
} as const

export type ScheduleEventItem = {
  id: string
  title: string
  date: string
  type: ScheduleEventTypeKey
  affectsScheduling: boolean
  note?: string
}
