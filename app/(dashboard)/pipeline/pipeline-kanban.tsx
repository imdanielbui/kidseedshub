import { type PipelineCard, pipelineStages, type PipelineResponse, type PipelineStageKey } from "@/lib/contracts/crm"

type PipelineKanbanBoardProps = {
  pipeline: PipelineResponse
  visibleKanbanStages: Array<(typeof pipelineStages)[number]>
  cardsByStage: Record<PipelineStageKey, PipelineCard[]>
  savingCardId: string | null
  draggingCardId: string | null
  dropStage: PipelineStageKey | null
  setDraggingCardId: (cardId: string | null) => void
  setDropStage: (stage: PipelineStageKey | null) => void
  openStudentDialog: (studentId: string) => void
  dropCardOnStage: (stage: PipelineStageKey) => void
  showStageInTable: (stage: PipelineStageKey) => void
}

export function PipelineKanbanBoard({
  pipeline,
  visibleKanbanStages,
  cardsByStage,
  savingCardId,
  draggingCardId,
  dropStage,
  setDraggingCardId,
  setDropStage,
  openStudentDialog,
  dropCardOnStage,
  showStageInTable
}: PipelineKanbanBoardProps) {
  return (
    <section className="flex min-h-0 flex-1 w-full items-start gap-3 overflow-x-auto pb-2">
      {visibleKanbanStages.length ? visibleKanbanStages.map((stage) => {
        const stageCards = cardsByStage[stage.key]
        const shouldFillStage = stageCards.length >= 4 || (pipeline.stageCounts[stage.key] ?? 0) > stageCards.length

        return (
          <div
            key={stage.key}
            className={`neu-card min-w-[260px] flex-1 rounded-3xl transition-colors ${shouldFillStage ? "flex max-h-full min-h-0 self-stretch flex-col" : "self-start"} ${dropStage === stage.key ? "bg-white/45" : ""}`}
            onDragOver={(event) => {
              event.preventDefault()
              setDropStage(stage.key)
            }}
            onDragLeave={() => setDropStage(null)}
            onDrop={(event) => {
              event.preventDefault()
              dropCardOnStage(stage.key)
            }}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 p-4">
              <div>
                <h2 className="font-semibold text-brand-ink">{stage.title}</h2>
                <p className="mt-1 text-xs text-stone-500">{stage.hint}</p>
              </div>
              <span className="rounded-full border border-brand-red/15 px-2 py-1 text-xs font-semibold text-brand-red">{pipeline.stageCounts[stage.key] ?? 0}</span>
            </div>
            <div className={`content-border space-y-3 overflow-auto p-3 ${shouldFillStage ? "min-h-0 flex-1" : "max-h-[52vh]"}`}>
              {stageCards.length ? (
                stageCards.map((card) => (
                  <article
                    key={card.id}
                    draggable={savingCardId !== card.id}
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/plain", card.id)
                      setDraggingCardId(card.id)
                    }}
                    onDragEnd={() => {
                      setDraggingCardId(null)
                      setDropStage(null)
                    }}
                    onClick={() => void openStudentDialog(card.id)}
                    className={`neu-list-item min-h-0 cursor-grab rounded-2xl p-3 active:cursor-grabbing ${draggingCardId === card.id ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <p className="text-xs font-semibold text-brand-red">{card.code}</p>
                        <p className="break-words text-sm font-semibold leading-snug text-brand-ink">{card.studentName}</p>
                        <p className="break-words text-xs leading-snug text-stone-600">PH: {card.parentName}</p>
                      </div>
                      <span className={`shrink-0 text-xs font-semibold ${card.isStale ? "text-brand-red" : "text-stone-500"}`}>{card.daysInStage}d</span>
                    </div>
                    <div className="mt-3 grid gap-1.5 text-xs leading-snug text-stone-600">
                      <p className="break-words">
                        <span className="font-semibold text-stone-500">SĐT:</span> {card.phone}
                      </p>
                      {card.address ? (
                        <p className="break-words">
                          <span className="font-semibold text-stone-500">Địa chỉ:</span> {card.address}
                        </p>
                      ) : null}
                      {card.leadSource || card.saleOwnerName ? (
                        <div className="flex flex-wrap gap-1">
                          {card.leadSource ? <span className="rounded-full border border-brand-red/10 bg-white/45 px-2 py-1 text-[11px] font-semibold text-stone-600">{card.leadSource}</span> : null}
                          {card.saleOwnerName ? <span className="rounded-full border border-brand-red/10 bg-white/45 px-2 py-1 text-[11px] font-semibold text-stone-600">{card.saleOwnerName}</span> : null}
                        </div>
                      ) : null}
                    </div>
                    {card.classProgress.length ? (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {card.classProgress.slice(0, 2).map((progress) => (
                          <span key={progress.classId} className="rounded-full border border-brand-red/15 bg-white/45 px-2 py-1 text-[11px] font-semibold text-brand-red">
                            {progress.label}
                          </span>
                        ))}
                        {card.classProgress.length > 2 ? <span className="rounded-full border border-brand-red/15 bg-white/45 px-2 py-1 text-[11px] font-semibold text-stone-500">+{card.classProgress.length - 2}</span> : null}
                      </div>
                    ) : null}
                  </article>
                ))
              ) : (
                <p className="rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500">Chưa có lead ở giai đoạn này.</p>
              )}
              {(pipeline.stageCounts[stage.key] ?? 0) > 20 ? (
                <button className="glass-button-secondary w-full px-4 py-2 text-xs font-semibold" onClick={() => showStageInTable(stage.key)}>
                  Xem tất cả trong bảng
                </button>
              ) : null}
            </div>
          </div>
        )
      }) : (
        <div className="neu-card w-full rounded-3xl p-6 text-sm text-stone-500">Không có trạng thái phù hợp bộ lọc hiện tại.</div>
      )}
    </section>
  )
}
