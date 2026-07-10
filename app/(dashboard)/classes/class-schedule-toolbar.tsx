"use client"

import { ChevronLeft, ChevronRight, Maximize2, Minimize2, RefreshCcw } from "lucide-react"
import type { Dispatch, SetStateAction } from "react"
import { defaultMonth, shiftMonth, shiftWeek, startOfWeek, today } from "./class-schedule-utils"

type ClassScheduleToolbarProps = {
  view: "calendar" | "week" | "setup"
  month: string
  isFullscreen: boolean
  setMonth: Dispatch<SetStateAction<string>>
  setWeekStart: Dispatch<SetStateAction<Date>>
  setIsFullscreen: Dispatch<SetStateAction<boolean>>
  loadSchedule: () => Promise<void>
}

export function ClassScheduleToolbar({
  view,
  month,
  isFullscreen,
  setMonth,
  setWeekStart,
  setIsFullscreen,
  loadSchedule
}: ClassScheduleToolbarProps) {
  return (
    <div className="flex flex-col gap-3 p-4 xl:flex-row xl:items-center xl:justify-between">
      <h2 className="text-lg font-semibold text-brand-ink">{view === "week" ? "Lịch tuần" : "Lịch tháng"}</h2>
      <div className="flex flex-wrap gap-2 xl:justify-end">
        <button
          type="button"
          className="neu-list-item rounded-2xl p-3 text-brand-red"
          onClick={() => {
            if (view === "week") {
              setWeekStart((current) => shiftWeek(current, -1))
              return
            }
            setMonth(shiftMonth(month, -1))
          }}
          aria-label={view === "week" ? "Tuần trước" : "Tháng trước"}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="neu-list-item rounded-2xl px-4 py-3 text-sm font-semibold text-brand-ink"
          onClick={() => {
            setMonth(defaultMonth)
            setWeekStart(startOfWeek(today))
          }}
        >
          Hôm nay
        </button>
        <button
          type="button"
          className="neu-list-item rounded-2xl p-3 text-brand-red"
          onClick={() => {
            if (view === "week") {
              setWeekStart((current) => shiftWeek(current, 1))
              return
            }
            setMonth(shiftMonth(month, 1))
          }}
          aria-label={view === "week" ? "Tuần sau" : "Tháng sau"}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button type="button" className="neu-list-item inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-stone-600 hover:text-brand-red" onClick={() => void loadSchedule()}>
          <RefreshCcw className="h-4 w-4" />
          Tải lại
        </button>
        <button
          type="button"
          className="neu-list-item inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-stone-600 hover:text-brand-red"
          onClick={() => setIsFullscreen((current) => !current)}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          {isFullscreen ? "Thu nhỏ" : "Toàn màn hình"}
        </button>
      </div>
    </div>
  )
}
