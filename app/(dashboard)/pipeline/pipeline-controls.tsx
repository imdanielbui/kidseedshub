import { ArrowDownAZ, Eye, GripVertical, LayoutGrid, ListFilter, Pin, Plus, Rows3, Search, SlidersHorizontal, X } from "lucide-react"
import { LeadFormPanel, type LeadFormState } from "@/components/shared/lead-form-panel"
import { pipelineStages, type PipelineOptions, type PipelineResponse } from "@/lib/contracts/crm"
import {
  columnLabels,
  type ColumnKey,
  type PanelMode,
  type SortDirection,
  type SortKey,
  type StageFilter,
  type ViewMode
} from "./pipeline-shared"

type PipelineControlsProps = {
  pipeline: PipelineResponse
  options: PipelineOptions
  viewMode: ViewMode
  panelMode: PanelMode
  search: string
  stageFilter: StageFilter
  saleFilter: string
  classFilter: string
  createdFrom: string
  createdTo: string
  sortKey: SortKey
  sortDirection: SortDirection
  visibleStageChips: Array<(typeof pipelineStages)[number]>
  form: LeadFormState
  isCreating: boolean
  columnOrder: ColumnKey[]
  visibleColumns: Set<ColumnKey>
  pinnedColumns: Set<ColumnKey>
  setViewMode: (mode: ViewMode) => void
  setPanelMode: (mode: PanelMode) => void
  setSearch: (value: string) => void
  setPage: (value: number | ((current: number) => number)) => void
  setStage: (stage: StageFilter) => void
  setSaleFilter: (value: string) => void
  setClassFilter: (value: string) => void
  setCreatedFrom: (value: string) => void
  setCreatedTo: (value: string) => void
  setSortKey: (value: SortKey) => void
  setSortDirection: (updater: (current: SortDirection) => SortDirection) => void
  setForm: (value: LeadFormState | ((current: LeadFormState) => LeadFormState)) => void
  createLead: (event: React.FormEvent<HTMLFormElement>) => void
  clearFilters: () => void
  setDraggingColumn: (column: ColumnKey) => void
  moveColumn: (column: ColumnKey) => void
  toggleColumn: (column: ColumnKey) => void
  togglePinnedColumn: (column: ColumnKey) => void
}

export function PipelineControls({
  pipeline,
  options,
  viewMode,
  panelMode,
  search,
  stageFilter,
  saleFilter,
  classFilter,
  createdFrom,
  createdTo,
  sortKey,
  sortDirection,
  visibleStageChips,
  form,
  isCreating,
  columnOrder,
  visibleColumns,
  pinnedColumns,
  setViewMode,
  setPanelMode,
  setSearch,
  setPage,
  setStage,
  setSaleFilter,
  setClassFilter,
  setCreatedFrom,
  setCreatedTo,
  setSortKey,
  setSortDirection,
  setForm,
  createLead,
  clearFilters,
  setDraggingColumn,
  moveColumn,
  toggleColumn,
  togglePinnedColumn
}: PipelineControlsProps) {
  return (
    <>
      <section className="neu-card shrink-0 rounded-3xl p-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex min-w-56 flex-1 items-center gap-2 rounded-full border border-brand-red/10 bg-white/50 px-4 py-2 text-sm text-stone-600 xl:max-w-md">
            <Search className="h-4 w-4" />
            <input
              className="w-full bg-transparent outline-none"
              placeholder="Tìm mã HS, phụ huynh, SĐT, địa chỉ..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
            />
          </label>
          <button className={`glass-button-secondary inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold ${viewMode === "database" ? "text-brand-red" : ""}`} onClick={() => setViewMode("database")}>
            <Rows3 className="h-4 w-4" />
            Database
          </button>
          <button className={`glass-button-secondary inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold ${viewMode === "kanban" ? "text-brand-red" : ""}`} onClick={() => setViewMode("kanban")}>
            <LayoutGrid className="h-4 w-4" />
            Kanban
          </button>
          <button className="glass-button-primary inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold" onClick={() => setPanelMode("lead")}>
            <Plus className="h-4 w-4" />
            Lead mới
          </button>
          <button className="glass-button-secondary inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold" onClick={() => setPanelMode("filters")}>
            <ListFilter className="h-4 w-4" />
            Bộ lọc
          </button>
          <button className="glass-button-secondary inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold" onClick={() => setPanelMode("fields")}>
            <SlidersHorizontal className="h-4 w-4" />
            Trường
          </button>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-stone-600">
          <span className="rounded-full border border-brand-red/10 bg-white/40 px-3 py-1 font-semibold text-brand-red">{pipeline.total} lead</span>
          {visibleStageChips.map((stage) => (
            <button
              key={stage.key}
              className={`rounded-full border px-3 py-1 font-semibold ${
                stageFilter === stage.key ? "border-brand-red bg-brand-red text-white" : "border-brand-red/10 bg-white/40 text-stone-600"
              }`}
              onClick={() => setStage(stage.key)}
            >
              {stage.title} {pipeline.stageCounts[stage.key] ?? 0}
              {pipeline.staleCounts[stage.key] ? ` · ${pipeline.staleCounts[stage.key]} quá hạn` : ""}
            </button>
          ))}
          {stageFilter !== "ALL" ? (
            <button className="rounded-full border border-brand-red/10 bg-white/40 px-3 py-1 font-semibold text-stone-600" onClick={() => setStage("ALL")}>
              Xóa lọc trạng thái
            </button>
          ) : null}
        </div>
      </section>

      {panelMode ? (
        <section className="neu-card shrink-0 rounded-3xl p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-brand-ink">
              {panelMode === "lead" ? "Tạo lead mới" : panelMode === "filters" ? "Bộ lọc pipeline" : "Ẩn/hiện và sắp xếp trường"}
            </h2>
            <button className="glass-button-secondary inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold" onClick={() => setPanelMode(null)}>
              <X className="h-4 w-4" />
              Đóng
            </button>
          </div>

          {panelMode === "lead" ? (
            <LeadFormPanel value={form} onChange={setForm} options={options} isSubmitting={isCreating} onSubmit={createLead} />
          ) : null}

          {panelMode === "filters" ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
              <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500">
                Trạng thái
                <select className="mt-2 w-full rounded-2xl border border-brand-red/10 bg-white px-3 py-2 text-sm normal-case tracking-normal text-brand-ink outline-none" value={stageFilter} onChange={(event) => setStage(event.target.value as StageFilter)}>
                  <option value="ALL">Tất cả trạng thái</option>
                  {pipelineStages.map((stage) => (
                    <option key={stage.key} value={stage.key}>
                      {stage.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500">
                Sale
                <select className="mt-2 w-full rounded-2xl border border-brand-red/10 bg-white px-3 py-2 text-sm normal-case tracking-normal text-brand-ink outline-none" value={saleFilter} onChange={(event) => { setSaleFilter(event.target.value); setPage(1) }}>
                  <option value="ALL">Tất cả sale</option>
                  {options.sales.map((sale) => (
                    <option key={sale.id} value={sale.id}>
                      {sale.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500">
                Lớp
                <select className="mt-2 w-full rounded-2xl border border-brand-red/10 bg-white px-3 py-2 text-sm normal-case tracking-normal text-brand-ink outline-none" value={classFilter} onChange={(event) => { setClassFilter(event.target.value); setPage(1) }}>
                  <option value="ALL">Tất cả lớp</option>
                  {options.classes.map((klass) => (
                    <option key={klass.id} value={klass.id}>
                      {klass.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500">
                Tạo từ ngày
                <input className="mt-2 w-full rounded-2xl border border-brand-red/10 bg-white px-3 py-2 text-sm normal-case tracking-normal text-brand-ink outline-none" type="date" value={createdFrom} onChange={(event) => { setCreatedFrom(event.target.value); setPage(1) }} />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500">
                Đến ngày
                <input className="mt-2 w-full rounded-2xl border border-brand-red/10 bg-white px-3 py-2 text-sm normal-case tracking-normal text-brand-ink outline-none" type="date" value={createdTo} onChange={(event) => { setCreatedTo(event.target.value); setPage(1) }} />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500">
                Sắp xếp
                <select className="mt-2 w-full rounded-2xl border border-brand-red/10 bg-white px-3 py-2 text-sm normal-case tracking-normal text-brand-ink outline-none" value={sortKey} onChange={(event) => { setSortKey(event.target.value as SortKey); setPage(1) }}>
                  <option value="updatedAt">Cập nhật</option>
                  <option value="createdAt">Ngày tạo</option>
                  <option value="stageChangedAt">Đổi bước</option>
                  <option value="daysInStage">Ngày ở bước</option>
                  <option value="code">Mã HS</option>
                  <option value="parentName">Phụ huynh</option>
                  <option value="studentName">Học viên</option>
                </select>
              </label>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-1">
                <button className="glass-button-secondary inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold" onClick={() => { setSortDirection((current) => (current === "asc" ? "desc" : "asc")); setPage(1) }}>
                  <ArrowDownAZ className={`h-4 w-4 ${sortDirection === "desc" ? "rotate-180" : ""}`} />
                  {sortDirection === "asc" ? "Tăng dần" : "Giảm dần"}
                </button>
                <button className="glass-button-secondary px-4 py-2 text-sm font-semibold" onClick={clearFilters}>
                  Xóa lọc
                </button>
              </div>
            </div>
          ) : null}

          {panelMode === "fields" ? (
            <div className="flex flex-wrap gap-2">
              {columnOrder.map((column) => (
                <div
                  key={column}
                  draggable
                  onDragStart={() => setDraggingColumn(column)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => moveColumn(column)}
                  className={`inline-flex items-center gap-1 rounded-full border p-1 text-xs font-semibold ${
                    visibleColumns.has(column) ? "border-brand-red/20 bg-white text-brand-ink" : "border-stone-200 bg-white/35 text-stone-400"
                  }`}
                >
                  <button type="button" className="inline-flex items-center gap-2 rounded-full px-2 py-1.5" onClick={() => toggleColumn(column)}>
                    <GripVertical className="h-3.5 w-3.5" />
                    <Eye className="h-3.5 w-3.5" />
                    {columnLabels[column]}
                  </button>
                  <button
                    type="button"
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-full border ${
                      pinnedColumns.has(column) ? "border-brand-red bg-brand-red text-white" : "border-brand-red/10 bg-white/60 text-stone-500"
                    }`}
                    aria-label={`Ghim ${columnLabels[column]}`}
                    title={`Ghim ${columnLabels[column]}`}
                    onClick={() => togglePinnedColumn(column)}
                  >
                    <Pin className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </>
  )
}
