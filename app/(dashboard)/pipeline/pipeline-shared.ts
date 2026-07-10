import type { CSSProperties } from "react"
import type { ContactResultKey, PipelineResponse, PipelineStageKey } from "@/lib/contracts/crm"
import type { StudentDetail, StudentGenderKey } from "@/lib/contracts/students"

export type ViewMode = "database" | "kanban"
export type PanelMode = "lead" | "filters" | "fields" | null
export type SortKey = "updatedAt" | "createdAt" | "stageChangedAt" | "daysInStage" | "parentName" | "studentName" | "code"
export type SortDirection = "asc" | "desc"
export type StageFilter = "ALL" | PipelineStageKey

export type ColumnKey =
  | "code"
  | "parentName"
  | "studentName"
  | "phone"
  | "address"
  | "gender"
  | "stage"
  | "classNames"
  | "classProgress"
  | "leadSource"
  | "saleOwnerName"
  | "createdByName"
  | "createdAt"
  | "stageChangedAt"
  | "daysInStage"

export const columnLabels: Record<ColumnKey, string> = {
  code: "Mã HS",
  parentName: "Phụ huynh",
  studentName: "Học viên",
  phone: "SĐT",
  address: "Địa chỉ",
  gender: "Giới tính",
  stage: "Trạng thái",
  classNames: "Lớp học",
  classProgress: "Tiến độ lớp",
  leadSource: "Nguồn",
  saleOwnerName: "Sale bởi",
  createdByName: "Tạo bởi",
  createdAt: "Ngày tạo",
  stageChangedAt: "Đổi bước",
  daysInStage: "Ngày ở bước này"
}

export const defaultColumnOrder: ColumnKey[] = [
  "code",
  "parentName",
  "studentName",
  "phone",
  "address",
  "stage",
  "daysInStage",
  "classNames",
  "classProgress",
  "leadSource",
  "saleOwnerName",
  "createdByName",
  "gender",
  "createdAt",
  "stageChangedAt"
]

export const defaultPinnedColumns: ColumnKey[] = ["code", "studentName"]

export const pinnedColumnWidths: Partial<Record<ColumnKey, number>> = {
  code: 104,
  studentName: 220,
  parentName: 220,
  phone: 160,
  address: 220,
  stage: 160,
  daysInStage: 170
}

export type ContactForm = {
  result: ContactResultKey
  content: string
}

export type StudentEditForm = {
  studentName: string
  parentName: string
  parentPhone: string
  parentEmail: string
  address: string
  gender: StudentGenderKey
  leadSource: string
  saleOwnerId: string
  leadNote: string
  healthNote: string
}

export type TaskForm = {
  title: string
  dueDate: string
  note: string
}

export const emptyContactForm: ContactForm = {
  result: "INTERESTED",
  content: ""
}

export const emptyStudentEditForm: StudentEditForm = {
  studentName: "",
  parentName: "",
  parentPhone: "",
  parentEmail: "",
  address: "",
  gender: "UNKNOWN",
  leadSource: "",
  saleOwnerId: "",
  leadNote: "",
  healthNote: ""
}

export const emptyPipeline: PipelineResponse = {
  items: [],
  total: 0,
  page: 1,
  limit: 25,
  stageCounts: { LEAD: 0, TRIAL: 0, EVALUATION: 0, CONVERTED: 0, RETENTION: 0, NURTURE: 0 },
  staleCounts: { LEAD: 0, TRIAL: 0, EVALUATION: 0, CONVERTED: 0, RETENTION: 0, NURTURE: 0 }
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value))
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value))
}

export function toLocalDateInputValue(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 10)
}

export function createEmptyTaskForm(): TaskForm {
  return {
    title: "",
    dueDate: toLocalDateInputValue(),
    note: ""
  }
}

export function toIsoFromLocalInput(value: string) {
  if (!value) return ""

  const normalizedValue = value.includes("T") ? value : `${value}T17:00`
  const date = new Date(normalizedValue)

  return Number.isNaN(date.getTime()) ? "" : date.toISOString()
}

export function toStudentEditForm(student: StudentDetail, saleOwnerId = ""): StudentEditForm {
  return {
    studentName: student.name,
    parentName: student.parentName,
    parentPhone: student.parentPhone,
    parentEmail: student.parentEmail ?? "",
    address: student.address ?? "",
    gender: student.gender,
    leadSource: student.leadSource ?? "",
    saleOwnerId,
    leadNote: student.leadNote ?? "",
    healthNote: student.healthNote ?? ""
  }
}

export function nullableTrim(value: string) {
  const trimmed = value.trim()
  return trimmed || null
}

export function pinnedColumnStyle(column: ColumnKey, pinnedColumns: Set<ColumnKey>, pinnedColumnOffsets: Map<ColumnKey, number>): CSSProperties | undefined {
  if (!pinnedColumns.has(column)) return undefined
  const width = pinnedColumnWidths[column] ?? 180

  return {
    left: pinnedColumnOffsets.get(column) ?? 0,
    minWidth: width,
    width
  }
}

export function pinnedColumnClass(column: ColumnKey, pinnedColumns: Set<ColumnKey>, surface: "head" | "body") {
  if (!pinnedColumns.has(column)) return ""
  const bgClass = surface === "head" ? "bg-[#f5eeeb]" : "bg-[#fffaf7]"
  const zClass = surface === "head" ? "z-20" : "z-10"
  return `sticky ${zClass} ${bgClass} border-r border-brand-red/10 shadow-[8px_0_18px_rgba(88,52,42,0.08)]`
}
