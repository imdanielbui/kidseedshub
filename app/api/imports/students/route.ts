import bcrypt from "bcryptjs"
import ExcelJS from "exceljs"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/backend/activity"
import { nextStudentCode } from "@/lib/backend/codes"
import { createParentInitialPassword } from "@/lib/backend/parent-password"
import type { StudentImportResult, StudentImportRow } from "@/lib/contracts/imports"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { studentStatuses } from "@/lib/validations/student"

const importRequestSchema = z.object({
  mode: z.enum(["preview", "commit"]).default("preview"),
  fileName: z.string().min(1),
  fileBase64: z.string().min(1)
})

const headerAliases: Record<string, keyof Omit<StudentImportRow, "rowNumber" | "errors">> = {
  studentname: "studentName",
  "student name": "studentName",
  "ten hoc vien": "studentName",
  "tên học viên": "studentName",
  parentname: "parentName",
  "parent name": "parentName",
  "ten phu huynh": "parentName",
  "tên phụ huynh": "parentName",
  parentphone: "parentPhone",
  "parent phone": "parentPhone",
  phone: "parentPhone",
  "sdt phu huynh": "parentPhone",
  "sđt phụ huynh": "parentPhone",
  parentemail: "parentEmail",
  "parent email": "parentEmail",
  email: "parentEmail",
  status: "status",
  leadsource: "leadSource",
  "lead source": "leadSource",
  source: "leadSource",
  healthnote: "healthNote",
  "health note": "healthNote",
  note: "healthNote"
}

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
}

function getCellText(value: ExcelJS.CellValue) {
  if (value === null || value === undefined) return ""
  if (typeof value === "object" && "text" in value) return String(value.text ?? "").trim()
  if (typeof value === "object" && "result" in value) return String(value.result ?? "").trim()
  return String(value).trim()
}

async function parseWorkbook(fileBase64: string): Promise<StudentImportRow[]> {
  const workbook = new ExcelJS.Workbook()
  const buffer = Buffer.from(fileBase64, "base64")
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  await workbook.xlsx.load(arrayBuffer as ArrayBuffer)
  const worksheet = workbook.worksheets[0]

  if (!worksheet) return []

  const headerRow = worksheet.getRow(1)
  const headerMap = new Map<number, keyof Omit<StudentImportRow, "rowNumber" | "errors">>()
  headerRow.eachCell((cell, colNumber) => {
    const mapped = headerAliases[normalizeHeader(cell.value)]
    if (mapped) headerMap.set(colNumber, mapped)
  })

  const rows: StudentImportRow[] = []
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return

    const data: Partial<StudentImportRow> = {}
    for (const [colNumber, key] of headerMap.entries()) {
      data[key] = getCellText(row.getCell(colNumber).value) as never
    }

    if (!data.studentName && !data.parentName && !data.parentPhone) return

    const status = String(data.status || "LEAD").toUpperCase()
    const errors: string[] = []

    if (!data.studentName) errors.push("Thiếu tên học viên")
    if (!data.parentName) errors.push("Thiếu tên phụ huynh")
    if (!data.parentPhone || data.parentPhone.length < 8) errors.push("SĐT phụ huynh không hợp lệ")
    if (!studentStatuses.includes(status as StudentImportRow["status"])) errors.push("Status không hợp lệ")

    rows.push({
      rowNumber,
      studentName: data.studentName ?? "",
      parentName: data.parentName ?? "",
      parentPhone: data.parentPhone ?? "",
      parentEmail: data.parentEmail || undefined,
      status: studentStatuses.includes(status as StudentImportRow["status"]) ? (status as StudentImportRow["status"]) : "LEAD",
      leadSource: data.leadSource || undefined,
      healthNote: data.healthNote || undefined,
      errors
    })
  })

  return rows
}

function toResult(mode: "preview" | "commit", rows: StudentImportRow[], createdStudents: number): StudentImportResult {
  const invalidRows = rows.filter((row) => row.errors.length > 0).length
  return {
    mode,
    totalRows: rows.length,
    validRows: rows.length - invalidRows,
    invalidRows,
    createdStudents,
    rows
  }
}

export async function POST(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "students:create")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền import học viên." }, { status: 403 })
  }

  const body = await request.json()
  const parsed = importRequestSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "File import không hợp lệ." }, { status: 400 })
  }

  const rows = await parseWorkbook(parsed.data.fileBase64)

  if (parsed.data.mode === "preview") {
    return ok(toResult("preview", rows, 0))
  }

  const validRows = rows.filter((row) => row.errors.length === 0)
  const createdStudents = await prisma.$transaction(async (tx) => {
    let createdCount = 0

    for (const row of validRows) {
      const parentPassword = createParentInitialPassword(row.parentPhone)
      const parentPasswordHash = await bcrypt.hash(parentPassword.plainText, 10)
      const parentUser = await tx.user.upsert({
        where: { phone: row.parentPhone },
        create: {
          name: row.parentName,
          phone: row.parentPhone,
          email: row.parentEmail,
          password: parentPasswordHash,
          role: "PARENT"
        },
        update: {
          name: row.parentName,
          email: row.parentEmail
        }
      })
      const parent = await tx.parent.upsert({
        where: { userId: parentUser.id },
        create: { userId: parentUser.id },
        update: {}
      })

      await tx.student.create({
        data: {
          code: await nextStudentCode(tx),
          name: row.studentName,
          status: row.status,
          stageChangedAt: new Date(),
          leadSource: row.leadSource,
          healthNote: row.healthNote,
          parentId: parent.id
        }
      })
      createdCount += 1
    }

    await createAuditLog(tx, {
      actorId: session.user.id,
      action: "students.import",
      entityType: "StudentImport",
      summary: `Import ${createdCount} học viên từ ${parsed.data.fileName}`,
      metadata: {
        fileName: parsed.data.fileName,
        totalRows: rows.length,
        validRows: validRows.length,
        invalidRows: rows.length - validRows.length
      }
    })

    return createdCount
  })

  return ok(toResult("commit", rows, createdStudents), { status: 201 })
}
