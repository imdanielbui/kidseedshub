import type { PrismaClient } from "@prisma/client"
import { dateKey, rescheduleSessionsOnBlockedDate } from "./class-schedule"

type TransactionClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">

export type VietnamPublicHoliday = {
  date: string
  title: string
  note: string
  type: "HOLIDAY" | "EVENT"
  affectsScheduling: boolean
}

function holidayRange(start: string, end: string, title: string, note: string): VietnamPublicHoliday[] {
  const [startYear, startMonth, startDay] = start.split("-").map(Number)
  const [endYear, endMonth, endDay] = end.split("-").map(Number)
  const current = new Date(startYear, startMonth - 1, startDay)
  const last = new Date(endYear, endMonth - 1, endDay)
  const holidays: VietnamPublicHoliday[] = []

  while (current <= last) {
    holidays.push({ date: dateKey(current), title, note, type: "HOLIDAY", affectsScheduling: true })
    current.setDate(current.getDate() + 1)
  }

  return holidays
}

function holiday(date: string, title: string, note: string): VietnamPublicHoliday {
  return { date, title, note, type: "HOLIDAY", affectsScheduling: true }
}

function event(date: string, title: string, note: string): VietnamPublicHoliday {
  return { date, title, note, type: "EVENT", affectsScheduling: false }
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day)
}

export function getVietnamPublicHolidays(year: number): VietnamPublicHoliday[] {
  const centerEvents = [
    event(`${year}-03-08`, "Ngày Quốc tế Phụ nữ", "Mốc sự kiện để trung tâm chủ động truyền thông/chúc mừng; mặc định không tự dời lịch."),
    event(`${year}-06-01`, "Ngày Quốc tế Thiếu nhi", "Mốc sự kiện phù hợp hoạt động thiếu nhi/phụ huynh; mặc định không tự dời lịch."),
    event(`${year}-09-05`, "Ngày khai giảng", "Mốc sự kiện năm học mới; mặc định không tự dời lịch."),
    event(`${year}-10-20`, "Ngày Phụ nữ Việt Nam", "Mốc sự kiện để trung tâm chủ động truyền thông/chúc mừng; mặc định không tự dời lịch."),
    event(`${year}-11-20`, "Ngày Nhà giáo Việt Nam", "Mốc sự kiện tri ân giáo viên; mặc định không tự dời lịch."),
    event(`${year}-12-24`, "Giáng sinh", "Mốc sự kiện cuối năm cho lớp học/truyền thông; mặc định không tự dời lịch.")
  ]

  if (year === 2026) {
    return [
      holiday("2026-01-01", "Tết Dương lịch", "Ngày nghỉ lễ chính thức của Việt Nam."),
      ...holidayRange(
        "2026-02-14",
        "2026-02-22",
        "Nghỉ Tết Nguyên đán 2026",
        "Lịch nghỉ Tết Âm lịch 2026 theo lịch nghỉ nhà nước; có thể xóa ngày cuối tuần nếu trung tâm vẫn dạy."
      ),
      ...holidayRange(
        "2026-04-25",
        "2026-04-27",
        "Nghỉ Giỗ tổ Hùng Vương 2026",
        "Giỗ tổ Hùng Vương 2026 rơi vào Chủ nhật 26/04, kèm ngày nghỉ bù theo lịch nhà nước."
      ),
      ...holidayRange(
        "2026-04-30",
        "2026-05-03",
        "Nghỉ 30/4 - 1/5/2026",
        "Dịp Ngày Giải phóng miền Nam và Quốc tế Lao động 2026."
      ),
      ...holidayRange(
        "2026-08-29",
        "2026-09-02",
        "Nghỉ Quốc khánh 2026",
        "Lịch nghỉ Quốc khánh 2026 theo lịch nghỉ nhà nước; gồm ngày hoán đổi và cuối tuần nếu trung tâm áp dụng."
      ),
      event("2026-09-25", "Tết Trung thu 2026", "Mốc sự kiện thiếu nhi theo lịch âm; mặc định không tự dời lịch."),
      ...centerEvents
    ]
  }

  return [
    holiday(`${year}-01-01`, "Tết Dương lịch", "Ngày nghỉ lễ chính thức của Việt Nam."),
    holiday(`${year}-04-30`, "Ngày Giải phóng miền Nam", "Ngày nghỉ lễ chính thức của Việt Nam."),
    holiday(`${year}-05-01`, "Ngày Quốc tế Lao động", "Ngày nghỉ lễ chính thức của Việt Nam."),
    holiday(`${year}-09-02`, "Quốc khánh Việt Nam", "Ngày nghỉ lễ chính thức của Việt Nam. Các ngày nghỉ kèm theo cần cập nhật theo thông báo hằng năm."),
    ...centerEvents
  ]
}

export async function ensureVietnamPublicHolidays(tx: TransactionClient, year: number) {
  const holidays = getVietnamPublicHolidays(year)
  const events = []
  let created = 0
  let skipped = 0
  let movedSessions = 0

  for (const holiday of holidays) {
    const date = parseLocalDate(holiday.date)
    const existing = await tx.scheduleEvent.findUnique({
      where: {
        date_title: {
          date,
          title: holiday.title
        }
      }
    })

    if (existing) {
      skipped += 1
      events.push(existing)
      continue
    }

    const event = await tx.scheduleEvent.create({
      data: {
        title: holiday.title,
        date,
        type: holiday.type,
        affectsScheduling: holiday.affectsScheduling,
        note: holiday.note
      }
    })

    created += 1
    if (event.affectsScheduling) {
      movedSessions += await rescheduleSessionsOnBlockedDate(tx, event.date)
    }
    events.push(event)
  }

  return {
    year,
    created,
    skipped,
    movedSessions,
    events
  }
}
