import { BarChart3, CalendarClock, CheckCircle2, ClipboardCheck, KeyRound, Phone, RotateCcw, Save, ShieldCheck } from "lucide-react"
import type { FormEvent } from "react"
import { subjectLabels } from "@/lib/contracts/assessment"
import { contactResultLabels, taskStatusLabels, type ContactResultKey } from "@/lib/contracts/crm"
import type { StudentDetail, StudentStatusKey } from "@/lib/contracts/students"
import {
  assessmentProgressPercent,
  contactResults,
  studentStatusOptions,
  timelineStatusLabel,
  timelineTypeLabel,
  usesTemporaryParentPassword,
  type LearningDetailTarget,
  type ParentAccountAction
} from "./student-detail-utils"
import { DetailInput, EmptyState, FormFooter, InfoCard, InfoPill, ListCard, SectionHeader } from "./student-detail-presentational"
import { formatAge } from "./student-detail-format"

export function StudentOverviewTab({
  student,
  profileAddress,
  profileBirthDate,
  profileHealthNote,
  profileLeadNote,
  profileLeadSource,
  profileName,
  profileParentEmail,
  profileParentName,
  profileParentPhone,
  profileStatus,
  isSavingProfile,
  onSubmit,
  setProfileAddress,
  setProfileBirthDate,
  setProfileHealthNote,
  setProfileLeadNote,
  setProfileLeadSource,
  setProfileName,
  setProfileParentEmail,
  setProfileParentName,
  setProfileParentPhone,
  setProfileStatus
}: {
  student: StudentDetail
  profileAddress: string
  profileBirthDate: string
  profileHealthNote: string
  profileLeadNote: string
  profileLeadSource: string
  profileName: string
  profileParentEmail: string
  profileParentName: string
  profileParentPhone: string
  profileStatus: StudentStatusKey
  isSavingProfile: boolean
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  setProfileAddress: (value: string) => void
  setProfileBirthDate: (value: string) => void
  setProfileHealthNote: (value: string) => void
  setProfileLeadNote: (value: string) => void
  setProfileLeadSource: (value: string) => void
  setProfileName: (value: string) => void
  setProfileParentEmail: (value: string) => void
  setProfileParentName: (value: string) => void
  setProfileParentPhone: (value: string) => void
  setProfileStatus: (value: StudentStatusKey) => void
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-[1.25fr_0.9fr]">
      <form className="neu-card rounded-3xl" onSubmit={onSubmit}>
        <div className="p-5">
          <h2 className="font-semibold text-brand-ink">Cập nhật hồ sơ</h2>
          <p className="mt-1 text-sm text-stone-500">Thông tin cốt lõi, trạng thái CRM và ghi chú vận hành.</p>
        </div>
        <div className="content-border grid gap-4 p-5 md:grid-cols-2">
          <DetailInput label="Tên học viên" value={profileName} onChange={setProfileName} required />
          <label className="block text-sm font-semibold text-stone-700">
            Ngày sinh
            <input className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none" type="date" value={profileBirthDate} onChange={(event) => setProfileBirthDate(event.target.value)} />
            <span className="mt-2 block text-xs font-medium text-stone-500">Độ tuổi hiện tại: {formatAge(profileBirthDate)}</span>
          </label>
          <label className="block text-sm font-semibold text-stone-700">
            Trạng thái
            <select className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none" value={profileStatus} onChange={(event) => setProfileStatus(event.target.value as StudentStatusKey)}>
              {studentStatusOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <DetailInput label="Nguồn lead" value={profileLeadSource} onChange={setProfileLeadSource} />
          <DetailInput label="Tên phụ huynh" value={profileParentName} onChange={setProfileParentName} required />
          <DetailInput label="Số điện thoại phụ huynh" value={profileParentPhone} onChange={setProfileParentPhone} required />
          <DetailInput label="Email phụ huynh" type="email" value={profileParentEmail} onChange={setProfileParentEmail} />
          <DetailInput label="Địa chỉ" value={profileAddress} onChange={setProfileAddress} />
          <label className="block text-sm font-semibold text-stone-700 md:col-span-2">
            Ghi chú lead
            <textarea className="neu-pressed mt-2 min-h-24 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none placeholder:text-stone-400" value={profileLeadNote} onChange={(event) => setProfileLeadNote(event.target.value)} />
          </label>
          <label className="block text-sm font-semibold text-stone-700 md:col-span-2">
            Lưu ý sức khỏe / đặc biệt
            <textarea className="neu-pressed mt-2 min-h-24 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none placeholder:text-stone-400" value={profileHealthNote} onChange={(event) => setProfileHealthNote(event.target.value)} />
          </label>
        </div>
        <div className="flex justify-end p-5">
          <button type="submit" disabled={isSavingProfile} className="glass-button-primary inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">
            <Save className="h-4 w-4" />
            {isSavingProfile ? "Đang lưu" : "Lưu hồ sơ"}
          </button>
        </div>
      </form>
      <div className="space-y-4">
        <InfoCard title="Thông tin phụ huynh" items={[student.parentName, student.parentPhone, student.parentEmail ?? "Chưa có email", student.address ?? "Chưa có địa chỉ"]} />
        <InfoCard title="Học tập" items={[`Còn ${student.sessionsRemaining} buổi`, student.assignedTeacherName ?? "Chưa phân giáo viên", student.leadSource ?? "Chưa có nguồn lead"]} />
        <InfoCard title="Ghi chú" items={[student.leadNote ?? "Chưa có ghi chú lead", student.healthNote ?? "Chưa có lưu ý sức khỏe"]} />
      </div>
    </section>
  )
}

export function StudentCrmTab({
  student,
  content,
  isSubmittingLog,
  isSubmittingTask,
  result,
  savingTaskId,
  taskDueDate,
  taskNote,
  taskTitle,
  formatDate,
  markTaskDone,
  setContent,
  setResult,
  setTaskDueDate,
  setTaskNote,
  setTaskTitle,
  submitContactLog,
  submitTask
}: {
  student: StudentDetail
  content: string
  isSubmittingLog: boolean
  isSubmittingTask: boolean
  result: ContactResultKey
  savingTaskId: string | null
  taskDueDate: string
  taskNote: string
  taskTitle: string
  formatDate: (value: string) => string
  markTaskDone: (taskId: string) => void
  setContent: (value: string) => void
  setResult: (value: ContactResultKey) => void
  setTaskDueDate: (value: string) => void
  setTaskNote: (value: string) => void
  setTaskTitle: (value: string) => void
  submitContactLog: (event: FormEvent<HTMLFormElement>) => void
  submitTask: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-[1fr_1.15fr]">
      <div className="space-y-4">
        <form className="neu-card rounded-3xl" onSubmit={submitContactLog}>
          <SectionHeader title="Ghi lịch sử liên hệ" description="Lưu nội dung trao đổi với phụ huynh." />
          <div className="content-border space-y-3 p-5">
            <select className="neu-pressed w-full rounded-2xl bg-transparent px-4 py-3 text-sm font-medium text-brand-ink outline-none" value={result} onChange={(event) => setResult(event.target.value as ContactResultKey)}>
              {contactResults.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
            <textarea className="neu-pressed min-h-28 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none placeholder:text-stone-400" value={content} onChange={(event) => setContent(event.target.value)} placeholder="Nội dung cuộc gọi, tin nhắn, kết luận tiếp theo..." required />
          </div>
          <FormFooter loading={isSubmittingLog} label="Lưu liên hệ" loadingLabel="Đang lưu" />
        </form>
        <form className="neu-card rounded-3xl" onSubmit={submitTask}>
          <SectionHeader title="Tạo task follow-up" description="Task mới sẽ gán cho người đang đăng nhập." />
          <div className="content-border space-y-3 p-5">
            <input className="neu-pressed w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none placeholder:text-stone-400" value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Tiêu đề task" required />
            <input className="neu-pressed w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none" type="date" value={taskDueDate} onChange={(event) => setTaskDueDate(event.target.value)} required />
            <textarea className="neu-pressed min-h-20 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none placeholder:text-stone-400" value={taskNote} onChange={(event) => setTaskNote(event.target.value)} placeholder="Ghi chú xử lý..." />
          </div>
          <FormFooter loading={isSubmittingTask} label="Tạo task" loadingLabel="Đang tạo" />
        </form>
      </div>
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-1">
        <ListCard title="Lịch sử liên hệ" count={`${student.contactLogs.length} lần`}>
          {student.contactLogs.length ? student.contactLogs.map((log) => (
            <article key={log.id} className="neu-list-item rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-brand-ink">{contactResultLabels[log.result]}</p>
                <p className="text-xs text-stone-500">{formatDate(log.createdAt)}</p>
              </div>
              <p className="mt-2 text-sm text-stone-600">{log.content}</p>
              <p className="mt-3 inline-flex items-center gap-1 text-xs text-stone-500"><Phone className="h-3.5 w-3.5" />{log.loggedByName}</p>
            </article>
          )) : <EmptyState text="Chưa có lịch sử liên hệ." />}
        </ListCard>
        <ListCard title="Task liên quan" count={`${student.tasks.length} task`}>
          {student.tasks.length ? student.tasks.map((task) => (
            <article key={task.id} className="neu-list-item rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-brand-ink">{task.title}</p>
                  <p className="mt-1 text-xs text-stone-500">{task.note ?? "Không có ghi chú."}</p>
                </div>
                <p className="text-xs font-semibold text-brand-red">{taskStatusLabels[task.status]}</p>
              </div>
              <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className="text-xs text-stone-500">{task.assignedToName} · hạn {formatDate(task.dueDate)}</p>
                {task.status !== "DONE" ? (
                  <button type="button" disabled={savingTaskId === task.id} onClick={() => markTaskDone(task.id)} className="neu-list-item inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold text-stone-600 hover:text-brand-red disabled:cursor-not-allowed disabled:opacity-60">
                    <CheckCircle2 className="h-4 w-4" />
                    {savingTaskId === task.id ? "Đang lưu" : "Hoàn thành"}
                  </button>
                ) : null}
              </div>
            </article>
          )) : <EmptyState text="Chưa có task." />}
        </ListCard>
      </div>
    </section>
  )
}

export function StudentLearningTab({
  student,
  formatDate,
  formatWeekday,
  setSelectedLearningDetail
}: {
  student: StudentDetail
  formatDate: (value: string) => string
  formatWeekday: (weekday: number) => string
  setSelectedLearningDetail: (target: LearningDetailTarget) => void
}) {
  return (
    <section className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <ListCard title="Khóa học / quỹ buổi" count={`${student.sessionsRemaining} buổi còn lại`}>
          {student.courses.length ? student.courses.map((course) => (
            <button key={course.enrollmentId} type="button" className="neu-list-item w-full rounded-2xl p-4 text-left transition hover:shadow-md" onClick={() => setSelectedLearningDetail({ kind: "course", course })}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-brand-ink">{course.courseName}</p>
                  <p className="mt-1 text-xs text-stone-500">{course.courseSubject}{course.classProgress ? ` · ${course.classProgress.label}` : ""}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-brand-red">{course.sessionsRemaining} buổi</p>
                  {!course.isActive ? <p className="mt-1 rounded-full border border-brand-red/15 px-2 py-1 text-[11px] font-semibold text-stone-500">Đã hủy</p> : null}
                </div>
              </div>
              <p className="mt-3 text-xs text-stone-500">Đã dùng {course.sessionsUsed}/{course.sessionsBought} buổi</p>
            </button>
          )) : <EmptyState text="Chưa đăng ký khóa học." />}
        </ListCard>
        <ListCard title="Lớp đang tham gia" count={`${student.classes.length} lớp`}>
          {student.classes.length ? student.classes.map((klass) => (
            <button key={klass.id} type="button" className="neu-list-item w-full rounded-2xl p-4 text-left transition hover:shadow-md" onClick={() => setSelectedLearningDetail({ kind: "class", klass })}>
              <p className="text-sm font-semibold text-brand-ink">{klass.name}</p>
              <p className="mt-1 text-xs text-stone-500">{klass.courseName} · GV {klass.teacherName}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />{formatWeekday(klass.weekday)}, {klass.startTime}-{klass.endTime}</span>
                {klass.progress ? <span className="rounded-full border border-brand-red/15 px-2 py-1 font-semibold text-brand-red">{klass.progress.label}</span> : null}
              </div>
            </button>
          )) : <EmptyState text="Chưa xếp lớp." />}
        </ListCard>
      </div>
      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <ListCard title="Tiến độ đánh giá" count={`${student.assessmentProgress.length} khóa`}>
          {student.assessmentProgress.length ? student.assessmentProgress.map((progress) => {
            const percent = assessmentProgressPercent(progress)

            return (
              <article key={progress.enrollmentId} className="neu-list-item rounded-2xl p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-brand-ink">{progress.courseName}</p>
                    <p className="mt-1 text-xs text-stone-500">{subjectLabels[progress.subject]} · {progress.completedWeeks}/{progress.totalWeeks} tuần hoàn thành</p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full border border-brand-red/15 px-3 py-1 text-xs font-semibold text-brand-red">
                    <BarChart3 className="h-3.5 w-3.5" />
                    {percent}%
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-brand-red/10">
                  <div className="h-full rounded-full bg-brand-red" style={{ width: `${percent}%` }} />
                </div>
                <div className="mt-3 grid gap-2 text-xs text-stone-500 md:grid-cols-3">
                  <span>Tuần mới nhất: {progress.latestWeek ? `Tuần ${progress.latestWeek}` : "Chưa có"}</span>
                  <span>Checklist: {progress.checkedItems}/{progress.totalItems || 0}</span>
                  <span>{progress.finalAssessmentId ? `Cuối khóa: ${progress.finalCreatedAt ? formatDate(progress.finalCreatedAt) : "Đã có"}` : "Chưa có cuối khóa"}</span>
                </div>
              </article>
            )
          }) : <EmptyState text="Chưa có dữ liệu đánh giá." />}
        </ListCard>
        <ListCard title="Timeline học tập" count={`${student.learningTimeline.length} mốc`}>
          {student.learningTimeline.length ? student.learningTimeline.map((item) => {
            const statusLabel = timelineStatusLabel(item)

            return (
              <article key={item.id} className="neu-list-item rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full border border-brand-red/15 px-2 py-1 text-[11px] font-semibold text-brand-red">
                        <ClipboardCheck className="h-3.5 w-3.5" />
                        {timelineTypeLabel(item.type)}
                      </span>
                      {item.subject ? <span className="rounded-full border border-brand-red/10 px-2 py-1 text-[11px] font-semibold text-stone-500">{subjectLabels[item.subject]}</span> : null}
                      {statusLabel ? <span className="rounded-full border border-brand-red/10 px-2 py-1 text-[11px] font-semibold text-stone-500">{statusLabel}</span> : null}
                    </div>
                    <p className="mt-2 text-sm font-semibold text-brand-ink">{item.title}</p>
                    {item.description ? <p className="mt-1 line-clamp-2 text-xs text-stone-500">{item.description}</p> : null}
                    {item.meta ? <p className="mt-2 text-xs font-semibold text-stone-500">{item.meta}</p> : null}
                  </div>
                  <p className="shrink-0 text-xs text-stone-500">{formatDate(item.date)}</p>
                </div>
              </article>
            )
          }) : <EmptyState text="Chưa có timeline học tập." />}
        </ListCard>
      </div>
    </section>
  )
}

export function ParentAccountTab({
  student,
  isUpdatingParentAccount,
  temporaryParentPassword,
  updateParentAccount
}: {
  student: StudentDetail
  isUpdatingParentAccount: boolean
  temporaryParentPassword: string | null
  updateParentAccount: (action: ParentAccountAction) => void
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
      <div className="neu-card rounded-3xl p-5">
        <div className="flex items-start gap-4">
          <div className="neu-pressed flex h-12 w-12 items-center justify-center rounded-2xl">
            <KeyRound className="h-6 w-6 text-brand-red" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-red">Parent account</p>
            <h2 className="mt-1 text-2xl font-semibold text-brand-ink">{student.parentAccount.canLogin ? "Đã kích hoạt" : "Chưa kích hoạt"}</h2>
            <p className="mt-2 text-sm text-stone-600">Phụ huynh đăng nhập ở `/login`, hệ thống tự chuyển sang cổng phụ huynh.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <InfoPill label="Số điện thoại đăng nhập" value={student.parentAccount.phone} />
          <InfoPill label="Email" value={student.parentAccount.email ?? "Chưa có email"} />
          <InfoPill label="Trạng thái" value={student.parentAccount.isActive ? "Active" : "Inactive"} />
          <InfoPill label="Mật khẩu phụ huynh" value={usesTemporaryParentPassword ? "Tạm thời khi reset" : "SĐT phụ huynh"} />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" disabled={isUpdatingParentAccount || student.parentAccount.canLogin} onClick={() => updateParentAccount("activate")} className="glass-button-primary inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">
            <ShieldCheck className="h-4 w-4" />
            Kích hoạt tài khoản
          </button>
          <button type="button" disabled={isUpdatingParentAccount} onClick={() => updateParentAccount("reset_default_password")} className="glass-button-secondary inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold">
            <RotateCcw className="h-4 w-4" />
            Đặt lại mật khẩu
          </button>
        </div>
      </div>
      <div className="neu-card rounded-3xl p-5">
        <h2 className="font-semibold text-brand-ink">Hướng dẫn gửi phụ huynh</h2>
        <div className="mt-4 rounded-2xl border border-brand-red/10 bg-white/45 p-4 text-sm text-stone-700">
          <p>Link: http://localhost:3000/login</p>
          <p className="mt-2">Số điện thoại: {student.parentAccount.phone}</p>
          <p>
            Mật khẩu:{" "}
            {temporaryParentPassword ?? (usesTemporaryParentPassword ? "bấm đặt lại mật khẩu để tạo mã tạm thời" : "số điện thoại phụ huynh")}
          </p>
          <p className="mt-2 text-xs text-stone-500">Khi account active, phụ huynh đăng nhập sẽ được chuyển thẳng sang `/parent`.</p>
        </div>
      </div>
    </section>
  )
}
