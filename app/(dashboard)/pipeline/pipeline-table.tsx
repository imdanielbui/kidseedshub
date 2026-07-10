import { Archive } from "lucide-react"
import type { MouseEvent } from "react"
import { genderLabels } from "@/lib/contracts/students"
import { pipelineStages, type PipelineCard, type PipelineResponse, type PipelineStageKey } from "@/lib/contracts/crm"
import { columnLabels, formatDate, pinnedColumnClass, pinnedColumnStyle, type ColumnKey } from "./pipeline-shared"

type PipelineDatabaseTableProps = {
  pipeline: PipelineResponse
  isLoading: boolean
  tableColumnOrder: ColumnKey[]
  visibleColumnOrder: ColumnKey[]
  pinnedColumns: Set<ColumnKey>
  pinnedColumnOffsets: Map<ColumnKey, number>
  savingCardId: string | null
  copiedStudentCode: string | null
  page: number
  limit: number
  totalPages: number
  setPage: (value: number | ((current: number) => number)) => void
  setLimit: (value: number) => void
  setCopiedStudentCode: (value: string | null | ((current: string | null) => string | null)) => void
  setError: (value: string | null) => void
  openStudentDialog: (studentId: string) => void
  moveCard: (card: PipelineCard, nextStage: PipelineStageKey) => void
}

export function PipelineDatabaseTable({
  pipeline,
  isLoading,
  tableColumnOrder,
  visibleColumnOrder,
  pinnedColumns,
  pinnedColumnOffsets,
  savingCardId,
  copiedStudentCode,
  page,
  limit,
  totalPages,
  setPage,
  setLimit,
  setCopiedStudentCode,
  setError,
  openStudentDialog,
  moveCard
}: PipelineDatabaseTableProps) {
  async function copyStudentCode(event: MouseEvent<HTMLButtonElement>, code: string) {
    event.stopPropagation()

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code)
      } else {
        const textArea = document.createElement("textarea")
        textArea.value = code
        textArea.style.position = "fixed"
        textArea.style.opacity = "0"
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand("copy")
        document.body.removeChild(textArea)
      }

      setCopiedStudentCode(code)
      window.setTimeout(() => {
        setCopiedStudentCode((current) => (current === code ? null : current))
      }, 1200)
    } catch {
      setError("Không copy được mã học viên.")
    }
  }

  function renderCell(card: PipelineCard, column: ColumnKey) {
    if (column === "code") {
      const isCopied = copiedStudentCode === card.code

      return (
        <button
          type="button"
          className={`-mx-1 inline-flex max-w-full rounded-full px-1.5 py-1 text-left text-xs font-semibold transition ${isCopied ? "bg-brand-red text-white" : "text-brand-red hover:bg-brand-red/10"}`}
          title={isCopied ? "Đã copy mã học viên" : "Copy mã học viên"}
          aria-label={`Copy mã học viên ${card.code}`}
          onClick={(event) => void copyStudentCode(event, card.code)}
        >
          <span className="truncate">{card.code}</span>
        </button>
      )
    }

    if (column === "stage") {
      return (
        <select
          className="w-full min-w-32 rounded-xl border border-brand-red/10 bg-white/60 px-3 py-2 text-xs font-semibold text-brand-ink outline-none"
          value={card.stage}
          disabled={savingCardId === card.id}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => moveCard(card, event.target.value as PipelineStageKey)}
        >
          {pipelineStages.map((stage) => (
            <option key={stage.key} value={stage.key}>
              {stage.title}
            </option>
          ))}
        </select>
      )
    }

    if (column === "gender") return genderLabels[card.gender]
    if (column === "classNames") return card.classNames.length ? card.classNames.join(", ") : "Chưa xếp lớp"
    if (column === "classProgress") return card.classProgress.length ? card.classProgress.map((progress) => progress.label).join(", ") : "Chưa có lịch"
    if (column === "createdAt" || column === "stageChangedAt") return formatDate(card[column])
    if (column === "daysInStage") return card.isStale ? `${card.daysInStage} ngày · quá hạn` : `${card.daysInStage} ngày`

    return card[column] || "-"
  }

  return (
    <section className="neu-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl">
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[1320px] border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-[#f5eeeb] text-xs uppercase tracking-wide text-stone-500">
            <tr>
              {tableColumnOrder.map((column) => (
                <th key={column} className={`border-b border-brand-red/10 px-4 py-3 font-semibold ${pinnedColumnClass(column, pinnedColumns, "head")}`} style={pinnedColumnStyle(column, pinnedColumns, pinnedColumnOffsets)}>
                  {columnLabels[column]}
                </th>
              ))}
              <th className="border-b border-brand-red/10 px-4 py-3 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td className="px-4 py-8 text-stone-500" colSpan={visibleColumnOrder.length + 1}>
                  Đang tải pipeline...
                </td>
              </tr>
            ) : pipeline.items.length ? (
              pipeline.items.map((card) => (
                <tr key={card.id} className="cursor-pointer border-b border-brand-red/10 transition-shadow hover:shadow-[0_8px_20px_rgba(165,36,39,0.08)]" onClick={() => void openStudentDialog(card.id)}>
                  {tableColumnOrder.map((column) => (
                    <td key={column} className={`max-w-64 truncate px-4 py-3 align-middle ${pinnedColumnClass(column, pinnedColumns, "body")} ${card.isStale && column === "daysInStage" ? "font-semibold text-brand-red" : "text-brand-ink"}`} style={pinnedColumnStyle(column, pinnedColumns, pinnedColumnOffsets)}>
                      {renderCell(card, column)}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    {card.stage !== "NURTURE" ? (
                      <button className="glass-button-secondary inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold" disabled={savingCardId === card.id} onClick={(event) => { event.stopPropagation(); void moveCard(card, "NURTURE") }}>
                        <Archive className="h-3.5 w-3.5" />
                        Nurture
                      </button>
                    ) : (
                      <button className="glass-button-secondary inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold" disabled={savingCardId === card.id} onClick={(event) => { event.stopPropagation(); void moveCard(card, "LEAD") }}>
                        Đưa về Lead
                      </button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-8 text-stone-500" colSpan={visibleColumnOrder.length + 1}>
                  Không có lead phù hợp bộ lọc.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-brand-red/10 px-3 py-2 text-sm">
        <div className="flex items-center gap-2 text-stone-600">
          <span>
            Trang {pipeline.page}/{totalPages}
          </span>
          <select className="rounded-full border border-brand-red/10 bg-white/50 px-3 py-1.5 text-sm outline-none" value={limit} onChange={(event) => { setLimit(Number(event.target.value)); setPage(1) }}>
            <option value={25}>25 dòng</option>
            <option value={50}>50 dòng</option>
            <option value={100}>100 dòng</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button className="glass-button-secondary px-3 py-1.5 text-xs font-semibold" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Trước</button>
          <button className="glass-button-secondary px-3 py-1.5 text-xs font-semibold" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Sau</button>
        </div>
      </div>
    </section>
  )
}
