import { defaultDate } from "./class-schedule-utils"

export type SlotForm = {
  weekday: string
  startTime: string
  endTime: string
  room: string
}

export type ClassFormState = {
  code: string
  name: string
  courseId: string
  teacherId: string
  startDate: string
  plannedSessions: string
  isActive: boolean
  studentIds: string[]
  slots: SlotForm[]
}

export type EventFormState = {
  title: string
  date: string
  type: "HOLIDAY" | "EVENT"
  affectsScheduling: boolean
  note: string
}

export type ClassPatchBody = {
  isActive?: boolean
}

export type ClassSubjectFilter = "ALL" | "FUN" | "ROBOTICS"
export type ClassStatusFilter = "ALL" | "ACTIVE" | "INACTIVE"
export type SetupPanel = "manage" | "create" | "events"

export const emptyClassForm: ClassFormState = {
  code: "",
  name: "",
  courseId: "",
  teacherId: "",
  startDate: defaultDate,
  plannedSessions: "16",
  isActive: true,
  studentIds: [],
  slots: [
    {
      weekday: "6",
      startTime: "16:30",
      endTime: "18:00",
      room: ""
    }
  ]
}

export const emptyEventForm: EventFormState = {
  title: "",
  date: defaultDate,
  type: "HOLIDAY",
  affectsScheduling: true,
  note: ""
}

export const dialogPanelClassName = "border border-brand-red/20 bg-white shadow-[0_32px_90px_rgba(69,38,28,0.28)] ring-1 ring-white"
export const dialogBodyClassName = "bg-[#fffaf7] p-5"
