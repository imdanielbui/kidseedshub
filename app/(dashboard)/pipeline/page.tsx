"use client"

import { CheckSquare, Clock, MessageSquarePlus, Save, UserRound } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import type { ApiResponse } from "@/lib/api-response"
import { DialogShell } from "@/components/shared/dialog-shell"
import { emptyLeadForm, type LeadFormState } from "@/components/shared/lead-form-panel"
import {
  contactResultLabels,
  pipelineStages,
  taskStatusLabels,
  type ContactResultKey,
  type PipelineCard,
  type PipelineOptions,
  type PipelineResponse,
  type PipelineStageKey
} from "@/lib/contracts/crm"
import { genderLabels, studentStatusLabels, type StudentDetail, type StudentGenderKey } from "@/lib/contracts/students"
import { PipelineControls } from "./pipeline-controls"
import { PipelineKanbanBoard } from "./pipeline-kanban"
import {
  createEmptyTaskForm,
  defaultColumnOrder,
  defaultPinnedColumns,
  emptyContactForm,
  emptyPipeline,
  emptyStudentEditForm,
  formatDateTime,
  nullableTrim,
  pinnedColumnWidths,
  toIsoFromLocalInput,
  toStudentEditForm,
  type ColumnKey,
  type ContactForm,
  type PanelMode,
  type SortDirection,
  type SortKey,
  type StageFilter,
  type StudentEditForm,
  type TaskForm,
  type ViewMode
} from "./pipeline-shared"
import { PipelineDatabaseTable } from "./pipeline-table"

export default function PipelinePage() {
  const [pipeline, setPipeline] = useState<PipelineResponse>(emptyPipeline)
  const [options, setOptions] = useState<PipelineOptions>({ sales: [], classes: [] })
  const [viewMode, setViewMode] = useState<ViewMode>("database")
  const [panelMode, setPanelMode] = useState<PanelMode>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [savingCardId, setSavingCardId] = useState<string | null>(null)
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null)
  const [dropStage, setDropStage] = useState<PipelineStageKey | null>(null)
  const [draggingColumn, setDraggingColumn] = useState<ColumnKey | null>(null)
  const [columnOrder, setColumnOrder] = useState<ColumnKey[]>(defaultColumnOrder)
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(new Set(defaultColumnOrder))
  const [pinnedColumns, setPinnedColumns] = useState<Set<ColumnKey>>(new Set(defaultPinnedColumns))
  const [search, setSearch] = useState("")
  const [stageFilter, setStageFilter] = useState<StageFilter>("ALL")
  const [saleFilter, setSaleFilter] = useState("ALL")
  const [classFilter, setClassFilter] = useState("ALL")
  const [createdFrom, setCreatedFrom] = useState("")
  const [createdTo, setCreatedTo] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [form, setForm] = useState<LeadFormState>(emptyLeadForm)
  const [selectedStudent, setSelectedStudent] = useState<StudentDetail | null>(null)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [studentEditForm, setStudentEditForm] = useState<StudentEditForm>(emptyStudentEditForm)
  const [isSavingStudent, setIsSavingStudent] = useState(false)
  const [contactForm, setContactForm] = useState<ContactForm>(emptyContactForm)
  const [taskForm, setTaskForm] = useState<TaskForm>(() => createEmptyTaskForm())
  const [isSavingActivity, setIsSavingActivity] = useState(false)
  const [copiedStudentCode, setCopiedStudentCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const includeNurture = stageFilter === "NURTURE"
  const visibleColumnOrder = columnOrder.filter((column) => visibleColumns.has(column))
  const tableColumnOrder = useMemo(() => {
    const pinned = visibleColumnOrder.filter((column) => pinnedColumns.has(column))
    const unpinned = visibleColumnOrder.filter((column) => !pinnedColumns.has(column))
    return [...pinned, ...unpinned]
  }, [pinnedColumns, visibleColumnOrder])
  const totalPages = Math.max(1, Math.ceil(pipeline.total / pipeline.limit))
  const hasActiveFilter = search.trim() !== "" || stageFilter !== "ALL" || saleFilter !== "ALL" || classFilter !== "ALL" || createdFrom !== "" || createdTo !== ""
  const pinnedColumnOffsets = useMemo(() => {
    let offset = 0
    const offsets = new Map<ColumnKey, number>()

    tableColumnOrder.forEach((column) => {
      if (!pinnedColumns.has(column)) return
      offsets.set(column, offset)
      offset += pinnedColumnWidths[column] ?? 180
    })

    return offsets
  }, [pinnedColumns, tableColumnOrder])

  async function loadPipeline() {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sort: sortKey,
        direction: sortDirection,
        includeNurture: String(includeNurture)
      })

      if (search.trim()) params.set("q", search.trim())
      if (stageFilter !== "ALL") params.set("stage", stageFilter)
      if (saleFilter !== "ALL") params.set("saleOwnerId", saleFilter)
      if (classFilter !== "ALL") params.set("classId", classFilter)
      if (createdFrom) params.set("createdFrom", createdFrom)
      if (createdTo) params.set("createdTo", createdTo)

      const [pipelineResponse, optionsResponse] = await Promise.all([
        fetch(`/api/pipeline?${params.toString()}`, { cache: "no-store" }),
        fetch("/api/pipeline/options", { cache: "no-store" })
      ])
      const pipelinePayload = (await pipelineResponse.json()) as ApiResponse<PipelineResponse>
      const optionsPayload = (await optionsResponse.json()) as ApiResponse<PipelineOptions>

      if (!pipelineResponse.ok || !pipelinePayload.success || !pipelinePayload.data) {
        setError(pipelinePayload.error?.message ?? "Không tải được pipeline.")
        return
      }

      if (!optionsResponse.ok || !optionsPayload.success || !optionsPayload.data) {
        setError(optionsPayload.error?.message ?? "Không tải được tuỳ chọn pipeline.")
        return
      }

      setPipeline(pipelinePayload.data)
      setOptions(optionsPayload.data)
    } catch {
      setError("Không tải được pipeline.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadPipeline()
    }, 120)

    return () => window.clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, search, stageFilter, saleFilter, classFilter, createdFrom, createdTo, sortKey, sortDirection])

  const cardsByStage = useMemo(
    () =>
      pipelineStages.reduce<Record<PipelineStageKey, PipelineCard[]>>(
        (grouped, stage) => {
          grouped[stage.key] = pipeline.items.filter((card) => card.stage === stage.key).slice(0, 20)
          return grouped
        },
        { LEAD: [], TRIAL: [], EVALUATION: [], CONVERTED: [], RETENTION: [], NURTURE: [] }
      ),
    [pipeline.items]
  )
  const visibleKanbanStages = useMemo(() => {
    if (stageFilter !== "ALL") return pipelineStages.filter((stage) => stage.key === stageFilter)

    return pipelineStages.filter((stage) => {
      if (stage.key === "NURTURE" && !includeNurture) return false
      if (hasActiveFilter) return cardsByStage[stage.key].length > 0
      return (pipeline.stageCounts[stage.key] ?? 0) > 0
    })
  }, [cardsByStage, hasActiveFilter, includeNurture, pipeline.stageCounts, stageFilter])
  const visibleStageChips = useMemo(
    () =>
      pipelineStages.filter((stage) => {
        if (stage.key === "NURTURE" && !includeNurture) return false
        if (stageFilter === stage.key) return true
        return (pipeline.stageCounts[stage.key] ?? 0) > 0
      }),
    [includeNurture, pipeline.stageCounts, stageFilter]
  )
  const selectedPipelineCard = selectedStudent ? pipeline.items.find((card) => card.id === selectedStudent.id) : undefined
  const selectedContactLogs = selectedStudent?.contactLogs.slice(0, 3) ?? []
  const selectedTasks = selectedStudent?.tasks.slice(0, 3) ?? []

  function getPipelineSaleOwnerId(studentId: string) {
    return pipeline.items.find((card) => card.id === studentId)?.saleOwnerId ?? ""
  }

  function closeStudentDialog() {
    setSelectedStudent(null)
    setIsDetailLoading(false)
    setStudentEditForm(emptyStudentEditForm)
  }

  async function openStudentDialog(studentId: string) {
    setIsDetailLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/students/${studentId}`, { cache: "no-store" })
      const payload = (await response.json()) as ApiResponse<StudentDetail>

      if (!response.ok || !payload.success || !payload.data) {
        setError(payload.error?.message ?? "Không tải được hồ sơ lead.")
        return
      }

      setSelectedStudent(payload.data)
      setStudentEditForm(toStudentEditForm(payload.data, getPipelineSaleOwnerId(studentId)))
      setContactForm(emptyContactForm)
      setTaskForm(createEmptyTaskForm())
    } catch {
      setError("Không tải được hồ sơ lead.")
    } finally {
      setIsDetailLoading(false)
    }
  }

  async function refreshSelectedStudent() {
    if (!selectedStudent) return

    const response = await fetch(`/api/students/${selectedStudent.id}`, { cache: "no-store" })
    const payload = (await response.json()) as ApiResponse<StudentDetail>
    if (response.ok && payload.success && payload.data) {
      setSelectedStudent(payload.data)
      setStudentEditForm(toStudentEditForm(payload.data, getPipelineSaleOwnerId(payload.data.id)))
    }
  }

  async function saveSelectedStudent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedStudent) return

    if (!studentEditForm.studentName.trim() || !studentEditForm.parentName.trim() || !studentEditForm.parentPhone.trim()) {
      setError("Cần nhập tên học viên, tên phụ huynh và số điện thoại phụ huynh.")
      return
    }

    setIsSavingStudent(true)
    setError(null)

    try {
      const response = await fetch(`/api/students/${selectedStudent.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: studentEditForm.studentName.trim(),
          address: nullableTrim(studentEditForm.address),
          gender: studentEditForm.gender,
          leadSource: nullableTrim(studentEditForm.leadSource),
          leadNote: nullableTrim(studentEditForm.leadNote),
          healthNote: nullableTrim(studentEditForm.healthNote),
          saleOwnerId: studentEditForm.saleOwnerId || null,
          parent: {
            name: studentEditForm.parentName.trim(),
            phone: studentEditForm.parentPhone.trim(),
            email: nullableTrim(studentEditForm.parentEmail)
          }
        })
      })
      const payload = (await response.json()) as ApiResponse<StudentDetail>

      if (!response.ok || !payload.success || !payload.data) {
        setError(payload.error?.message ?? "Không cập nhật được thông tin học viên.")
        return
      }

      setSelectedStudent(payload.data)
      setStudentEditForm(toStudentEditForm(payload.data, studentEditForm.saleOwnerId))
      await loadPipeline()
    } catch {
      setError("Không cập nhật được thông tin học viên.")
    } finally {
      setIsSavingStudent(false)
    }
  }

  async function moveCard(card: PipelineCard, nextStage: PipelineStageKey) {
    if (card.stage === nextStage) return

    setSavingCardId(card.id)
    setError(null)

    try {
      const response = await fetch(`/api/students/${card.id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStage })
      })
      const payload = (await response.json()) as ApiResponse<unknown>

      if (!response.ok || !payload.success) {
        setError(payload.error?.message ?? "Không cập nhật được pipeline.")
        return
      }

      await loadPipeline()
      if (selectedStudent?.id === card.id) await refreshSelectedStudent()
    } catch {
      setError("Không cập nhật được pipeline.")
    } finally {
      setSavingCardId(null)
    }
  }

  async function createContactLog() {
    if (!selectedStudent || !contactForm.content.trim()) return

    setIsSavingActivity(true)
    setError(null)

    try {
      const response = await fetch(`/api/students/${selectedStudent.id}/contact-logs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          result: contactForm.result,
          content: contactForm.content.trim()
        })
      })
      const payload = (await response.json()) as ApiResponse<unknown>

      if (!response.ok || !payload.success) {
        setError(payload.error?.message ?? "Không ghi được lịch sử liên hệ.")
        return
      }

      setContactForm(emptyContactForm)
      await refreshSelectedStudent()
    } catch {
      setError("Không ghi được lịch sử liên hệ.")
    } finally {
      setIsSavingActivity(false)
    }
  }

  async function createTask() {
    if (!selectedStudent) return

    const dueDate = toIsoFromLocalInput(taskForm.dueDate)

    if (!taskForm.title.trim()) {
      setError("Cần nhập tiêu đề task.")
      return
    }

    if (!dueDate) {
      setError("Cần chọn ngày hạn task.")
      return
    }

    setIsSavingActivity(true)
    setError(null)

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: taskForm.title.trim(),
          note: taskForm.note.trim() || undefined,
          dueDate,
          studentId: selectedStudent.id
        })
      })
      const payload = (await response.json()) as ApiResponse<unknown>

      if (!response.ok || !payload.success) {
        setError(payload.error?.message ?? "Không tạo được task tiếp theo.")
        return
      }

      setTaskForm(createEmptyTaskForm())
      await refreshSelectedStudent()
    } catch {
      setError("Không tạo được task tiếp theo.")
    } finally {
      setIsSavingActivity(false)
    }
  }

  async function createLead(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!form.parentName.trim() || !form.parentPhone.trim() || !form.studentName.trim()) {
      setError("Cần nhập tên phụ huynh, số điện thoại và tên học viên.")
      return
    }

    setIsCreating(true)
    setError(null)

    try {
      const response = await fetch("/api/students", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.studentName.trim(),
          address: form.address.trim() || undefined,
          birthDate: form.birthDate ? new Date(`${form.birthDate}T00:00:00`).toISOString() : undefined,
          status: "LEAD",
          gender: form.gender,
          leadSource: form.leadSource.trim() || undefined,
          leadNote: form.leadNote.trim() || undefined,
          healthNote: form.healthNote.trim() || undefined,
          saleOwnerId: form.saleOwnerId || undefined,
          classId: form.classId || undefined,
          parent: {
            name: form.parentName.trim(),
            phone: form.parentPhone.trim(),
            email: form.parentEmail.trim() || undefined
          }
        })
      })
      const payload = (await response.json()) as ApiResponse<unknown>

      if (!response.ok || !payload.success) {
        setError(payload.error?.message ?? "Không tạo được lead.")
        return
      }

      setForm(emptyLeadForm)
      setPanelMode(null)
      setPage(1)
      await loadPipeline()
    } catch {
      setError("Không tạo được lead.")
    } finally {
      setIsCreating(false)
    }
  }

  function setStage(nextStage: StageFilter) {
    setStageFilter(nextStage)
    setPage(1)
  }

  function clearFilters() {
    setSearch("")
    setStageFilter("ALL")
    setSaleFilter("ALL")
    setClassFilter("ALL")
    setCreatedFrom("")
    setCreatedTo("")
    setPage(1)
  }

  function dropCardOnStage(stage: PipelineStageKey) {
    if (!draggingCardId) return

    const card = pipeline.items.find((item) => item.id === draggingCardId)
    setDraggingCardId(null)
    setDropStage(null)

    if (card) void moveCard(card, stage)
  }

  function moveColumn(targetColumn: ColumnKey) {
    if (!draggingColumn || draggingColumn === targetColumn) return

    setColumnOrder((current) => {
      const next = current.filter((column) => column !== draggingColumn)
      next.splice(next.indexOf(targetColumn), 0, draggingColumn)
      return next
    })
    setDraggingColumn(null)
  }

  function toggleColumn(column: ColumnKey) {
    setVisibleColumns((current) => {
      const next = new Set(current)
      if (next.has(column)) next.delete(column)
      else next.add(column)
      return next
    })
  }

  function togglePinnedColumn(column: ColumnKey) {
    setPinnedColumns((current) => {
      const next = new Set(current)
      if (next.has(column)) next.delete(column)
      else next.add(column)
      return next
    })
  }

  return (
    <main className="flex h-[calc(100vh-8.25rem)] min-h-0 flex-col gap-3 overflow-hidden md:h-[calc(100vh-2.75rem)]">
      <PipelineControls
        pipeline={pipeline}
        options={options}
        viewMode={viewMode}
        panelMode={panelMode}
        search={search}
        stageFilter={stageFilter}
        saleFilter={saleFilter}
        classFilter={classFilter}
        createdFrom={createdFrom}
        createdTo={createdTo}
        sortKey={sortKey}
        sortDirection={sortDirection}
        visibleStageChips={visibleStageChips}
        form={form}
        isCreating={isCreating}
        columnOrder={columnOrder}
        visibleColumns={visibleColumns}
        pinnedColumns={pinnedColumns}
        setViewMode={setViewMode}
        setPanelMode={setPanelMode}
        setSearch={setSearch}
        setPage={setPage}
        setStage={setStage}
        setSaleFilter={setSaleFilter}
        setClassFilter={setClassFilter}
        setCreatedFrom={setCreatedFrom}
        setCreatedTo={setCreatedTo}
        setSortKey={setSortKey}
        setSortDirection={setSortDirection}
        setForm={setForm}
        createLead={createLead}
        clearFilters={clearFilters}
        setDraggingColumn={setDraggingColumn}
        moveColumn={moveColumn}
        toggleColumn={toggleColumn}
        togglePinnedColumn={togglePinnedColumn}
      />

      {error ? <p className="shrink-0 rounded-2xl border border-brand-red/15 bg-white/50 p-3 text-sm text-brand-red">{error}</p> : null}

      {viewMode === "database" ? (
        <PipelineDatabaseTable
          pipeline={pipeline}
          isLoading={isLoading}
          tableColumnOrder={tableColumnOrder}
          visibleColumnOrder={visibleColumnOrder}
          pinnedColumns={pinnedColumns}
          pinnedColumnOffsets={pinnedColumnOffsets}
          savingCardId={savingCardId}
          copiedStudentCode={copiedStudentCode}
          page={page}
          limit={limit}
          totalPages={totalPages}
          setPage={setPage}
          setLimit={setLimit}
          setCopiedStudentCode={setCopiedStudentCode}
          setError={setError}
          openStudentDialog={openStudentDialog}
          moveCard={moveCard}
        />
      ) : (
        <PipelineKanbanBoard
          pipeline={pipeline}
          visibleKanbanStages={visibleKanbanStages}
          cardsByStage={cardsByStage}
          savingCardId={savingCardId}
          draggingCardId={draggingCardId}
          dropStage={dropStage}
          setDraggingCardId={setDraggingCardId}
          setDropStage={setDropStage}
          openStudentDialog={openStudentDialog}
          dropCardOnStage={dropCardOnStage}
          showStageInTable={(stage) => {
            setViewMode("database")
            setStage(stage)
          }}
        />
      )}
      {isDetailLoading || selectedStudent ? (
        <DialogShell
          eyebrow="Quick profile"
          title={selectedStudent ? `${selectedStudent.code} · ${selectedStudent.name}` : "Đang tải hồ sơ..."}
          onClose={closeStudentDialog}
          closeLabel="Đóng quick profile"
          size="lg"
          overlayClassName="items-start justify-center px-4 pb-4 pt-6"
          panelClassName="border border-brand-red/20 bg-white shadow-[0_32px_90px_rgba(69,38,28,0.28)] ring-1 ring-white"
          bodyClassName={selectedStudent ? "bg-[#fffaf7] p-5" : "p-8"}
        >
            {selectedStudent ? (
                <div className="space-y-4">
                  <div className="rounded-3xl border border-brand-red/15 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-brand-red px-3 py-1 text-xs font-semibold text-white">{studentStatusLabels[selectedStudent.status]}</span>
                      <span className="rounded-full border border-brand-red/15 px-3 py-1 text-xs font-semibold text-brand-red">{selectedStudent.sessionsRemaining} buổi còn lại</span>
                      <span className="rounded-full border border-brand-red/15 px-3 py-1 text-xs font-semibold text-stone-600">{selectedStudent.classes.length ? "Đã xếp lớp" : "Chưa xếp lớp"}</span>
                      {selectedPipelineCard ? (
                        <span className="rounded-full border border-brand-red/15 px-3 py-1 text-xs font-semibold text-stone-600">{selectedPipelineCard.daysInStage} ngày ở bước này</span>
                      ) : null}
                      {selectedPipelineCard?.classProgress.map((progress) => (
                        <span key={progress.classId} className="rounded-full border border-brand-red/15 px-3 py-1 text-xs font-semibold text-brand-red">
                          {progress.className} · {progress.label}
                        </span>
                      ))}
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                      <div className="rounded-2xl border border-brand-red/10 bg-[#fffaf7] p-3">
                        <p className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-stone-500"><UserRound className="h-3.5 w-3.5" />Phụ huynh</p>
                        <p className="font-semibold text-brand-ink">{selectedStudent.parentName}</p>
                        <p className="text-sm text-stone-600">{selectedStudent.parentPhone}</p>
                        <p className="text-sm text-stone-600">{selectedStudent.parentEmail || "Chưa có email"}</p>
                        <p className="text-sm text-stone-600">{selectedStudent.address || "Chưa có địa chỉ"}</p>
                      </div>
                      {selectedPipelineCard ? (
                        <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500">
                          Đổi trạng thái
                          <select
                            className="mt-2 w-full min-w-44 rounded-2xl border border-brand-red/10 bg-white px-3 py-2 text-sm font-semibold text-brand-ink outline-none"
                            value={selectedPipelineCard.stage}
                            disabled={savingCardId === selectedPipelineCard.id}
                            onChange={(event) => void moveCard(selectedPipelineCard, event.target.value as PipelineStageKey)}
                          >
                            {pipelineStages.map((stage) => (
                              <option key={stage.key} value={stage.key}>{stage.title}</option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                    </div>
                  </div>

                  <form className="rounded-3xl border border-brand-red/15 bg-white p-4 shadow-sm" onSubmit={saveSelectedStudent}>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-brand-ink"><UserRound className="h-4 w-4 text-brand-red" />Thông tin học viên</h3>
                      <button type="submit" className="glass-button-primary inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60" disabled={isSavingStudent}>
                        <Save className="h-4 w-4" />
                        {isSavingStudent ? "Đang lưu" : "Lưu thông tin"}
                      </button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500">
                        Tên học viên
                        <input className="mt-2 w-full rounded-2xl border border-brand-red/10 bg-[#fffaf7] px-3 py-2 text-sm normal-case tracking-normal text-brand-ink outline-none" value={studentEditForm.studentName} onChange={(event) => setStudentEditForm((current) => ({ ...current, studentName: event.target.value }))} required />
                      </label>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500">
                        Giới tính
                        <select className="mt-2 w-full rounded-2xl border border-brand-red/10 bg-[#fffaf7] px-3 py-2 text-sm normal-case tracking-normal text-brand-ink outline-none" value={studentEditForm.gender} onChange={(event) => setStudentEditForm((current) => ({ ...current, gender: event.target.value as StudentGenderKey }))}>
                          {Object.entries(genderLabels).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500">
                        Tên phụ huynh
                        <input className="mt-2 w-full rounded-2xl border border-brand-red/10 bg-[#fffaf7] px-3 py-2 text-sm normal-case tracking-normal text-brand-ink outline-none" value={studentEditForm.parentName} onChange={(event) => setStudentEditForm((current) => ({ ...current, parentName: event.target.value }))} required />
                      </label>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500">
                        SĐT phụ huynh
                        <input className="mt-2 w-full rounded-2xl border border-brand-red/10 bg-[#fffaf7] px-3 py-2 text-sm normal-case tracking-normal text-brand-ink outline-none" value={studentEditForm.parentPhone} onChange={(event) => setStudentEditForm((current) => ({ ...current, parentPhone: event.target.value }))} required />
                      </label>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500">
                        Email phụ huynh
                        <input className="mt-2 w-full rounded-2xl border border-brand-red/10 bg-[#fffaf7] px-3 py-2 text-sm normal-case tracking-normal text-brand-ink outline-none" type="email" value={studentEditForm.parentEmail} onChange={(event) => setStudentEditForm((current) => ({ ...current, parentEmail: event.target.value }))} />
                      </label>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500">
                        Địa chỉ
                        <input className="mt-2 w-full rounded-2xl border border-brand-red/10 bg-[#fffaf7] px-3 py-2 text-sm normal-case tracking-normal text-brand-ink outline-none" value={studentEditForm.address} onChange={(event) => setStudentEditForm((current) => ({ ...current, address: event.target.value }))} />
                      </label>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500">
                        Nguồn lead
                        <input className="mt-2 w-full rounded-2xl border border-brand-red/10 bg-[#fffaf7] px-3 py-2 text-sm normal-case tracking-normal text-brand-ink outline-none" value={studentEditForm.leadSource} onChange={(event) => setStudentEditForm((current) => ({ ...current, leadSource: event.target.value }))} />
                      </label>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500 md:col-span-2">
                        Sale phụ trách
                        <select className="mt-2 w-full rounded-2xl border border-brand-red/10 bg-[#fffaf7] px-3 py-2 text-sm normal-case tracking-normal text-brand-ink outline-none" value={studentEditForm.saleOwnerId} onChange={(event) => setStudentEditForm((current) => ({ ...current, saleOwnerId: event.target.value }))}>
                          <option value="">Chưa gán sale</option>
                          {options.sales.map((sale) => (
                            <option key={sale.id} value={sale.id}>{sale.name}</option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500 md:col-span-2">
                        Ghi chú lead
                        <textarea className="mt-2 min-h-20 w-full rounded-2xl border border-brand-red/10 bg-[#fffaf7] px-3 py-2 text-sm normal-case tracking-normal text-brand-ink outline-none" value={studentEditForm.leadNote} onChange={(event) => setStudentEditForm((current) => ({ ...current, leadNote: event.target.value }))} />
                      </label>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500 md:col-span-2">
                        Lưu ý sức khỏe
                        <textarea className="mt-2 min-h-20 w-full rounded-2xl border border-brand-red/10 bg-[#fffaf7] px-3 py-2 text-sm normal-case tracking-normal text-brand-ink outline-none" value={studentEditForm.healthNote} onChange={(event) => setStudentEditForm((current) => ({ ...current, healthNote: event.target.value }))} />
                      </label>
                    </div>
                  </form>

                  <div className="rounded-3xl border border-brand-red/15 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-brand-ink"><MessageSquarePlus className="h-4 w-4 text-brand-red" />Lịch sử liên hệ</h3>
                      <span className="text-xs text-stone-500">3 mới nhất</span>
                    </div>
                    <div className="mb-3 grid gap-2 md:grid-cols-[150px_1fr_auto]">
                      <select className="rounded-2xl border border-brand-red/10 bg-[#fffaf7] px-3 py-2 text-sm outline-none" value={contactForm.result} onChange={(event) => setContactForm((current) => ({ ...current, result: event.target.value as ContactResultKey }))}>
                        {Object.entries(contactResultLabels).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                      <input className="rounded-2xl border border-brand-red/10 bg-[#fffaf7] px-3 py-2 text-sm outline-none" placeholder="Nội dung liên hệ..." value={contactForm.content} onChange={(event) => setContactForm((current) => ({ ...current, content: event.target.value }))} />
                      <button className="glass-button-primary px-4 py-2 text-sm font-semibold" disabled={isSavingActivity} onClick={() => void createContactLog()}>Lưu</button>
                    </div>
                    <div className="space-y-2">
                      {selectedContactLogs.length ? selectedContactLogs.map((log) => (
                        <div key={log.id} className="neu-list-item rounded-2xl p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-brand-red">{contactResultLabels[log.result]}</p>
                            <p className="text-xs text-stone-500">{formatDateTime(log.createdAt)}</p>
                          </div>
                          <p className="mt-1 line-clamp-2 text-sm text-brand-ink">{log.content}</p>
                          <p className="mt-2 inline-flex items-center gap-1 text-xs text-stone-500"><UserRound className="h-3.5 w-3.5" />Người liên hệ: {log.loggedByName}</p>
                        </div>
                      )) : <p className="rounded-2xl border border-brand-red/10 p-3 text-sm text-stone-500">Chưa có lịch sử liên hệ.</p>}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-brand-red/15 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-brand-ink"><CheckSquare className="h-4 w-4 text-brand-red" />Task tiếp theo</h3>
                      <span className="text-xs text-stone-500">3 sắp tới</span>
                    </div>
                    <div className="mb-3 grid gap-2 md:grid-cols-[1fr_180px_auto]">
                      <input className="rounded-2xl border border-brand-red/10 bg-[#fffaf7] px-3 py-2 text-sm outline-none" placeholder="Việc cần làm..." value={taskForm.title} onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))} />
                      <input className="rounded-2xl border border-brand-red/10 bg-[#fffaf7] px-3 py-2 text-sm outline-none" type="date" value={taskForm.dueDate} onChange={(event) => setTaskForm((current) => ({ ...current, dueDate: event.target.value }))} />
                      <button type="button" className="glass-button-primary px-4 py-2 text-sm font-semibold" disabled={isSavingActivity} onClick={() => void createTask()}>Tạo</button>
                    </div>
                    <input className="mb-3 w-full rounded-2xl border border-brand-red/10 bg-[#fffaf7] px-3 py-2 text-sm outline-none" placeholder="Ghi chú task..." value={taskForm.note} onChange={(event) => setTaskForm((current) => ({ ...current, note: event.target.value }))} />
                    <div className="space-y-2">
                      {selectedTasks.length ? selectedTasks.map((task) => (
                        <div key={task.id} className="neu-list-item rounded-2xl p-3">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-semibold text-brand-ink">{task.title}</p>
                            <span className="rounded-full border border-brand-red/10 px-2 py-1 text-xs font-semibold text-brand-red">{taskStatusLabels[task.status]}</span>
                          </div>
                          <p className="mt-2 inline-flex items-center gap-1 text-xs text-stone-500"><Clock className="h-3.5 w-3.5" />{formatDateTime(task.dueDate)} · {task.assignedToName}</p>
                        </div>
                      )) : <p className="rounded-2xl border border-brand-red/10 p-3 text-sm text-stone-500">Chưa có task tiếp theo.</p>}
                    </div>
                  </div>

                  <Link href={`/students/${selectedStudent.id}`} className="glass-button-primary inline-flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-semibold">
                    Mở hồ sơ đầy đủ
                  </Link>
                </div>
            ) : (
              <div className="text-sm text-stone-500">Đang tải hồ sơ...</div>
            )}
        </DialogShell>
      ) : null}
    </main>
  )
}
