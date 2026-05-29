import type { StudentStatusKey } from "@/lib/contracts/students"

export type StudentImportRow = {
  rowNumber: number
  studentName: string
  parentName: string
  parentPhone: string
  parentEmail?: string
  status: StudentStatusKey
  leadSource?: string
  healthNote?: string
  errors: string[]
}

export type StudentImportResult = {
  mode: "preview" | "commit"
  totalRows: number
  validRows: number
  invalidRows: number
  createdStudents: number
  rows: StudentImportRow[]
}
