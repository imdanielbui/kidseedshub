"use client"

import { CalendarDays, ChartNoAxesCombined, Plus, RefreshCcw, Search, Trash2 } from "lucide-react"
import type { Dispatch, FormEvent, SetStateAction } from "react"
import { subjectLabels } from "@/lib/contracts/assessment"
import type { ClassListItem, CourseListItem } from "@/lib/contracts/courses"
import { scheduleEventTypeLabels, type ScheduleEventItem } from "@/lib/contracts/schedule-events"
import type { StudentListItem } from "@/lib/contracts/students"
import type { UserListItem } from "@/lib/contracts/users"
import { weekdayColumns } from "./class-schedule-utils"

type SlotForm = {
  weekday: string
  startTime: string
  endTime: string
  room: string
}

type ClassFormState = {
  code: string
  name: string
  courseId: string
  teacherId: string
  startDate: string
  plannedSessions: string
  isActive: boolean
  studentIds: string[]
  slots: SlotForm[]
}

type ClassSubjectFilter = "ALL" | "FUN" | "ROBOTICS"
type ClassStatusFilter = "ALL" | "ACTIVE" | "INACTIVE"
type SetupPanel = "manage" | "create" | "events"

type ClassSetupWorkspaceProps = {
  setupPanel: SetupPanel
  setSetupPanel: Dispatch<SetStateAction<SetupPanel>>
  filteredManagedClasses: ClassListItem[]
  classes: ClassListItem[]
  activeCourses: CourseListItem[]
  scheduleEvents: ScheduleEventItem[]
  classSearch: string
  setClassSearch: Dispatch<SetStateAction<string>>
  classSubjectFilter: ClassSubjectFilter
  setClassSubjectFilter: Dispatch<SetStateAction<ClassSubjectFilter>>
  classStatusFilter: ClassStatusFilter
  setClassStatusFilter: Dispatch<SetStateAction<ClassStatusFilter>>
  setSelectedManagedClassId: Dispatch<SetStateAction<string | null>>
  setSelectedTimelineClassId: Dispatch<SetStateAction<string | null>>
  form: ClassFormState
  setForm: Dispatch<SetStateAction<ClassFormState>>
  teacherOptions: UserListItem[]
  students: StudentListItem[]
  addSlot: () => void
  removeSlot: (index: number) => void
  createClass: (event: FormEvent<HTMLFormElement>) => Promise<void>
  canManageSchedule: boolean
  isCreating: boolean
  isSaving: string | null
  selectedYear: number
  loadSchedule: () => Promise<void>
  importVietnamHolidays: () => Promise<void>
  setIsEventDialogOpen: Dispatch<SetStateAction<boolean>>
  deleteScheduleEvent: (eventId: string) => Promise<void>
}

export function ClassSetupWorkspace({
  setupPanel,
  setSetupPanel,
  filteredManagedClasses,
  classes,
  activeCourses,
  scheduleEvents,
  classSearch,
  setClassSearch,
  classSubjectFilter,
  setClassSubjectFilter,
  classStatusFilter,
  setClassStatusFilter,
  setSelectedManagedClassId,
  setSelectedTimelineClassId,
  form,
  setForm,
  teacherOptions,
  students,
  addSlot,
  removeSlot,
  createClass,
  canManageSchedule,
  isCreating,
  isSaving,
  selectedYear,
  loadSchedule,
  importVietnamHolidays,
  setIsEventDialogOpen,
  deleteScheduleEvent
}: ClassSetupWorkspaceProps) {
  return (
    <>
      <div className="content-border grid grid-cols-[1fr_1fr_1fr_auto] gap-2 p-3">
        {([
          { id: "manage", label: "Quản lý lớp", meta: `${filteredManagedClasses.length}/${classes.length} lớp` },
          { id: "create", label: "Tạo lớp", meta: `${activeCourses.length} khóa active` },
          { id: "events", label: "Lịch nghỉ", meta: `${scheduleEvents.length} mục` }
        ] satisfies Array<{ id: SetupPanel; label: string; meta: string }>).map((item) => {
          const isActive = setupPanel === item.id

          return (
            <button
              key={item.id}
              type="button"
              className={`rounded-2xl border px-4 py-3 text-left transition ${
                isActive
                  ? "border-brand-red/20 bg-white/70 text-brand-red shadow-[0_10px_24px_rgba(165,36,39,0.10)]"
                  : "border-brand-red/10 bg-white/35 text-stone-600 hover:text-brand-red"
              }`}
              onClick={() => setSetupPanel(item.id)}
            >
              <span className="block text-sm font-semibold">{item.label}</span>
              <span className="mt-1 block text-xs text-stone-500">{item.meta}</span>
            </button>
          )
        })}
        <button
          type="button"
          className="neu-list-item flex h-full min-h-[62px] items-center justify-center rounded-2xl px-3 text-stone-500 hover:text-brand-red"
          onClick={() => void loadSchedule()}
          title="Tải lại dữ liệu"
          aria-label="Tải lại dữ liệu"
        >
          <RefreshCcw className="h-4 w-4" />
        </button>
      </div>

      {setupPanel === "manage" ? (
        <ManageClassesPanel
          filteredManagedClasses={filteredManagedClasses}
          classes={classes}
          classSearch={classSearch}
          setClassSearch={setClassSearch}
          classSubjectFilter={classSubjectFilter}
          setClassSubjectFilter={setClassSubjectFilter}
          classStatusFilter={classStatusFilter}
          setClassStatusFilter={setClassStatusFilter}
          setSelectedManagedClassId={setSelectedManagedClassId}
          setSelectedTimelineClassId={setSelectedTimelineClassId}
        />
      ) : null}

      {setupPanel === "create" ? (
        <CreateClassPanel
          form={form}
          setForm={setForm}
          activeCourses={activeCourses}
          teacherOptions={teacherOptions}
          students={students}
          addSlot={addSlot}
          removeSlot={removeSlot}
          createClass={createClass}
          canManageSchedule={canManageSchedule}
          isCreating={isCreating}
        />
      ) : null}

      {setupPanel === "events" ? (
        <ScheduleEventsPanel
          scheduleEvents={scheduleEvents}
          selectedYear={selectedYear}
          canManageSchedule={canManageSchedule}
          isSaving={isSaving}
          importVietnamHolidays={importVietnamHolidays}
          setIsEventDialogOpen={setIsEventDialogOpen}
          deleteScheduleEvent={deleteScheduleEvent}
        />
      ) : null}
    </>
  )
}

function ManageClassesPanel({
  filteredManagedClasses,
  classes,
  classSearch,
  setClassSearch,
  classSubjectFilter,
  setClassSubjectFilter,
  classStatusFilter,
  setClassStatusFilter,
  setSelectedManagedClassId,
  setSelectedTimelineClassId
}: Pick<
  ClassSetupWorkspaceProps,
  | "filteredManagedClasses"
  | "classes"
  | "classSearch"
  | "setClassSearch"
  | "classSubjectFilter"
  | "setClassSubjectFilter"
  | "classStatusFilter"
  | "setClassStatusFilter"
  | "setSelectedManagedClassId"
  | "setSelectedTimelineClassId"
>) {
  return (
    <div className="content-border p-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-semibold text-brand-ink">Quản lý lớp học</p>
          <p className="mt-1 text-xs text-stone-500">Danh sách lớp, lịch lặp, học sinh và trạng thái đang mở.</p>
        </div>
        <div className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_160px_160px_auto] xl:min-w-[720px]">
          <label className="neu-pressed flex items-center gap-2 rounded-2xl px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-brand-red" />
            <input
              className="min-w-0 flex-1 bg-transparent text-sm text-brand-ink outline-none placeholder:text-stone-400"
              value={classSearch}
              onChange={(event) => setClassSearch(event.target.value)}
              placeholder="Tìm lớp, khóa, giáo viên..."
            />
          </label>
          <select
            className="neu-pressed rounded-2xl bg-transparent px-3 py-2 text-sm font-semibold text-stone-600 outline-none"
            value={classSubjectFilter}
            onChange={(event) => setClassSubjectFilter(event.target.value as ClassSubjectFilter)}
          >
            <option value="ALL">Tất cả môn</option>
            <option value="FUN">FUN</option>
            <option value="ROBOTICS">Robotics</option>
          </select>
          <select
            className="neu-pressed rounded-2xl bg-transparent px-3 py-2 text-sm font-semibold text-stone-600 outline-none"
            value={classStatusFilter}
            onChange={(event) => setClassStatusFilter(event.target.value as ClassStatusFilter)}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang mở</option>
            <option value="INACTIVE">Tạm tắt</option>
          </select>
          <span className="rounded-2xl border border-brand-red/10 px-3 py-2 text-center text-xs font-semibold text-brand-red">
            {filteredManagedClasses.length}/{classes.length} lớp
          </span>
        </div>
      </div>
      <div className="mt-4 grid max-h-[52vh] gap-3 overflow-auto pr-1 lg:grid-cols-2 2xl:grid-cols-3">
        {filteredManagedClasses.length ? filteredManagedClasses.map((klass) => {
          const activeStudents = klass.students.filter((student) => student.isActive).length

          return (
            <article
              key={klass.id}
              className="neu-list-item rounded-2xl p-4"
            >
              <button type="button" className="w-full text-left" onClick={() => setSelectedManagedClassId(klass.id)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-brand-ink">{klass.name}</p>
                    {klass.code ? <p className="mt-1 truncate text-xs font-semibold text-brand-red">{klass.code}</p> : null}
                    <p className="mt-1 truncate text-xs text-stone-500">
                      Khóa: {klass.courseName} - {subjectLabels[klass.subject]}
                    </p>
                    <p className="mt-1 truncate text-xs text-stone-500">
                      GV {klass.teacherName}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-semibold ${klass.isActive ? "border-emerald-500/25 text-emerald-700" : "border-stone-300 text-stone-500"}`}>
                    {klass.isActive ? "Đang mở" : "Tạm tắt"}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-stone-600">
                  <span className="rounded-xl border border-brand-red/10 px-2 py-1.5">{activeStudents} học sinh</span>
                  <span className="rounded-xl border border-brand-red/10 px-2 py-1.5">{klass.generatedSessionCount} buổi</span>
                  <span className="truncate rounded-xl border border-brand-red/10 px-2 py-1.5">{klass.startTime}-{klass.endTime}</span>
                </div>
              </button>
              <button
                type="button"
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-brand-red/15 bg-white/55 px-3 py-2 text-xs font-semibold text-brand-red transition hover:bg-white"
                onClick={() => setSelectedTimelineClassId(klass.id)}
              >
                <ChartNoAxesCombined className="h-3.5 w-3.5" />
                Tiến độ lớp
              </button>
            </article>
          )
        }) : (
          <p className="rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500">
            {classes.length ? "Không có lớp phù hợp bộ lọc." : "Chưa có lớp học."}
          </p>
        )}
      </div>
    </div>
  )
}

function CreateClassPanel({
  form,
  setForm,
  activeCourses,
  teacherOptions,
  students,
  addSlot,
  removeSlot,
  createClass,
  canManageSchedule,
  isCreating
}: Pick<
  ClassSetupWorkspaceProps,
  | "form"
  | "setForm"
  | "activeCourses"
  | "teacherOptions"
  | "students"
  | "addSlot"
  | "removeSlot"
  | "createClass"
  | "canManageSchedule"
  | "isCreating"
>) {
  const selectedCourse = activeCourses.find((course) => course.id === form.courseId)
  const selectedTeacher = teacherOptions.find((teacher) => teacher.id === form.teacherId)
  const selectedStudents = students.filter((student) => form.studentIds.includes(student.id))

  return (
    <form className="content-border space-y-5 p-4 sm:p-5" onSubmit={createClass}>
      <div className="flex flex-col gap-3 border-b border-brand-red/10 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-sm font-semibold text-brand-ink">Khởi tạo lớp học</p><p className="mt-1 text-xs text-stone-500">Lịch được sinh từ ngày khai giảng theo các ca học bạn thiết lập.</p></div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold"><span className="rounded-full border border-brand-red/15 px-3 py-1.5 text-brand-red">{form.slots.length} ca/tuần</span><span className="rounded-full border border-brand-red/10 px-3 py-1.5 text-stone-600">{selectedStudents.length} học viên ban đầu</span></div>
      </div>

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.65fr)]">
        <div className="rounded-2xl border border-brand-red/10 bg-white/40 p-4"><div className="flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-full bg-brand-red text-xs font-bold text-white">1</span><p className="text-sm font-semibold text-brand-ink">Khóa và định danh lớp</p></div><div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="block text-sm font-semibold text-stone-700 md:col-span-2">Khóa học<select className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none" value={form.courseId} onChange={(event) => setForm((current) => ({ ...current, courseId: event.target.value }))} required><option value="">Chọn khóa học</option>{activeCourses.map((course) => <option key={course.id} value={course.id}>{course.name} · {subjectLabels[course.subject]} · {course.totalSessions} buổi</option>)}</select></label>
          <label className="block text-sm font-semibold text-stone-700">Tên lớp<input className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ví dụ: Robotics T7-CN 16:30" required /></label>
          <label className="block text-sm font-semibold text-stone-700">Mã lớp<input className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none" value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} placeholder="VD: RO-2026-07" /></label>
        </div></div>
        <aside className="rounded-2xl border border-brand-red/10 bg-[#fffaf7] p-4"><p className="text-xs font-semibold uppercase tracking-wide text-brand-red">Preview khóa</p>{selectedCourse ? <><p className="mt-3 font-semibold text-brand-ink">{selectedCourse.name}</p><p className="mt-1 text-sm text-stone-600">{subjectLabels[selectedCourse.subject]} · {selectedCourse.totalSessions} buổi</p><p className="mt-3 text-xs text-stone-500">Lớp sẽ dùng quy tắc học phí và đánh giá của khóa này.</p></> : <p className="mt-3 text-sm text-stone-500">Chọn khóa để kiểm tra cấu hình trước khi sinh lịch.</p>}</aside>
      </section>

      <section className="rounded-2xl border border-brand-red/10 bg-white/40 p-4"><div className="flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-full bg-brand-red text-xs font-bold text-white">2</span><p className="text-sm font-semibold text-brand-ink">Vận hành lớp</p></div><div className="mt-4 grid gap-3 md:grid-cols-3"><label className="block text-sm font-semibold text-stone-700">Giáo viên<select className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none" value={form.teacherId} onChange={(event) => setForm((current) => ({ ...current, teacherId: event.target.value }))} required><option value="">Chọn giáo viên</option>{teacherOptions.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}</select></label><label className="block text-sm font-semibold text-stone-700">Ngày khai giảng<input className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none" type="date" value={form.startDate} onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))} required /></label><label className="block text-sm font-semibold text-stone-700">Tình trạng khi tạo<select className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none" value={form.isActive ? "active" : "inactive"} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.value === "active" }))}><option value="active">Mở lớp ngay</option><option value="inactive">Lưu bản nháp</option></select></label></div><p className="mt-3 text-xs text-stone-500">{selectedTeacher ? `Giáo viên phụ trách: ${selectedTeacher.name}.` : "Cần phân giáo viên trước khi tạo lớp."}</p></section>

      <section className="rounded-2xl border border-brand-red/10 bg-white/40 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-full bg-brand-red text-xs font-bold text-white">3</span><div><p className="text-sm font-semibold text-brand-ink">Lịch học và số buổi</p><p className="mt-1 text-xs text-stone-500">Mỗi ca tạo một chuỗi buổi lặp cho đến đủ số buổi cần sinh.</p></div></div><button type="button" className="neu-list-item inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold text-brand-red" onClick={addSlot}><Plus className="h-3.5 w-3.5" />Thêm ca học</button></div><div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]"><div className="space-y-2">
          {form.slots.map((slot, index) => (
            <div key={`${slot.weekday}-${index}`} className="grid gap-2 rounded-xl border border-brand-red/10 bg-[#fffaf7] p-3 md:grid-cols-[1fr_1fr_1fr_1fr_auto]">
              <select className="neu-pressed rounded-2xl bg-transparent px-3 py-2 text-sm outline-none" value={slot.weekday} onChange={(event) => setForm((current) => ({ ...current, slots: current.slots.map((item, slotIndex) => (slotIndex === index ? { ...item, weekday: event.target.value } : item)) }))}>
                {weekdayColumns.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.short}
                  </option>
                ))}
              </select>
              <input className="neu-pressed rounded-2xl bg-transparent px-3 py-2 text-sm outline-none" type="time" value={slot.startTime} onChange={(event) => setForm((current) => ({ ...current, slots: current.slots.map((item, slotIndex) => (slotIndex === index ? { ...item, startTime: event.target.value } : item)) }))} required />
              <input className="neu-pressed rounded-2xl bg-transparent px-3 py-2 text-sm outline-none" type="time" value={slot.endTime} onChange={(event) => setForm((current) => ({ ...current, slots: current.slots.map((item, slotIndex) => (slotIndex === index ? { ...item, endTime: event.target.value } : item)) }))} required />
              <input className="neu-pressed rounded-2xl bg-transparent px-3 py-2 text-sm outline-none" placeholder="Phòng" value={slot.room} onChange={(event) => setForm((current) => ({ ...current, slots: current.slots.map((item, slotIndex) => (slotIndex === index ? { ...item, room: event.target.value } : item)) }))} />
              <button type="button" className="neu-list-item rounded-2xl px-3 py-2 text-xs font-semibold text-brand-red disabled:opacity-40" disabled={form.slots.length === 1} onClick={() => removeSlot(index)}>
                Xóa
              </button>
            </div>
          ))}
        </div><label className="block text-sm font-semibold text-stone-700">Tổng buổi cần sinh<input className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none" type="number" min="1" max="200" value={form.plannedSessions} onChange={(event) => setForm((current) => ({ ...current, plannedSessions: event.target.value }))} required /><span className="mt-2 block text-xs font-normal text-stone-500">Mặc định theo khóa: {selectedCourse?.totalSessions ?? "-"} buổi.</span></label></div></section>

      <section className="rounded-2xl border border-brand-red/10 bg-white/40 p-4"><div className="flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-full bg-brand-red text-xs font-bold text-white">4</span><div><p className="text-sm font-semibold text-brand-ink">Học viên ban đầu <span className="font-normal text-stone-500">(có thể thêm sau)</span></p><p className="mt-1 text-xs text-stone-500">Chỉ chọn những bé đã ghi danh đúng khóa; roster có thể cập nhật từ Quản lý lớp sau khi tạo.</p></div></div><div className="mt-4 grid max-h-56 gap-2 overflow-auto rounded-2xl border border-brand-red/10 p-3 md:grid-cols-2 xl:grid-cols-3">
          {students.length ? (
            students.map((student) => (
              <label key={student.id} className="neu-list-item flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2 text-sm text-stone-700">
                <input
                  type="checkbox"
                  checked={form.studentIds.includes(student.id)}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      studentIds: event.target.checked
                        ? [...current.studentIds, student.id]
                        : current.studentIds.filter((studentId) => studentId !== student.id)
                    }))
                  }
                />
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-brand-ink">{student.name}</span>
                  <span className="block truncate text-xs text-stone-500">{student.parentName} - {student.parentPhone}</span>
                </span>
              </label>
            ))
          ) : (
            <p className="text-sm text-stone-500">Chưa có học sinh để chọn.</p>
          )}
        </div></section>
      <div className="flex flex-col gap-3 border-t border-brand-red/10 pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-stone-500">{form.isActive ? "Lớp mở ngay sau khi tạo; lịch sẽ sẵn sàng cho điểm danh." : "Bản nháp không xuất hiện trong lịch vận hành cho đến khi được mở."}</p><button type="submit" disabled={!canManageSchedule || isCreating || !form.courseId || !form.teacherId || !form.slots.length} className="glass-button-primary inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">
        <CalendarDays className="h-4 w-4" />
        {isCreating ? "Đang sinh lịch" : "Tạo lớp và sinh thời khóa biểu"}
      </button></div>
    </form>
  )
}

function ScheduleEventsPanel({
  scheduleEvents,
  selectedYear,
  canManageSchedule,
  isSaving,
  importVietnamHolidays,
  setIsEventDialogOpen,
  deleteScheduleEvent
}: Pick<
  ClassSetupWorkspaceProps,
  | "scheduleEvents"
  | "selectedYear"
  | "canManageSchedule"
  | "isSaving"
  | "importVietnamHolidays"
  | "setIsEventDialogOpen"
  | "deleteScheduleEvent"
>) {
  return (
    <section className="content-border space-y-4 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-brand-ink">Lịch nghỉ lễ / sự kiện</p>
          <p className="mt-1 text-xs text-stone-500">Ngày có bật tự động chuyển lịch sẽ chuyển các buổi học chưa điểm danh sang ngày học kế tiếp.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!canManageSchedule || isSaving === "vietnam-holidays"}
            className="glass-button-secondary inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold disabled:opacity-60"
            onClick={() => void importVietnamHolidays()}
          >
            <CalendarDays className="h-4 w-4" />
            {isSaving === "vietnam-holidays" ? "Đang nạp" : `Nạp lễ/sự kiện VN ${selectedYear}`}
          </button>
          <button
            type="button"
            disabled={!canManageSchedule}
            className="glass-button-primary inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold disabled:opacity-60"
            onClick={() => setIsEventDialogOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Thêm lịch nghỉ
          </button>
        </div>
      </div>
      <div>
        <div className="grid max-h-[42vh] gap-2 overflow-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
          {scheduleEvents.length ? (
            scheduleEvents.map((event) => (
              <div key={event.id} className="neu-list-item flex items-center justify-between gap-3 rounded-2xl px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-brand-ink">{event.title}</p>
                  <p className="truncate text-xs text-stone-500">
                    {event.date.slice(0, 10)} - {scheduleEventTypeLabels[event.type]}
                    {event.affectsScheduling ? " - tự chuyển lịch" : ""}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!canManageSchedule || isSaving === event.id}
                  className="rounded-xl border border-brand-red/15 p-2 text-brand-red disabled:opacity-50"
                  onClick={() => void deleteScheduleEvent(event.id)}
                  aria-label="Xóa lịch nghỉ"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          ) : (
            <p className="rounded-2xl border border-brand-red/10 p-3 text-sm text-stone-500">Chưa có lịch nghỉ/sự kiện trong tháng.</p>
          )}
        </div>
      </div>
    </section>
  )
}
