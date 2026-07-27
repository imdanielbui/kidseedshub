"use client"

import { ArrowDownAZ, Eye, GripVertical, LayoutList, ListFilter, Pin, Plus, Rows3, Search, SlidersHorizontal, UserRound, UsersRound, X } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState, type CSSProperties } from "react"
import type { ApiResponse } from "@/lib/api-response"
import { LeadFormPanel, emptyLeadForm, type LeadFormState } from "@/components/shared/lead-form-panel"
import type { ClassListItem } from "@/lib/contracts/courses"
import type { PipelineOptions } from "@/lib/contracts/crm"
import { studentStatusLabels, type StudentListItem, type StudentStatusKey } from "@/lib/contracts/students"

const statusOptions = Object.entries(studentStatusLabels) as Array<[StudentStatusKey, string]>

type PanelMode = "lead" | "filters" | "fields" | null
type ViewMode = "list" | "database"
type SortKey = "updatedAt" | "createdAt" | "code" | "name" | "parentName" | "sessionsRemaining"
type SortDirection = "asc" | "desc"
type ColumnKey =
  | "code"
  | "name"
  | "dataSource"
  | "parentName"
  | "parentPhone"
  | "address"
  | "status"
  | "sessionsRemaining"
  | "courses"
  | "assignedTeacherName"
  | "leadSource"
  | "saleOwnerName"
  | "createdByName"
  | "createdAt"
  | "updatedAt"

const columnLabels: Record<ColumnKey, string> = {
  code: "Mã HS",
  name: "Học viên",
  dataSource: "Nguồn dữ liệu",
  parentName: "Phụ huynh",
  parentPhone: "SĐT",
  address: "Địa chỉ",
  status: "Trạng thái",
  sessionsRemaining: "Buổi còn",
  courses: "Khóa",
  assignedTeacherName: "GV",
  leadSource: "Nguồn",
  saleOwnerName: "Sale",
  createdByName: "Tạo bởi",
  createdAt: "Ngày tạo",
  updatedAt: "Cập nhật"
}

const defaultColumnOrder: ColumnKey[] = [
  "code",
  "name",
  "dataSource",
  "parentName",
  "parentPhone",
  "address",
  "status",
  "sessionsRemaining",
  "courses",
  "assignedTeacherName",
  "leadSource",
  "saleOwnerName",
  "createdAt",
  "updatedAt"
]

const defaultPinnedColumns: ColumnKey[] = ["code", "name"]

const pinnedColumnWidths: Partial<Record<ColumnKey, number>> = {
  code: 148,
  name: 230,
  parentName: 220,
  parentPhone: 160,
  status: 160,
  sessionsRemaining: 140
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value))
}

function getHeaderTotal(headers: Headers) {
  return Number(headers.get("x-total-count") ?? 0)
}

export default function StudentsPage() {
  const [students, setStudents] = useState<StudentListItem[]>([])
  const [options, setOptions] = useState<PipelineOptions>({ sales: [], classes: [] })
  const [status, setStatus] = useState<StudentStatusKey | "">("")
  const [classFilter, setClassFilter] = useState("")
  const [createdFrom, setCreatedFrom] = useState("")
  const [createdTo, setCreatedTo] = useState("")
  const [query, setQuery] = useState("")
  const [panelMode, setPanelMode] = useState<PanelMode>(null)
  const [viewMode, setViewMode] = useState<ViewMode>("database")
  const [isSubmittingLead, setIsSubmittingLead] = useState(false)
  const [leadForm, setLeadForm] = useState<LeadFormState>(emptyLeadForm)
  const [isLoading, setIsLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [total, setTotal] = useState(0)
  const [columnOrder, setColumnOrder] = useState<ColumnKey[]>(defaultColumnOrder)
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(new Set(defaultColumnOrder))
  const [pinnedColumns, setPinnedColumns] = useState<Set<ColumnKey>>(new Set(defaultPinnedColumns))
  const [draggingColumn, setDraggingColumn] = useState<ColumnKey | null>(null)
  const [error, setError] = useState<string | null>(null)

  const totalPages = Math.max(1, Math.ceil(total / limit))
  const visibleColumnOrder = columnOrder.filter((column) => visibleColumns.has(column))
  const tableColumnOrder = useMemo(() => {
    const pinned = visibleColumnOrder.filter((column) => pinnedColumns.has(column))
    const unpinned = visibleColumnOrder.filter((column) => !pinnedColumns.has(column))
    return [...pinned, ...unpinned]
  }, [pinnedColumns, visibleColumnOrder])
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
  const activeCount = useMemo(() => students.filter((student) => student.status === "ACTIVE").length, [students])
  const remainingSessions = useMemo(() => students.reduce((sum, student) => sum + student.sessionsRemaining, 0), [students])

  async function loadStudents() {
    setIsLoading(true)
    setError(null)

    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      sort: sortKey,
      direction: sortDirection
    })
    if (status) params.set("status", status)
    if (classFilter) params.set("classId", classFilter)
    if (createdFrom) params.set("createdFrom", createdFrom)
    if (createdTo) params.set("createdTo", createdTo)
    if (query.trim()) params.set("q", query.trim())

    try {
      const [studentsResponse, optionsResponse, classesResponse] = await Promise.all([
        fetch(`/api/students?${params.toString()}`, { cache: "no-store" }),
        fetch("/api/students/options", { cache: "no-store" }),
        fetch("/api/classes?active=true&summary=true", { cache: "no-store" })
      ])
      const studentsPayload = (await studentsResponse.json()) as ApiResponse<StudentListItem[]>
      const optionsPayload = (await optionsResponse.json()) as ApiResponse<PipelineOptions>
      const classesPayload = (await classesResponse.json()) as ApiResponse<ClassListItem[]>

      if (!studentsResponse.ok || !studentsPayload.success || !studentsPayload.data) {
        setError(studentsPayload.error?.message ?? "Không tải được danh sách học viên.")
        return
      }

      setStudents(studentsPayload.data)
      setTotal(getHeaderTotal(studentsResponse.headers))

      if (optionsResponse.ok && optionsPayload.success && optionsPayload.data) {
        setOptions(optionsPayload.data)
      }

      if (classesResponse.ok && classesPayload.success && classesPayload.data) {
        const classOptions = classesPayload.data.map((klass) => ({ id: klass.id, name: klass.name }))

        setOptions((current) => ({
          ...current,
          classes: classOptions
        }))
      }
    } catch {
      setError("Không tải được danh sách học viên.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadStudents()
    }, 120)

    return () => window.clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, status, classFilter, createdFrom, createdTo, page, limit, sortKey, sortDirection])

  async function submitLead(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmittingLead(true)
    setError(null)

    try {
      const response = await fetch("/api/students", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: leadForm.studentName.trim(),
          birthDate: leadForm.birthDate ? new Date(`${leadForm.birthDate}T00:00:00`).toISOString() : undefined,
          status: "LEAD",
          gender: leadForm.gender,
          leadSource: leadForm.leadSource.trim() || undefined,
          leadNote: leadForm.leadNote.trim() || undefined,
          healthNote: leadForm.healthNote.trim() || undefined,
          address: leadForm.address.trim() || undefined,
          saleOwnerId: leadForm.saleOwnerId || undefined,
          classId: leadForm.classId || undefined,
          parent: {
            name: leadForm.parentName.trim(),
            phone: leadForm.parentPhone.trim(),
            email: leadForm.parentEmail.trim() || undefined
          }
        })
      })
      const payload = (await response.json()) as ApiResponse<StudentListItem>

      if (!response.ok || !payload.success || !payload.data) {
        setError(payload.error?.message ?? "Không tạo được lead.")
        return
      }

      setLeadForm(emptyLeadForm)
      setPanelMode(null)
      setPage(1)
      await loadStudents()
    } catch {
      setError("Không tạo được lead.")
    } finally {
      setIsSubmittingLead(false)
    }
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

  function clearFilters() {
    setStatus("")
    setClassFilter("")
    setCreatedFrom("")
    setCreatedTo("")
    setQuery("")
    setPage(1)
  }

  function renderCell(student: StudentListItem, column: ColumnKey) {
    if (column === "status") return studentStatusLabels[student.status]
    if (column === "dataSource") return student.code.startsWith("HV-") ? "Dữ liệu thật" : "Demo/seed"
    if (column === "sessionsRemaining") return `${student.sessionsRemaining} buổi`
    if (column === "courses") return student.courses.length ? `${student.courses.length} khóa` : "Chưa có khóa"
    if (column === "createdAt" || column === "updatedAt") return formatDate(student[column])
    return student[column] || "-"
  }

  return (
    <main className="flex min-h-0 flex-col gap-3 overflow-hidden md:h-[calc(100vh-2.75rem)]">
      <section className="neu-card shrink-0 rounded-3xl p-3">
        <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex min-w-60 flex-1 items-center gap-2 rounded-full border border-brand-red/10 bg-white/50 px-4 py-2 text-sm text-stone-600 xl:max-w-md">
              <Search className="h-4 w-4" />
              <input
                className="w-full bg-transparent outline-none"
                placeholder="Tìm mã HS, học viên, phụ huynh, SĐT, địa chỉ..."
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setPage(1)
                }}
              />
            </label>
            <button className={`glass-button-secondary inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold ${viewMode === "database" ? "text-brand-red" : ""}`} onClick={() => setViewMode("database")}>
              <Rows3 className="h-4 w-4" />
              Database
            </button>
            <button className={`glass-button-secondary inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold ${viewMode === "list" ? "text-brand-red" : ""}`} onClick={() => setViewMode("list")}>
              <LayoutList className="h-4 w-4" />
              Danh sách
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
        <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full border border-brand-red/10 bg-white/40 px-3 py-1 text-brand-red">{total} hồ sơ</span>
          <span className="rounded-full border border-brand-red/10 bg-white/40 px-3 py-1 text-stone-600">Trang này: {students.length}</span>
          <span className="rounded-full border border-brand-red/10 bg-white/40 px-3 py-1 text-stone-600">Đang học: {activeCount}</span>
          <span className="rounded-full border border-brand-red/10 bg-white/40 px-3 py-1 text-stone-600">Buổi còn: {remainingSessions}</span>
        </div>
      </section>

      {panelMode ? (
        <section className="neu-card rounded-3xl p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-brand-ink">
              {panelMode === "lead" ? "Tạo lead mới" : panelMode === "filters" ? "Bộ lọc học viên" : "Ẩn/hiện và sắp xếp trường"}
            </h2>
            <button className="glass-button-secondary inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold" onClick={() => setPanelMode(null)}>
              <X className="h-4 w-4" />
              Đóng
            </button>
          </div>

          {panelMode === "lead" ? (
            <LeadFormPanel value={leadForm} onChange={setLeadForm} options={options} isSubmitting={isSubmittingLead} onSubmit={submitLead} />
          ) : null}

          {panelMode === "filters" ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
              <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500">
                Trạng thái
                <select className="mt-2 w-full rounded-2xl border border-brand-red/10 bg-white px-3 py-2 text-sm normal-case tracking-normal text-brand-ink outline-none" value={status} onChange={(event) => { setStatus(event.target.value as StudentStatusKey | ""); setPage(1) }}>
                  <option value="">Tất cả trạng thái</option>
                  {statusOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500">
                Lớp
                <select className="mt-2 w-full rounded-2xl border border-brand-red/10 bg-white px-3 py-2 text-sm normal-case tracking-normal text-brand-ink outline-none" value={classFilter} onChange={(event) => { setClassFilter(event.target.value); setPage(1) }}>
                  <option value="">Tất cả lớp học</option>
                  {options.classes.map((klass) => <option key={klass.id} value={klass.id}>{klass.name}</option>)}
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
                  <option value="code">Mã HS</option>
                  <option value="name">Học viên</option>
                  <option value="parentName">Phụ huynh</option>
                  <option value="sessionsRemaining">Buổi còn</option>
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
                  className={`inline-flex items-center gap-1 rounded-full border p-1 text-xs font-semibold ${visibleColumns.has(column) ? "border-brand-red/20 bg-white text-brand-ink" : "border-stone-200 bg-white/35 text-stone-400"}`}
                >
                  <button type="button" className="inline-flex items-center gap-2 rounded-full px-2 py-1.5" onClick={() => toggleColumn(column)}>
                    <GripVertical className="h-3.5 w-3.5" />
                    <Eye className="h-3.5 w-3.5" />
                    {columnLabels[column]}
                  </button>
                  <button
                    type="button"
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-full border ${pinnedColumns.has(column) ? "border-brand-red bg-brand-red text-white" : "border-brand-red/10 bg-white/60 text-stone-500"}`}
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

      {error ? <p className="rounded-2xl border border-brand-red/15 bg-white/50 p-3 text-sm text-brand-red">{error}</p> : null}

      {viewMode === "list" ? (
        <section className="neu-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl p-3">
          <div className="min-h-0 flex-1 space-y-2 overflow-auto pr-1">
            {isLoading ? (
              <p className="rounded-2xl border border-brand-red/10 bg-white/45 p-4 text-sm text-stone-500">Đang tải học viên...</p>
            ) : students.length ? (
              students.map((student) => (
                <Link
                  key={student.id}
                  href={`/students/${student.id}`}
                  className="group grid gap-3 rounded-2xl border border-brand-red/10 bg-white/45 px-3 py-2.5 transition-shadow hover:shadow-[0_8px_18px_rgba(165,36,39,0.08)] lg:grid-cols-[minmax(0,1.4fr)_auto_minmax(180px,0.65fr)] lg:items-center"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="shrink-0 rounded-full border border-brand-red/15 px-2.5 py-1 text-xs font-semibold text-brand-red">{student.code}</span>
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-semibold text-brand-ink group-hover:text-brand-red">{student.name}</h2>
                      <p className="truncate text-xs text-stone-500">{student.parentName} · {student.parentPhone}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                    <span className="rounded-full border border-brand-red/15 px-2 py-1 text-stone-600">{studentStatusLabels[student.status]}</span>
                    <span className="rounded-full border border-brand-red/15 bg-white/45 px-2 py-1 text-brand-ink">{student.sessionsRemaining} buổi</span>
                    <span className="rounded-full border border-brand-red/15 px-2 py-1 text-stone-600">{student.courses.length ? `${student.courses.length} khóa` : "Chưa khóa"}</span>
                  </div>

                  <div className="min-w-0 text-xs text-stone-500 lg:text-right">
                    <p className="truncate">Sale: {student.saleOwnerName || "-"}</p>
                    <p className="truncate">GV: {student.assignedTeacherName || "Chưa xếp"} · {formatDate(student.updatedAt)}</p>
                  </div>
                </Link>
              ))
            ) : (
              <p className="rounded-2xl border border-brand-red/10 bg-white/45 p-4 text-sm text-stone-500">Chưa có học viên phù hợp.</p>
            )}
          </div>
          <StudentPagination page={page} totalPages={totalPages} limit={limit} setPage={setPage} setLimit={setLimit} />
        </section>
      ) : (
        <section className="neu-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl">
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[1240px] border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 bg-[#f5eeeb] text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  {tableColumnOrder.map((column) => (
                    <th key={column} className={`border-b border-brand-red/10 px-4 py-3 font-semibold ${pinnedColumnClass(column, "head")}`} style={pinnedColumnStyle(column)}>
                      {columnLabels[column]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td className="px-4 py-8 text-stone-500" colSpan={tableColumnOrder.length}>Đang tải học viên...</td></tr>
                ) : students.length ? students.map((student) => (
                  <tr key={student.id} className="border-b border-brand-red/10 transition-shadow hover:shadow-[0_8px_20px_rgba(165,36,39,0.08)]">
                    {tableColumnOrder.map((column) => (
                      <td key={column} className={`max-w-64 truncate px-4 py-3 align-middle text-brand-ink ${pinnedColumnClass(column, "body")}`} style={pinnedColumnStyle(column)}>
                        {column === "code" || column === "name" ? (
                          <Link href={`/students/${student.id}`} className="inline-flex items-center gap-2 font-semibold hover:text-brand-red">
                            {column === "name" ? <UserRound className="h-4 w-4 text-brand-red" /> : null}
                            {renderCell(student, column)}
                          </Link>
                        ) : column === "status" ? (
                          <span className="rounded-full border border-brand-red/15 px-2 py-1 text-xs font-semibold text-brand-red">{renderCell(student, column)}</span>
                        ) : column === "assignedTeacherName" ? (
                          <span className="inline-flex items-center gap-1"><UsersRound className="h-3.5 w-3.5 text-brand-red" />{renderCell(student, column)}</span>
                        ) : (
                          renderCell(student, column)
                        )}
                      </td>
                    ))}
                  </tr>
                )) : (
                  <tr><td className="px-4 py-8 text-stone-500" colSpan={tableColumnOrder.length}>Chưa có học viên phù hợp.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <StudentPagination page={page} totalPages={totalPages} limit={limit} setPage={setPage} setLimit={setLimit} />
        </section>
      )}
    </main>
  )
}

function StudentPagination({
  page,
  totalPages,
  limit,
  setPage,
  setLimit
}: {
  page: number
  totalPages: number
  limit: number
  setPage: React.Dispatch<React.SetStateAction<number>>
  setLimit: React.Dispatch<React.SetStateAction<number>>
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-brand-red/10 p-3 text-sm">
      <div className="flex items-center gap-2 text-stone-600">
        <span>Trang {page}/{totalPages}</span>
        <select className="rounded-full border border-brand-red/10 bg-white/50 px-3 py-2 outline-none" value={limit} onChange={(event) => { setLimit(Number(event.target.value)); setPage(1) }}>
          <option value={25}>25 dòng</option>
          <option value={50}>50 dòng</option>
          <option value={100}>100 dòng</option>
        </select>
      </div>
      <div className="flex items-center gap-2">
        <button className="glass-button-secondary px-4 py-2 text-sm font-semibold" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Trước</button>
        <button className="glass-button-secondary px-4 py-2 text-sm font-semibold" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Sau</button>
      </div>
    </div>
  )
}
