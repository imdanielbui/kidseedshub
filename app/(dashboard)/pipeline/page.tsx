"use client"

import { Archive, ArrowDownAZ, CheckSquare, Clock, Eye, GripVertical, LayoutGrid, ListFilter, MessageSquarePlus, Pin, Plus, Rows3, Save, Search, SlidersHorizontal, UserRound, X } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState, type CSSProperties, type MouseEvent } from "react"
import type { ApiResponse } from "@/lib/api-response"
import { DialogShell } from "@/components/shared/dialog-shell"
import { LeadFormPanel, emptyLeadForm, type LeadFormState } from "@/components/shared/lead-form-panel"
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

type ViewMode = "database" | "kanban"
type PanelMode = "lead" | "filters" | "fields" | null
type SortKey = "updatedAt" | "createdAt" | "stageChangedAt" | "daysInStage" | "parentName" | "studentName" | "code"
type SortDirection = "asc" | "desc"
type StageFilter = "ALL" | PipelineStageKey

type ColumnKey =
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

const columnLabels: Record<ColumnKey, string> = {
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

const defaultColumnOrder: ColumnKey[] = [
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

const defaultPinnedColumns: ColumnKey[] = ["code", "studentName"]

const pinnedColumnWidths: Partial<Record<ColumnKey, number>> = {
  code: 104,
  studentName: 220,
  parentName: 220,
  phone: 160,
  address: 220,
  stage: 160,
  daysInStage: 170
}

type ContactForm = {
  result: ContactResultKey
  content: string
}

type StudentEditForm = {
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

type TaskForm = {
  title: string
  dueDate: string
  note: string
}

const emptyContactForm: ContactForm = {
  result: "INTERESTED",
  content: ""
}

const emptyTaskForm: TaskForm = {
  title: "",
  dueDate: "",
  note: ""
}

const emptyStudentEditForm: StudentEditForm = {
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

const emptyPipeline: PipelineResponse = {
  items: [],
  total: 0,
  page: 1,
  limit: 25,
  stageCounts: { LEAD: 0, TRIAL: 0, EVALUATION: 0, CONVERTED: 0, RETENTION: 0, NURTURE: 0 },
  staleCounts: { LEAD: 0, TRIAL: 0, EVALUATION: 0, CONVERTED: 0, RETENTION: 0, NURTURE: 0 }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value))
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value))
}

function toIsoFromLocalInput(value: string) {
  return value ? new Date(value).toISOString() : ""
}

function toStudentEditForm(student: StudentDetail, saleOwnerId = ""): StudentEditForm {
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

function nullableTrim(value: string) {
  const trimmed = value.trim()
  return trimmed || null
}

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
  const [taskForm, setTaskForm] = useState<TaskForm>(emptyTaskForm)
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
      setTaskForm(emptyTaskForm)
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
    if (!selectedStudent || !taskForm.title.trim() || !taskForm.dueDate) return

    setIsSavingActivity(true)
    setError(null)

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: taskForm.title.trim(),
          note: taskForm.note.trim() || undefined,
          dueDate: toIsoFromLocalInput(taskForm.dueDate),
          studentId: selectedStudent.id
        })
      })
      const payload = (await response.json()) as ApiResponse<unknown>

      if (!response.ok || !payload.success) {
        setError(payload.error?.message ?? "Không tạo được task tiếp theo.")
        return
      }

      setTaskForm(emptyTaskForm)
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

  function pinnedColumnStyle(column: ColumnKey): CSSProperties | undefined {
    if (!pinnedColumns.has(column)) return undefined
    const width = pinnedColumnWidths[column] ?? 180

    return {
      left: pinnedColumnOffsets.get(column) ?? 0,
      minWidth: width,
      width
    }
  }

  function pinnedColumnClass(column: ColumnKey, surface: "head" | "body") {
    if (!pinnedColumns.has(column)) return ""
    const bgClass = surface === "head" ? "bg-[#f5eeeb]" : "bg-[#fffaf7]"
    const zClass = surface === "head" ? "z-20" : "z-10"
    return `sticky ${zClass} ${bgClass} border-r border-brand-red/10 shadow-[8px_0_18px_rgba(88,52,42,0.08)]`
  }

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
    <main className="flex h-[calc(100vh-8.25rem)] min-h-0 flex-col gap-3 overflow-hidden md:h-[calc(100vh-2.75rem)]">
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

      {error ? <p className="shrink-0 rounded-2xl border border-brand-red/15 bg-white/50 p-3 text-sm text-brand-red">{error}</p> : null}

      {viewMode === "database" ? (
        <section className="neu-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl">
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[1320px] border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 bg-[#f5eeeb] text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  {tableColumnOrder.map((column) => (
                    <th key={column} className={`border-b border-brand-red/10 px-4 py-3 font-semibold ${pinnedColumnClass(column, "head")}`} style={pinnedColumnStyle(column)}>
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
                        <td key={column} className={`max-w-64 truncate px-4 py-3 align-middle ${pinnedColumnClass(column, "body")} ${card.isStale && column === "daysInStage" ? "font-semibold text-brand-red" : "text-brand-ink"}`} style={pinnedColumnStyle(column)}>
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
      ) : (
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
                    <button className="glass-button-secondary w-full px-4 py-2 text-xs font-semibold" onClick={() => { setViewMode("database"); setStage(stage.key) }}>
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
                      <input className="rounded-2xl border border-brand-red/10 bg-[#fffaf7] px-3 py-2 text-sm outline-none" type="datetime-local" value={taskForm.dueDate} onChange={(event) => setTaskForm((current) => ({ ...current, dueDate: event.target.value }))} />
                      <button className="glass-button-primary px-4 py-2 text-sm font-semibold" disabled={isSavingActivity} onClick={() => void createTask()}>Tạo</button>
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
