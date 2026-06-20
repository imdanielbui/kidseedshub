import { spawnSync } from "node:child_process"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import bcrypt from "bcryptjs"
import { Prisma, PrismaClient, type CourseSubject, type Gender, type Role, type StudentStatus } from "@prisma/client"
import { replaceClassSchedule, type ScheduleSlotInput } from "../lib/backend/class-schedule"
import { createParentInitialPassword } from "../lib/backend/parent-password"

const prisma = new PrismaClient()

const defaultFiles = [
  "/Users/mac/Downloads/danh_sach_thanh_vien(3).xls",
  "/Users/mac/Downloads/danh_sach_thanh_vien(4).xls",
  "/Users/mac/Downloads/danh_sach_thanh_vien(5).xls"
]

const financeImportNotePrefix = "Import số dư hệ thống cũ"

type RawRow = Record<string, unknown>

type ParsedClass = {
  code: string
  name: string
  status?: string
  ageRange?: string
  subject: CourseSubject
  courseName: string
  startDate?: string
  weekday: number
  startTime: string
  endTime: string
  slots: ScheduleSlotInput[]
  isActive: boolean
}

type ParsedMember = {
  rowNumber: number
  sourceFile: string
  code: string
  name: string
  parentName: string
  parentPhone: string
  parentEmail?: string
  invalidEmail?: string
  birthDate?: Date
  gender: Gender
  address?: string
  status: StudentStatus
  leadSource?: string
  healthNote?: string
  leadNote: string
  createdAt?: Date
  classes: ParsedClass[]
  saleNames: string[]
  teacherNames: string[]
  creatorNames: string[]
  tuitionCreditAmount: Prisma.Decimal
  promotionCreditAmount: Prisma.Decimal
  depositCreditAmount: Prisma.Decimal
}

type StaffCandidate = {
  name: string
  role: Extract<Role, "ADMIN" | "SALE" | "TEACHER">
  source: string
}

type CreatedStaffCredential = {
  name: string
  role: StaffCandidate["role"]
  phone: string
  password: string
}

type ImportStats = {
  files: number
  rows: number
  studentsCreated: number
  studentsUpdated: number
  parentsCreated: number
  parentsUpdated: number
  coursesCreated: number
  classesCreated: number
  classSchedulesRefreshed: number
  classMembershipsCreated: number
  classMembershipsUpdated: number
  enrollmentsCreated: number
  enrollmentsUpdated: number
  staffCreated: number
  staffExisting: number
  walletCreditsCreated: number
  walletCreditsSkipped: number
  walletCreditAmount: string
  invalidPhoneFallbacks: number
  invalidEmailsSkipped: number
  skippedRows: number
}

type Tx = Prisma.TransactionClient

function argValue(name: string) {
  const prefix = `--${name}=`
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length)
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`)
}

function csvCell(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`
}

function writeStaffCredentials(credentials: CreatedStaffCredential[]) {
  if (credentials.length === 0) return undefined
  const outputDir = path.join(process.cwd(), "output")
  fs.mkdirSync(outputDir, { recursive: true })
  const outputPath = path.join(outputDir, `staging-staff-credentials-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`)
  const rows = [
    ["name", "role", "phone", "password"].map(csvCell).join(","),
    ...credentials.map((credential) =>
      [credential.name, credential.role, credential.phone, credential.password].map(csvCell).join(",")
    )
  ]
  fs.writeFileSync(outputPath, `${rows.join("\n")}\n`, "utf8")
  return outputPath
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

function parseWorkbook(filePath: string): RawRow[] {
  const result = spawnSync("npx", ["--yes", "xlsx-cli", "--json", filePath], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20
  })

  if (result.status !== 0) {
    throw new Error(`Không đọc được file ${filePath}: ${result.stderr || result.stdout}`)
  }

  const parsed = JSON.parse(result.stdout) as unknown
  if (!Array.isArray(parsed)) {
    throw new Error(`File ${filePath} không trả về danh sách dòng hợp lệ.`)
  }

  return parsed as RawRow[]
}

function normalizePhone(value: string, code: string) {
  const candidates = value
    .split(/[\n,;/|]+/)
    .map((part) => part.replace(/\D/g, ""))
    .filter(Boolean)

  const valid = candidates.find((candidate) => candidate.length >= 8)
  return {
    phone: valid ?? `IMPORT-${code}`,
    usedFallback: !valid
  }
}

function normalizeEmail(value: string) {
  if (!value || !value.includes("@")) return undefined
  const normalized = value.toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : undefined
}

function parseDateOnly(value: string) {
  const normalized = value.trim()
  if (!normalized || normalized.startsWith("0001-")) return undefined
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return undefined
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00`)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function parseDateTime(value: string) {
  const normalized = value.trim()
  if (!normalized) return undefined
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}))?/)
  if (!match) return undefined
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4] ?? "0"),
    Number(match[5] ?? "0")
  )
  return Number.isNaN(date.getTime()) ? undefined : date
}

function parseMoney(value: string) {
  const normalized = value.replace(/[^\d.-]/g, "")
  if (!normalized) return new Prisma.Decimal(0)
  const amount = new Prisma.Decimal(normalized)
  return amount.isFinite() && amount.gt(0) ? amount : new Prisma.Decimal(0)
}

function parseClassStartDate(value: string) {
  const match = value.match(/(?:^|[_\s])(\d{2})\/(\d{2})\/(\d{2})(?:[_\s]|$)/)
  if (!match) return undefined
  const year = 2000 + Number(match[1])
  return `${year}-${match[2]}-${match[3]}`
}

function parseGender(value: string): Gender {
  const normalized = value.toLowerCase()
  if (normalized.includes("nữ") || normalized.includes("nu")) return "FEMALE"
  if (normalized.includes("nam")) return "MALE"
  return "UNKNOWN"
}

function parseStatus(row: RawRow, classes: ParsedClass[]): StudentStatus {
  const relationship = text(row["Mối quan hệ"]).toLowerCase()
  const hasInvoice = Boolean(text(row["Hóa đơn đầu tiên"]))
  const hasActiveClass = classes.some((klass) => klass.isActive)

  if (hasActiveClass || hasInvoice) return "ACTIVE"
  if (relationship.includes("học thử") || relationship.includes("hứa đi học")) return "TRIAL"
  if (relationship.includes("thẩm định")) return "EVALUATION"
  if (relationship.includes("đăng ký form")) return "CONVERTED"
  return "LEAD"
}

function parseTimeToken(value: string) {
  const match = value.match(/(\d{1,2})H(?:(\d{2}))?-(\d{1,2})H(?:(\d{2}))?/i)
  if (!match) return undefined
  const startHour = match[1].padStart(2, "0")
  const startMinute = (match[2] ?? "00").padStart(2, "0")
  const endHour = match[3].padStart(2, "0")
  const endMinute = (match[4] ?? "00").padStart(2, "0")
  return {
    startTime: `${startHour}:${startMinute}`,
    endTime: `${endHour}:${endMinute}`
  }
}

function parseWeekdays(value: string) {
  const compact = value.replace(/\s+/g, "_").toUpperCase()
  const segment = compact.match(/(?:^|[_/])T((?:[2-7]|CN|&)+)(?=[_/]|$)/)?.[1]
  if (!segment) return []

  const weekdays: number[] = []
  for (let index = 0; index < segment.length; index += 1) {
    const token = segment[index]
    if (token >= "2" && token <= "7") {
      weekdays.push(Number(token) - 1)
    } else if (token === "C" && segment[index + 1] === "N") {
      weekdays.push(0)
      index += 1
    }
  }

  return Array.from(new Set(weekdays))
}

function inferSubject(value: string): CourseSubject {
  const normalized = value.toUpperCase()
  return normalized.includes("RO") || normalized.includes("ROBOTICS") ? "ROBOTICS" : "FUN"
}

function inferCourseName(value: string, subject: CourseSubject) {
  const normalized = value.toUpperCase()
  if (subject === "ROBOTICS") return "Imported Robotics"
  if (normalized.includes("ENG")) return "Imported English"
  if (normalized.includes("BIO") || normalized.includes("SINH")) return "Imported Biology"
  if (normalized.includes("WS")) return "Imported Workshop"
  if (normalized.includes("TIỀN") || normalized.includes("TIỀN")) return "Imported Tien Tieu Hoc"
  return "Imported FUN"
}

function parseClassEntry(value: string): ParsedClass | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined

  const statusMatch = trimmed.match(/\(([^()]*)\)\s*$/)
  const status = statusMatch?.[1]?.trim()
  const statusIndex = statusMatch?.index ?? trimmed.length
  const withoutStatus = status ? trimmed.slice(0, statusIndex).trim() : trimmed
  const ageMatch = withoutStatus.match(/\(([^()]*)\)\s*$/)
  const ageRange = ageMatch?.[1]?.trim()
  const ageIndex = ageMatch?.index ?? withoutStatus.length
  const code = (ageRange ? withoutStatus.slice(0, ageIndex).trim() : withoutStatus).trim()

  if (!code) return undefined

  const subject = inferSubject(code)
  const time = parseTimeToken(code) ?? { startTime: "17:00", endTime: "18:30" }
  const weekdays = parseWeekdays(code)
  const isActive = !["finished", "no class schedule yet"].includes((status ?? "").toLowerCase())
  const slots = (weekdays.length ? weekdays : [1]).map((weekday) => ({
    weekday,
    startTime: time.startTime,
    endTime: time.endTime,
    isActive
  }))

  return {
    code: code.slice(0, 160),
    name: code,
    status,
    ageRange,
    subject,
    courseName: inferCourseName(code, subject),
    startDate: parseClassStartDate(code),
    weekday: slots[0].weekday,
    startTime: time.startTime,
    endTime: time.endTime,
    slots,
    isActive
  }
}

function parseClasses(value: string) {
  const normalized = value.trim()
  if (!normalized) return []

  return normalized
    .split(/\n+/)
    .map(parseClassEntry)
    .filter((klass): klass is ParsedClass => Boolean(klass))
}

function parseNameList(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[,;\n]+/)
        .map((part) => part.trim())
        .filter(Boolean)
    )
  )
}

function buildLeadNote(row: RawRow, sourceFile: string, rowNumber: number, invalidEmail?: string) {
  const notes = [
    `Import dữ liệu thật từ ${path.basename(sourceFile)} dòng ${rowNumber}.`,
    text(row["Mối quan hệ"]) ? `Mối quan hệ: ${text(row["Mối quan hệ"])}` : "",
    text(row["Được sale bởi"]) ? `Sale gốc: ${text(row["Được sale bởi"])}` : "",
    text(row["Giáo viên phụ trách"]) ? `Giáo viên phụ trách gốc: ${text(row["Giáo viên phụ trách"])}` : "",
    text(row["Được tạo bởi"]) ? `Người tạo gốc: ${text(row["Được tạo bởi"])}` : "",
    text(row["Hóa đơn đầu tiên"]) ? `Hóa đơn đầu tiên: ${text(row["Hóa đơn đầu tiên"])}` : "",
    invalidEmail ? `Email gốc không hợp lệ: ${invalidEmail}` : "",
    text(row["Mô tả"]) ? `Mô tả: ${text(row["Mô tả"])}` : ""
  ]

  return notes.filter(Boolean).join("\n")
}

function parseMembers(files: string[]) {
  const members: ParsedMember[] = []
  const skippedRows: Array<{ file: string; rowNumber: number; reason: string }> = []

  for (const file of files) {
    const rows = parseWorkbook(file)
    rows.forEach((row, index) => {
      const rowNumber = index + 2
      const code = text(row["Mã số"])
      const name = text(row["Họ và tên"])

      if (!code || !name) {
        skippedRows.push({ file, rowNumber, reason: "Thiếu mã số hoặc họ tên" })
        return
      }

      const phone = normalizePhone(text(row["Số điện thoại"]), code)
      const rawEmail = text(row["Thư điện tử"])
      const parentEmail = normalizeEmail(rawEmail)
      const classes = parseClasses(text(row["Lớp học"]))
      const parentName = text(row["Tên phụ huynh"]) || text(row["Phụ huynh"]) || `PH - ${name}`

      members.push({
        rowNumber,
        sourceFile: file,
        code,
        name,
        parentName,
        parentPhone: phone.phone,
        parentEmail,
        invalidEmail: rawEmail && !parentEmail ? rawEmail : undefined,
        birthDate: parseDateOnly(text(row["Sinh nhật"])),
        gender: parseGender(text(row["Giới tính"])),
        address: text(row["Địa chỉ"]) || undefined,
        status: parseStatus(row, classes),
        leadSource: text(row["Nguồn khách hàng"]) || undefined,
        healthNote: text(row["Lưu ý sức khỏe"]) || undefined,
        leadNote: buildLeadNote(row, file, rowNumber, rawEmail && !parentEmail ? rawEmail : undefined),
        createdAt: parseDateTime(text(row["Ngày tạo tài khoản"])),
        classes,
        saleNames: parseNameList(text(row["Được sale bởi"])),
        teacherNames: parseNameList(text(row["Giáo viên phụ trách"])),
        creatorNames: parseNameList(text(row["Được tạo bởi"])),
        tuitionCreditAmount: parseMoney(text(row["Tài khoản học phí"])),
        promotionCreditAmount: parseMoney(text(row["Tài khoản khuyến mại"])),
        depositCreditAmount: parseMoney(text(row["Tài khoản đặt cọc"]))
      })
    })
  }

  return { members, skippedRows }
}

function staffPhone(role: StaffCandidate["role"], name: string) {
  const hash = crypto.createHash("sha1").update(`${role}:${name}`).digest("hex").slice(0, 8).toUpperCase()
  return `KSH${role.slice(0, 3)}${hash}`
}

function staffPassword() {
  return crypto.randomBytes(9).toString("base64url")
}

function collectStaffCandidates(members: ParsedMember[]) {
  const byKey = new Map<string, StaffCandidate>()
  const add = (candidate: StaffCandidate | undefined) => {
    if (!candidate?.name) return
    byKey.set(`${candidate.role}:${candidate.name}`, candidate)
  }

  for (const member of members) {
    for (const saleName of member.saleNames) add({ name: saleName, role: "SALE", source: "sale" })
    for (const creatorName of member.creatorNames) add({ name: creatorName, role: "SALE", source: "creator" })
    for (const teacherName of member.teacherNames) {
      add({
        name: teacherName,
        role: teacherName.toLowerCase() === "quản lý" ? "ADMIN" : "TEACHER",
        source: "teacher"
      })
    }
  }

  return Array.from(byKey.values()).sort((left, right) => {
    const roleOrder = left.role.localeCompare(right.role)
    return roleOrder === 0 ? left.name.localeCompare(right.name, "vi") : roleOrder
  })
}

async function importStaff(tx: Tx, members: ParsedMember[], stats: ImportStats) {
  const credentials: CreatedStaffCredential[] = []

  for (const candidate of collectStaffCandidates(members)) {
    const phone = staffPhone(candidate.role, candidate.name)
    const existing = await tx.user.findUnique({
      where: { phone },
      select: { id: true }
    })

    if (existing) {
      stats.staffExisting += 1
      continue
    }

    const password = staffPassword()
    await tx.user.create({
      data: {
        name: candidate.name,
        phone,
        password: await bcrypt.hash(password, 10),
        role: candidate.role,
        isActive: true
      }
    })
    stats.staffCreated += 1
    credentials.push({ name: candidate.name, role: candidate.role, phone, password })
  }

  return credentials
}

async function findImportedStaff(tx: Tx, role: StaffCandidate["role"], name: string | undefined) {
  if (!name) return undefined
  return tx.user.findUnique({
    where: { phone: staffPhone(role, name) },
    select: { id: true }
  })
}

async function safeEmailForPhone(tx: Tx, email: string | undefined, phone: string) {
  if (!email) return undefined
  const existing = await tx.user.findUnique({ where: { email }, select: { phone: true } })
  return !existing || existing.phone === phone ? email : undefined
}

async function findStaff(tx: Tx, role: "ADMIN" | "TEACHER", subject?: CourseSubject) {
  const preferredName =
    role === "ADMIN" ? undefined : subject === "ROBOTICS" ? "Teacher Robotics" : "Teacher FUN"
  const user = await tx.user.findFirst({
    where: {
      role,
      isActive: true,
      ...(preferredName ? { name: preferredName } : {})
    },
    orderBy: { createdAt: "asc" },
    select: { id: true }
  })

  if (user) return user.id

  const fallback = await tx.user.findFirst({
    where: { role, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true }
  })

  return fallback?.id
}

async function getOrCreateCourse(tx: Tx, klass: ParsedClass, stats: ImportStats) {
  const existing = await tx.course.findFirst({
    where: {
      name: klass.courseName,
      subject: klass.subject
    }
  })

  if (existing) return existing

  stats.coursesCreated += 1
  return tx.course.create({
    data: {
      name: klass.courseName,
      subject: klass.subject,
      description: `Khóa học import từ dữ liệu học viên thật (${klass.subject}).`,
      totalSessions: 16,
      price: new Prisma.Decimal(0),
      isActive: true
    }
  })
}

async function getOrCreateClass(
  tx: Tx,
  klass: ParsedClass,
  stats: ImportStats,
  refreshClassSchedules: boolean,
  refreshedClassCodes: Set<string>
) {
  const existing = await tx.class.findUnique({
    where: { code: klass.code },
    include: { course: true }
  })

  if (existing) {
    if (refreshClassSchedules && !refreshedClassCodes.has(klass.code)) {
      const updated = await tx.class.update({
        where: { id: existing.id },
        data: {
          weekday: klass.weekday,
          startTime: klass.startTime,
          endTime: klass.endTime,
          room: klass.ageRange,
          startDate: klass.startDate ? new Date(`${klass.startDate}T00:00:00`) : existing.startDate,
          plannedSessions: existing.course.totalSessions,
          isActive: klass.isActive
        },
        include: { course: true }
      })
      await replaceClassSchedule(tx, {
        classId: updated.id,
        startDate: klass.startDate,
        plannedSessions: updated.course.totalSessions,
        slots: klass.slots
      })
      stats.classSchedulesRefreshed += 1
      refreshedClassCodes.add(klass.code)
      return updated
    }

    return existing
  }

  const course = await getOrCreateCourse(tx, klass, stats)
  const teacherId = await findStaff(tx, "TEACHER", klass.subject)
  if (!teacherId) {
    throw new Error(`Không tìm thấy teacher active cho lớp ${klass.code}.`)
  }

  const created = await tx.class.create({
    data: {
      code: klass.code,
      name: klass.name,
      courseId: course.id,
      teacherId,
      weekday: klass.weekday,
      startTime: klass.startTime,
      endTime: klass.endTime,
      room: klass.ageRange,
      startDate: klass.startDate ? new Date(`${klass.startDate}T00:00:00`) : undefined,
      plannedSessions: course.totalSessions,
      isActive: klass.isActive
    },
    include: { course: true }
  })

  await replaceClassSchedule(tx, {
    classId: created.id,
    startDate: klass.startDate,
    plannedSessions: course.totalSessions,
    slots: klass.slots
  })

  stats.classesCreated += 1
  return created
}

async function upsertEnrollment(tx: Tx, input: {
  studentId: string
  courseId: string
  startDate?: string
  isActive: boolean
  stats: ImportStats
}) {
  const existing = await tx.enrollment.findFirst({
    where: {
      studentId: input.studentId,
      courseId: input.courseId
    }
  })

  if (existing) {
    input.stats.enrollmentsUpdated += 1
    return tx.enrollment.update({
      where: { id: existing.id },
      data: {
        startDate: input.startDate ? new Date(`${input.startDate}T00:00:00`) : existing.startDate,
        isActive: input.isActive
      }
    })
  }

  input.stats.enrollmentsCreated += 1
  return tx.enrollment.create({
    data: {
      studentId: input.studentId,
      courseId: input.courseId,
      sessionsBought: 16,
      sessionsUsed: 0,
      totalCourseSessionsAtJoin: 16,
      startDate: input.startDate ? new Date(`${input.startDate}T00:00:00`) : undefined,
      isActive: input.isActive
    }
  })
}

async function createWalletCreditIfNeeded(tx: Tx, input: {
  studentId: string
  amount: Prisma.Decimal
  note: string
  createdById: string
  stats: ImportStats
}) {
  if (!input.amount.gt(0)) return

  const existing = await tx.studentWalletEntry.findFirst({
    where: {
      studentId: input.studentId,
      type: "CREDIT",
      note: input.note
    },
    select: { id: true }
  })

  if (existing) {
    input.stats.walletCreditsSkipped += 1
    return
  }

  await tx.studentWalletEntry.create({
    data: {
      studentId: input.studentId,
      amount: input.amount,
      type: "CREDIT",
      note: input.note,
      createdById: input.createdById
    }
  })
  input.stats.walletCreditsCreated += 1
  input.stats.walletCreditAmount = new Prisma.Decimal(input.stats.walletCreditAmount).add(input.amount).toString()
}

async function importMemberWalletCredits(tx: Tx, member: ParsedMember, studentId: string, adminId: string, stats: ImportStats) {
  await createWalletCreditIfNeeded(tx, {
    studentId,
    amount: member.tuitionCreditAmount,
    note: `${financeImportNotePrefix}: tài khoản học phí (${member.code}).`,
    createdById: adminId,
    stats
  })
  await createWalletCreditIfNeeded(tx, {
    studentId,
    amount: member.promotionCreditAmount,
    note: `${financeImportNotePrefix}: tài khoản khuyến mại (${member.code}).`,
    createdById: adminId,
    stats
  })
  await createWalletCreditIfNeeded(tx, {
    studentId,
    amount: member.depositCreditAmount,
    note: `${financeImportNotePrefix}: tài khoản đặt cọc (${member.code}).`,
    createdById: adminId,
    stats
  })
}

async function importMembers(
  members: ParsedMember[],
  stats: ImportStats,
  refreshClassSchedules: boolean,
  createStaff: boolean,
  importWalletCredits: boolean,
  skipExistingStudents: boolean
) {
  const adminId = await findStaff(prisma, "ADMIN")
  if (!adminId) throw new Error("Không tìm thấy admin active để ghi createdBy/audit.")
  const refreshedClassCodes = new Set<string>()
  const credentials: CreatedStaffCredential[] = []

  if (createStaff) {
    await prisma.$transaction(async (tx) => {
      credentials.push(...(await importStaff(tx, members, stats)))
    }, { timeout: 60_000 })
  }

  for (const member of members) {
    await prisma.$transaction(async (tx) => {
      const existingStudent = await tx.student.findUnique({
        where: { code: member.code },
        select: { id: true }
      })

      if (skipExistingStudents && existingStudent) {
        stats.studentsUpdated += 1
        return
      }

      const safeEmail = await safeEmailForPhone(tx, member.parentEmail, member.parentPhone)
      if (member.parentEmail && !safeEmail) stats.invalidEmailsSkipped += 1

      const existingParentUser = await tx.user.findUnique({
        where: { phone: member.parentPhone },
        select: { id: true }
      })
      const parentPassword = createParentInitialPassword(member.parentPhone)
      const parentUser = existingParentUser
        ? await tx.user.update({
          where: { phone: member.parentPhone },
          data: {
            name: member.parentName,
            ...(safeEmail ? { email: safeEmail } : {})
          }
        })
        : await tx.user.create({
          data: {
            name: member.parentName,
            phone: member.parentPhone,
            email: safeEmail,
            password: await bcrypt.hash(parentPassword.plainText, 10),
            role: "PARENT",
            isActive: member.status === "ACTIVE"
          }
        })

      if (existingParentUser) stats.parentsUpdated += 1
      else stats.parentsCreated += 1

      const parent = await tx.parent.upsert({
        where: { userId: parentUser.id },
        create: { userId: parentUser.id },
        update: {}
      })

      const saleOwner = await findImportedStaff(tx, "SALE", member.saleNames[0])
      const assignedTeacherName = member.teacherNames.find((name) => name.toLowerCase() !== "quản lý")
      const assignedTeacher = await findImportedStaff(tx, "TEACHER", assignedTeacherName)
      const createdBy = (await findImportedStaff(tx, "SALE", member.creatorNames[0])) ?? { id: adminId }

      const student = await tx.student.upsert({
        where: { code: member.code },
        create: {
          code: member.code,
          name: member.name,
          birthDate: member.birthDate,
          address: member.address,
          parentId: parent.id,
          status: member.status,
          leadSource: member.leadSource,
          leadNote: member.leadNote,
          healthNote: member.healthNote,
          gender: member.gender,
          stageChangedAt: new Date(),
          saleOwnerId: saleOwner?.id,
          assignedTeacherId: assignedTeacher?.id,
          createdById: createdBy.id,
          createdAt: member.createdAt
        },
        update: {
          name: member.name,
          birthDate: member.birthDate,
          address: member.address,
          parentId: parent.id,
          status: member.status,
          leadSource: member.leadSource,
          leadNote: member.leadNote,
          healthNote: member.healthNote,
          gender: member.gender,
          saleOwnerId: saleOwner?.id,
          assignedTeacherId: assignedTeacher?.id
        }
      })

      if (existingStudent) stats.studentsUpdated += 1
      else stats.studentsCreated += 1

      for (const klass of member.classes) {
        const createdClass = await getOrCreateClass(tx, klass, stats, refreshClassSchedules, refreshedClassCodes)
        await upsertEnrollment(tx, {
          studentId: student.id,
          courseId: createdClass.courseId,
          startDate: klass.startDate,
          isActive: klass.isActive,
          stats
        })

        const existingMembership = await tx.classStudent.findUnique({
          where: {
            classId_studentId: {
              classId: createdClass.id,
              studentId: student.id
            }
          },
          select: { id: true }
        })

        await tx.classStudent.upsert({
          where: {
            classId_studentId: {
              classId: createdClass.id,
              studentId: student.id
            }
          },
          create: {
            classId: createdClass.id,
            studentId: student.id,
            joinedAt: klass.startDate ? new Date(`${klass.startDate}T00:00:00`) : undefined,
            isActive: klass.isActive
          },
          update: {
            isActive: klass.isActive
          }
        })

        if (existingMembership) stats.classMembershipsUpdated += 1
        else stats.classMembershipsCreated += 1
      }

      if (importWalletCredits) {
        await importMemberWalletCredits(tx, member, student.id, adminId, stats)
      }
    }, { timeout: 60_000 })
  }

  await prisma.$transaction(async (tx) => {
    await tx.auditLog.create({
      data: {
        actorId: adminId,
        action: "students.import_real_members",
        entityType: "StudentImport",
        summary: `Import ${stats.studentsCreated} học viên thật, cập nhật ${stats.studentsUpdated} học viên.`,
        metadata: stats as unknown as Prisma.InputJsonValue
      }
    })
  }, { timeout: 60_000 })

  return credentials
}

async function main() {
  const commit = hasFlag("commit")
  const createStaff = hasFlag("create-staff")
  const importWalletCredits = hasFlag("import-wallet-credits")
  const skipExistingStudents = hasFlag("skip-existing-students")
  const refreshClassSchedules = hasFlag("refresh-class-schedules")
  const files = argValue("files")?.split(",").map((file) => file.trim()).filter(Boolean) ?? defaultFiles
  const { members, skippedRows } = parseMembers(files)
  const staffCandidates = collectStaffCandidates(members)
  const walletCreditCandidates = members.flatMap((member) => [
    { code: member.code, kind: "tuition", amount: member.tuitionCreditAmount },
    { code: member.code, kind: "promotion", amount: member.promotionCreditAmount },
    { code: member.code, kind: "deposit", amount: member.depositCreditAmount }
  ]).filter((entry) => entry.amount.gt(0))
  const stats: ImportStats = {
    files: files.length,
    rows: members.length,
    studentsCreated: 0,
    studentsUpdated: 0,
    parentsCreated: 0,
    parentsUpdated: 0,
    coursesCreated: 0,
    classesCreated: 0,
    classSchedulesRefreshed: 0,
    classMembershipsCreated: 0,
    classMembershipsUpdated: 0,
    enrollmentsCreated: 0,
    enrollmentsUpdated: 0,
    staffCreated: 0,
    staffExisting: 0,
    walletCreditsCreated: 0,
    walletCreditsSkipped: 0,
    walletCreditAmount: "0",
    invalidPhoneFallbacks: members.filter((member) => member.parentPhone.startsWith("IMPORT-")).length,
    invalidEmailsSkipped: members.filter((member) => member.invalidEmail).length,
    skippedRows: skippedRows.length
  }

  const classCodes = Array.from(new Set(members.flatMap((member) => member.classes.map((klass) => klass.code)))).sort()
  let staffCredentialsPath: string | undefined

  if (commit) {
    const credentials = await importMembers(
      members,
      stats,
      refreshClassSchedules,
      createStaff,
      importWalletCredits,
      skipExistingStudents
    )
    staffCredentialsPath = writeStaffCredentials(credentials)
  }

  console.log(
    JSON.stringify(
      {
        mode: commit ? "commit" : "dry-run",
        stats,
        options: {
          createStaff,
          importWalletCredits,
          skipExistingStudents,
          refreshClassSchedules
        },
        staffCandidates: {
          count: staffCandidates.length,
          byRole: staffCandidates.reduce<Record<string, number>>((accumulator, candidate) => {
            accumulator[candidate.role] = (accumulator[candidate.role] ?? 0) + 1
            return accumulator
          }, {}),
          items: staffCandidates
        },
        walletCreditCandidates: {
          count: walletCreditCandidates.length,
          totalAmount: walletCreditCandidates
            .reduce((total, entry) => total.add(entry.amount), new Prisma.Decimal(0))
            .toString(),
          byKind: walletCreditCandidates.reduce<Record<string, { count: number; amount: string }>>((accumulator, entry) => {
            const current = accumulator[entry.kind] ?? { count: 0, amount: "0" }
            accumulator[entry.kind] = {
              count: current.count + 1,
              amount: new Prisma.Decimal(current.amount).add(entry.amount).toString()
            }
            return accumulator
          }, {})
        },
        staffCredentialsPath,
        classCount: classCodes.length,
        classCodes,
        skippedRows
      },
      null,
      2
    )
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
