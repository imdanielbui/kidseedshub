"use client"

import { DialogShell } from "@/components/shared/dialog-shell"
import { subjectLabels } from "@/lib/contracts/assessment"
import type { ClassListItem, ClassStudentItem } from "@/lib/contracts/courses"
import type { StudentListItem } from "@/lib/contracts/students"
import { ClassMetric, weekdayColumns } from "./class-schedule-utils"

type ManagedClassDialogProps = {
  selectedManagedClass: ClassListItem
  selectedManagedClassStudents: ClassStudentItem[]
  availableStudentsForManagedClass: StudentListItem[]
  canManageSchedule: boolean
  isSaving: string | null
  panelClassName: string
  onClose: () => void
  patchClass: (classId: string, body: { isActive?: boolean }) => Promise<void>
  updateClassStudents: (classId: string, studentIds: string[]) => Promise<void>
}

export function ManagedClassDialog({
  selectedManagedClass,
  selectedManagedClassStudents,
  availableStudentsForManagedClass,
  canManageSchedule,
  isSaving,
  panelClassName,
  onClose,
  patchClass,
  updateClassStudents
}: ManagedClassDialogProps) {
  return (
    <DialogShell
      eyebrow="Quản lý lớp học"
      title={selectedManagedClass.name}
      description={`Khóa: ${selectedManagedClass.courseName} - ${subjectLabels[selectedManagedClass.subject]} - GV ${selectedManagedClass.teacherName}`}
      onClose={onClose}
      closeLabel="Đóng quản lý lớp"
      size="xl"
      panelClassName={panelClassName}
      bodyClassName="bg-[#fffaf7] p-0"
    >
      <div className="content-border grid gap-3 p-5 md:grid-cols-3 xl:grid-cols-4">
        <ClassMetric label="Khóa học" value={selectedManagedClass.courseName} />
        <ClassMetric label="Mã lớp học" value={selectedManagedClass.code ?? "Chưa có"} />
        <ClassMetric label="Môn học" value={subjectLabels[selectedManagedClass.subject]} />
        <ClassMetric label="Giáo viên" value={selectedManagedClass.teacherName} />
        <ClassMetric label="Trạng thái" value={selectedManagedClass.isActive ? "Đang mở" : "Tạm tắt"} />
        <ClassMetric label="Học sinh active" value={`${selectedManagedClassStudents.length}`} />
        <ClassMetric label="Buổi đã sinh" value={`${selectedManagedClass.generatedSessionCount}`} />
        <ClassMetric label="Ngày bắt đầu" value={selectedManagedClass.startDate?.slice(0, 10) ?? "Chưa có"} />
        <ClassMetric label="Số buổi dự kiến" value={`${selectedManagedClass.plannedSessions ?? "-"} buổi`} />
      </div>

      <div className="grid gap-4 p-5 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-2xl border border-brand-red/10 bg-white/45 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-brand-ink">Lịch lặp</p>
              <p className="mt-1 text-xs text-stone-500">Các ngày dùng để sinh thời khóa biểu.</p>
            </div>
            <button
              type="button"
              disabled={!canManageSchedule || isSaving === selectedManagedClass.id}
              className="rounded-2xl border border-brand-red/20 px-3 py-2 text-xs font-semibold text-brand-red disabled:opacity-50"
              onClick={() => void patchClass(selectedManagedClass.id, { isActive: !selectedManagedClass.isActive })}
            >
              {selectedManagedClass.isActive ? "Tạm tắt lớp" : "Mở lại lớp"}
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {selectedManagedClass.scheduleSlots.length ? selectedManagedClass.scheduleSlots.map((slot) => (
              <div key={slot.id} className="rounded-2xl border border-brand-red/10 px-3 py-2 text-sm text-stone-600">
                {weekdayColumns.find((day) => day.value === slot.weekday)?.label ?? `Thứ ${slot.weekday}`} · {slot.startTime}-{slot.endTime}
                {slot.room ? ` · ${slot.room}` : ""}
              </div>
            )) : (
              <p className="rounded-2xl border border-brand-red/10 p-3 text-sm text-stone-500">Chưa có lịch lặp.</p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-brand-red/10 bg-white/45 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-brand-ink">Học sinh trong lớp</p>
              <p className="mt-1 text-xs text-stone-500">Roster active dùng cho điểm danh và cổng phụ huynh.</p>
            </div>
            <select
              className="neu-pressed rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none disabled:opacity-50"
              disabled={!canManageSchedule}
              defaultValue=""
              onChange={(event) => {
                if (!event.target.value) return
                void updateClassStudents(selectedManagedClass.id, [
                  ...selectedManagedClassStudents.map((student) => student.studentId),
                  event.target.value
                ])
                event.target.value = ""
              }}
            >
              <option value="">Thêm học sinh</option>
              {availableStudentsForManagedClass
                .filter((student) => !selectedManagedClassStudents.some((item) => item.studentId === student.id))
                .map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name} - {student.parentName}
                  </option>
                ))}
            </select>
          </div>
          <div className="mt-3 max-h-72 space-y-2 overflow-auto">
            {selectedManagedClassStudents.length ? selectedManagedClassStudents.map((student) => (
              <div key={student.id} className="neu-list-item flex items-center justify-between gap-3 rounded-2xl px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-brand-ink">{student.studentName}</p>
                  <p className="truncate text-xs text-stone-500">
                    {student.parentName} - {student.parentPhone}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!canManageSchedule || isSaving === selectedManagedClass.id}
                  className="rounded-xl border border-brand-red/15 px-3 py-2 text-xs font-semibold text-brand-red disabled:opacity-50"
                  onClick={() =>
                    void updateClassStudents(
                      selectedManagedClass.id,
                      selectedManagedClassStudents.filter((item) => item.studentId !== student.studentId).map((item) => item.studentId)
                    )
                  }
                >
                  Xóa
                </button>
              </div>
            )) : (
              <p className="rounded-2xl border border-brand-red/10 p-3 text-sm text-stone-500">Lớp này chưa có học sinh active.</p>
            )}
          </div>
        </section>
      </div>
    </DialogShell>
  )
}
