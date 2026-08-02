"use client"

import { Star } from "lucide-react"
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from "recharts"
import { assessmentItemScore, averageScore, skillDescriptionForAge, skillScoreComment } from "@/lib/assessment-scoring"
import {
  assessmentStatusLabels,
  progressLevelDescriptions,
  progressLevelLabels,
  subjectLabels,
  type AssessmentStatusKey,
  type ProgressLevelKey,
  type WeeklyAssessmentMatrixItem,
  type WeeklyClassAssessmentDetail
} from "@/lib/contracts/assessment"

export type AssessmentWorkspaceTab = "score" | "notes" | "summary"

function itemKey(item: { domainKey: string; skillKey: string; outcomeIndex: number }) {
  return `${item.domainKey}:${item.skillKey}:${item.outcomeIndex}`
}

function scoreOutOfFive(items: WeeklyAssessmentMatrixItem["items"]) {
  return averageScore(items)
}

function formatScore(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

export function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-brand-red/10 bg-white/40 px-3 py-2">
      <p className="text-lg font-semibold text-brand-red">{value}</p>
      <p className="text-stone-500">{label}</p>
    </div>
  )
}

export function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-brand-red/10 bg-white/35 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">{label}</p>
      <p className="mt-1 truncate font-semibold text-brand-ink">{value}</p>
    </div>
  )
}

export function ClassSkillComparisonPanel({ detail }: { detail: WeeklyClassAssessmentDetail | null }) {
  const rows = detail ? [...detail.skillComparison].sort((first, second) => second.averageScore - first.averageScore || second.completionRate - first.completionRate) : []
  const observedRows = rows.filter((row) => row.checkedStudents > 0)

  return (
    <section className="neu-card rounded-3xl p-5">
      <h2 className="font-semibold text-brand-ink">So sánh kỹ năng lớp</h2>
      <p className="mt-1 text-sm text-stone-500">
        {detail ? `${detail.className} - tuần ${detail.weekNumber}` : "Chọn lớp để xem điểm trung bình theo kỹ năng."}
      </p>
      {detail && observedRows.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-brand-red/10 bg-white/45 px-3 py-2 text-xs text-stone-500">
          Tuần này chưa có kỹ năng nào được chấm cho lớp.
        </p>
      ) : null}
      {observedRows.length > 0 ? (
        <div className="mt-4 max-h-[420px] space-y-3 overflow-auto pr-1">
          {rows.map((row) => {
            const scoreWidth = `${Math.min(100, Math.max(0, (row.averageScore / 5) * 100))}%`

            return (
              <article key={`${row.domainKey}:${row.skillKey}`} className="rounded-2xl border border-brand-red/10 bg-white/40 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-brand-ink">{row.skillLabel}</p>
                    <p className="mt-1 text-xs text-stone-500">
                      {row.domainLabel} · {row.checkedStudents}/{row.totalStudents} HS · {row.completionRate}%
                    </p>
                  </div>
                  <span className="rounded-full border border-brand-red/10 bg-white/70 px-2 py-1 text-xs font-semibold text-brand-red">
                    {formatScore(row.averageScore)}/5
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-200">
                  <span className="block h-full rounded-full bg-brand-red" style={{ width: scoreWidth }} />
                </div>
                <p className="mt-2 text-[11px] font-semibold text-stone-400">
                  {row.checkedItems}/{row.totalItems} dòng kỹ năng đã có dữ liệu
                </p>
              </article>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}

function AssessmentTabs({
  activeTab,
  onChangeTab,
  summaryLabel
}: {
  activeTab: AssessmentWorkspaceTab
  onChangeTab: (tab: AssessmentWorkspaceTab) => void
  summaryLabel: string
}) {
  const tabs: Array<{ key: AssessmentWorkspaceTab; label: string }> = [
    { key: "score", label: "Chấm nhanh" },
    { key: "notes", label: "Nhận xét" },
    { key: "summary", label: summaryLabel }
  ]

  return (
    <div className="mt-3 grid gap-2 rounded-3xl border border-brand-red/10 bg-white/40 p-1.5 sm:grid-cols-3">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={`rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
            activeTab === tab.key
              ? "bg-brand-red text-white shadow-[0_10px_24px_rgba(165,36,39,0.18)]"
              : "text-brand-red hover:bg-white/70"
          }`}
          onClick={() => onChangeTab(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

function AssessmentStudentRail({
  detail,
  selectedStudentId,
  onSelectStudent
}: {
  detail: WeeklyClassAssessmentDetail
  selectedStudentId: string
  onSelectStudent: (studentId: string) => void
}) {
  return (
    <aside className="rounded-3xl border border-brand-red/10 bg-white/35 p-3">
      <p className="px-2 text-xs font-semibold uppercase tracking-wide text-brand-red">Học sinh {subjectLabels[detail.subject]}</p>
      <div className="mt-3 max-h-[520px] space-y-2 overflow-auto pr-1">
        {detail.students.map((item) => {
          const isSelected = item.studentId === selectedStudentId
          const completedDomains = item.domainProgress.filter((domain) => domain.status === "COMPLETE").length
          const average = scoreOutOfFive(item.items)

          return (
            <button
              key={item.studentId}
              type="button"
              className={`w-full rounded-2xl border p-3 text-left transition ${isSelected ? "border-brand-red bg-white/70" : "border-brand-red/10 bg-white/35 hover:border-brand-red/30 hover:bg-white/55"}`}
              onClick={() => onSelectStudent(item.studentId)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-brand-ink">{item.studentName}</p>
                  <p className="mt-1 truncate text-xs text-stone-500">{item.parentName}</p>
                  {item.healthNote ? (
                    <p className="mt-2 rounded-2xl border border-brand-red/10 bg-white/60 px-2 py-1.5 text-[11px] font-semibold text-brand-red">
                      Lưu ý: {item.healthNote}
                    </p>
                  ) : null}
                </div>
                <span className="rounded-full border border-brand-red/10 bg-white/60 px-2 py-1 text-[11px] font-semibold text-brand-red">
                  {detail.subject === "FUN" ? `${completedDomains}/${item.domainProgress.length}` : `${formatScore(average)}/5`}
                </span>
              </div>
              <p className="mt-2 text-xs text-stone-500">
                {detail.subject === "FUN" ? `${item.checkedItems}/${item.totalItems} milestone` : `${item.checkedItems}/${item.totalItems} kỹ năng`} · {assessmentStatusLabels[item.status]}
              </p>
            </button>
          )
        })}
      </div>
    </aside>
  )
}

export function FunAssessmentWorkspace({
  detail,
  selectedStudentId,
  selectedDomainKey,
  onSelectStudent,
  onSelectDomain,
  onUpdateComment,
  onUpdateStatus,
  onUpdateItem,
  activeTab,
  onChangeTab
}: {
  detail: WeeklyClassAssessmentDetail
  selectedStudentId: string | null
  selectedDomainKey: string | null
  onSelectStudent: (studentId: string) => void
  onSelectDomain: (domainKey: string) => void
  onUpdateComment: (studentId: string, comment: string) => void
  onUpdateStatus: (studentId: string, status: AssessmentStatusKey) => void
  onUpdateItem: (studentId: string, targetKey: string, updates: Partial<WeeklyAssessmentMatrixItem["items"][number]>) => void
  activeTab: AssessmentWorkspaceTab
  onChangeTab: (tab: AssessmentWorkspaceTab) => void
}) {
  const student = detail.students.find((item) => item.studentId === selectedStudentId) ?? detail.students[0]

  if (!student) {
    return <p className="rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500">Lớp FUN này chưa có học sinh để đánh giá.</p>
  }

  const selectedDomain = detail.rubric.domains.find((domain) => domain.key === selectedDomainKey) ?? detail.rubric.domains[0]
  const selectedProgress = student.domainProgress.find((domain) => domain.domainKey === selectedDomain?.key)
  const canEvaluate = Boolean(student.enrollmentId && student.canEvaluate)

  if (!selectedDomain) {
    return <p className="rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500">Rubric FUN chưa có domain active.</p>
  }

  return (
    <div className="grid items-start gap-3 xl:grid-cols-[220px_minmax(0,1fr)]">
      <AssessmentStudentRail detail={detail} selectedStudentId={student.studentId} onSelectStudent={onSelectStudent} />

      <section className="min-w-0 overflow-hidden rounded-3xl border border-brand-red/10 bg-white/35">
        <div className="shrink-0 border-b border-brand-red/10 p-4">
          <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-start">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-red">FUN weekly observation - tuần {detail.weekNumber}</p>
              <h3 className="mt-1 text-xl font-semibold text-brand-ink">{student.studentName}</h3>
              <p className="mt-1 text-sm text-stone-500">
                {detail.className} · {selectedProgress?.checkedItems ?? 0}/{selectedProgress?.totalItems ?? 0} milestone trong domain đang chọn
              </p>
              {!canEvaluate ? <p className="mt-2 text-xs font-semibold text-stone-500">Không có quan sát trong tuần này vì học viên vắng cả các buổi học.</p> : null}
              {student.healthNote ? (
                <p className="mt-2 rounded-2xl border border-brand-red/10 bg-white/55 px-3 py-2 text-xs font-semibold text-brand-red">
                  Lưu ý sức khỏe: {student.healthNote}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end">
              <select
                aria-label="Trạng thái đánh giá"
                className="rounded-2xl border border-brand-red/10 bg-white/60 px-3 py-2 text-xs font-semibold text-brand-ink outline-none"
                value={student.status}
                disabled={!canEvaluate}
                onChange={(event) => onUpdateStatus(student.studentId, event.target.value as AssessmentStatusKey)}
              >
                {Object.entries(assessmentStatusLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              <span className="rounded-2xl border border-brand-red/10 bg-white/55 px-3 py-2 text-xs font-semibold text-stone-500">
                {student.domainProgress.filter((domain) => domain.status === "COMPLETE").length}/{student.domainProgress.length} domain
              </span>
            </div>
          </div>
          <AssessmentTabs activeTab={activeTab} onChangeTab={onChangeTab} summaryLabel="Tiến độ" />
        </div>

        {activeTab === "score" ? (
          <div className="space-y-3 p-3">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {student.domainProgress.map((domain) => (
                <button
                  key={domain.domainKey}
                  type="button"
                  className={`shrink-0 rounded-2xl border px-3 py-2 text-xs font-semibold transition ${selectedDomain.key === domain.domainKey ? "border-brand-red bg-brand-red text-white" : "border-brand-red/10 bg-white/55 text-brand-red hover:border-brand-red/30"}`}
                  onClick={() => onSelectDomain(domain.domainKey)}
                >
                  {domain.label} · {formatScore(domain.scoreOutOfFive)}/5
                </button>
              ))}
            </div>
            <div className="overflow-hidden rounded-3xl border border-brand-red/10 bg-white/35">
              <div className="grid grid-cols-[minmax(0,1fr)_420px] border-b border-brand-red/10 bg-white/45 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-stone-400 max-xl:hidden">
                <span>Milestone quan sát</span>
                <span>Mức đánh giá</span>
              </div>
              {selectedDomain.skills.flatMap((skill) =>
                skill.outcomes.map((outcome, outcomeIndex) => {
                  const key = `${selectedDomain.key}:${skill.key}:${outcomeIndex}`
                  const item = student.items.find((candidate) => itemKey(candidate) === key)

                  return (
                    <article key={key} className="border-b border-brand-red/10 bg-white/30 p-3 last:border-b-0">
                      <div className="grid gap-3 2xl:grid-cols-[minmax(0,1fr)_420px] 2xl:items-center">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-wide text-brand-red">{skill.label}</p>
                          <p className="mt-1 text-base font-semibold text-brand-ink">{outcome}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <button
                            type="button"
                            className={`rounded-2xl border px-3 py-3 text-xs font-semibold transition ${!item?.checked ? "border-stone-300 bg-stone-100 text-stone-700" : "border-brand-red/10 bg-white/60 text-stone-500 hover:border-brand-red/30"}`}
                            disabled={!canEvaluate}
                            onClick={() => onUpdateItem(student.studentId, key, { checked: false, progressLevel: undefined })}
                          >
                            Chưa quan sát
                          </button>
                          {Object.entries(progressLevelLabels).map(([level, label]) => (
                            <button
                              key={level}
                              type="button"
                              className={`rounded-2xl border px-3 py-3 text-xs font-semibold transition ${item?.checked && item.progressLevel === level ? "border-brand-red bg-brand-red text-white" : "border-brand-red/10 bg-white/60 text-brand-red hover:border-brand-red/30 hover:bg-white"}`}
                              disabled={!canEvaluate}
                              onClick={() => onUpdateItem(student.studentId, key, { checked: true, progressLevel: level as ProgressLevelKey })}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <details className="mt-2 rounded-2xl border border-brand-red/10 bg-white/45 px-3 py-2">
                        <summary className="cursor-pointer text-xs font-semibold text-brand-red">Ghi chú / minh chứng cho dòng này</summary>
                        <div className="mt-2 grid gap-2 md:grid-cols-2">
                          <input
                            className="rounded-2xl border border-brand-red/10 bg-white/60 px-3 py-2 text-sm text-brand-ink outline-none placeholder:text-stone-400"
                            value={item?.comment ?? ""}
                            disabled={!canEvaluate}
                            onChange={(event) => onUpdateItem(student.studentId, key, { comment: event.target.value })}
                            placeholder="Nhận xét ngắn..."
                          />
                          <input
                            className="rounded-2xl border border-brand-red/10 bg-white/60 px-3 py-2 text-sm text-brand-ink outline-none placeholder:text-stone-400"
                            value={item?.evidenceUrl ?? ""}
                            disabled={!canEvaluate}
                            onChange={(event) => onUpdateItem(student.studentId, key, { evidenceUrl: event.target.value || undefined })}
                            placeholder="Link ảnh/video nếu có..."
                          />
                        </div>
                      </details>
                    </article>
                  )
                })
              )}
            </div>
          </div>
        ) : null}

        {activeTab === "notes" ? (
          <div className="grid gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_260px]">
            <label className="block rounded-3xl border border-brand-red/10 bg-white/45 p-4 text-xs font-semibold uppercase tracking-wide text-stone-400">
              Nhận xét tuần
              <textarea
                className="mt-3 min-h-40 w-full rounded-2xl border border-brand-red/10 bg-white/70 px-3 py-2 text-sm font-normal normal-case tracking-normal text-brand-ink outline-none placeholder:text-stone-400"
                value={student.comment ?? ""}
                disabled={!canEvaluate}
                onChange={(event) => onUpdateComment(student.studentId, event.target.value)}
                placeholder="Nhận xét tổng quan cho tuần này..."
              />
            </label>
            <div className="rounded-3xl border border-brand-red/10 bg-white/45 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-red">Quy ước nhanh</p>
              <div className="mt-3 space-y-2 text-xs text-stone-600">
                <p className="rounded-2xl border border-brand-red/10 bg-white/60 px-3 py-2">Chưa quan sát: chưa đủ dữ liệu quan sát.</p>
                {Object.entries(progressLevelLabels).map(([key, label]) => (
                  <p key={key} className="rounded-2xl border border-brand-red/10 bg-white/60 px-3 py-2">
                    <span className="font-semibold text-brand-red">{label}</span> - {progressLevelDescriptions[key as ProgressLevelKey]}
                  </p>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === "summary" ? (
          <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
            {student.domainProgress.map((domain) => (
              <button
                key={domain.domainKey}
                type="button"
                className={`rounded-3xl border p-4 text-left transition ${selectedDomain.key === domain.domainKey ? "border-brand-red bg-white/70" : "border-brand-red/10 bg-white/45 hover:border-brand-red/30"}`}
                onClick={() => {
                  onSelectDomain(domain.domainKey)
                  onChangeTab("score")
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-brand-ink">{domain.label}</p>
                  <span className="rounded-full border border-brand-red/10 bg-white/70 px-2 py-1 text-xs font-semibold text-brand-red">
                    {formatScore(domain.scoreOutOfFive)}/5
                  </span>
                </div>
                <p className="mt-3 text-sm text-stone-500">{domain.checkedItems}/{domain.totalItems} milestone đã quan sát</p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-stone-400">{domain.status}</p>
              </button>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  )
}

export function RoboticsAssessmentWorkspace({
  detail,
  selectedStudentId,
  onSelectStudent,
  onUpdateScore,
  onUpdateComment,
  onUpdateStatus,
  activeTab,
  onChangeTab
}: {
  detail: WeeklyClassAssessmentDetail
  selectedStudentId: string | null
  onSelectStudent: (studentId: string) => void
  onUpdateScore: (studentId: string, skillKey: string, score?: number) => void
  onUpdateComment: (studentId: string, comment: string) => void
  onUpdateStatus: (studentId: string, status: AssessmentStatusKey) => void
  activeTab: AssessmentWorkspaceTab
  onChangeTab: (tab: AssessmentWorkspaceTab) => void
}) {
  const student = detail.students.find((item) => item.studentId === selectedStudentId) ?? detail.students[0]
  const skills = detail.rubric.domains.flatMap((domain) => domain.skills)

  if (!student) {
    return <p className="rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500">Lớp Robotics này chưa có học sinh để đánh giá.</p>
  }

  const skillRows = skills.map((skill) => {
    const item = student.items.find((candidate) => candidate.skillKey === skill.key)
    const score = item?.checked ? item.score ?? assessmentItemScore(item) : undefined

    return {
      skill,
      item,
      score,
      description: skillDescriptionForAge(skill, student.ageGroup),
      comment: typeof score === "number" ? skillScoreComment(skill, score, student.ageGroup) : skillDescriptionForAge(skill, student.ageGroup)
    }
  })
  const chartData = skillRows.map((row) => ({ skill: row.skill.label, score: row.score ?? 0, fullMark: 5 }))
  const observedRows = skillRows.filter((row) => typeof row.score === "number")
  const canEvaluate = Boolean(student.enrollmentId && student.canEvaluate)
  const average = scoreOutOfFive(student.items)
  const strongest = [...observedRows].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]
  const focus = [...observedRows].sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0]

  return (
    <div className="grid items-start gap-3 xl:grid-cols-[220px_minmax(0,1fr)]">
      <AssessmentStudentRail detail={detail} selectedStudentId={student.studentId} onSelectStudent={onSelectStudent} />

      <section className="min-w-0 overflow-hidden rounded-3xl border border-brand-red/10 bg-white/35">
        <div className="shrink-0 border-b border-brand-red/10 p-4">
          <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-start">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-red">Robotics weekly scoring - tuần {detail.weekNumber}</p>
              <h3 className="mt-1 text-xl font-semibold text-brand-ink">{student.studentName}</h3>
              <p className="mt-1 text-sm text-stone-500">
                {detail.className} · {student.ageGroup ?? "7-10"}{student.ageGroupIsDefault ? " mặc định do thiếu ngày sinh" : ""} · {student.checkedItems}/{student.totalItems} kỹ năng đã chấm
              </p>
              {!canEvaluate ? <p className="mt-2 text-xs font-semibold text-stone-500">Không có quan sát trong tuần này vì học viên vắng cả các buổi học.</p> : null}
              {student.healthNote ? (
                <p className="mt-2 rounded-2xl border border-brand-red/10 bg-white/55 px-3 py-2 text-xs font-semibold text-brand-red">
                  Lưu ý sức khỏe: {student.healthNote}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end">
              <select
                aria-label="Trạng thái đánh giá"
                className="rounded-2xl border border-brand-red/10 bg-white/60 px-3 py-2 text-xs font-semibold text-brand-ink outline-none"
                value={student.status}
                disabled={!canEvaluate}
                onChange={(event) => onUpdateStatus(student.studentId, event.target.value as AssessmentStatusKey)}
              >
                {Object.entries(assessmentStatusLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              <span className="rounded-2xl border border-brand-red/10 bg-white/55 px-3 py-2 text-xs font-semibold text-stone-500">
                TB {formatScore(average)}/5
              </span>
            </div>
          </div>
          <AssessmentTabs activeTab={activeTab} onChangeTab={onChangeTab} summaryLabel="Radar" />
        </div>

        {activeTab === "score" ? (
          <div className="p-3">
            <div className="overflow-hidden rounded-3xl border border-brand-red/10 bg-white/35">
              <div className="grid grid-cols-[minmax(0,1fr)_360px_84px] border-b border-brand-red/10 bg-white/45 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-stone-400 max-xl:hidden">
                <span>Kỹ năng Robotics</span>
                <span>Chấm sao</span>
                <span>Điểm</span>
              </div>
              {skillRows.map((row) => (
                <article key={row.skill.key} className="border-b border-brand-red/10 bg-white/30 p-3 last:border-b-0">
                  <div className="grid gap-3 2xl:grid-cols-[minmax(0,1fr)_360px_84px] 2xl:items-center">
                    <div className="min-w-0">
                      <h4 className="text-base font-semibold text-brand-ink">{row.skill.label}</h4>
                      <p className="mt-1 text-xs text-stone-500">{row.description}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {[1, 2, 3, 4, 5].map((score) => (
                        <button
                          key={score}
                          type="button"
                          className={`flex h-11 w-11 items-center justify-center rounded-2xl border transition ${typeof row.score === "number" && row.score >= score ? "border-brand-red bg-brand-red text-white" : "border-brand-red/10 bg-white/70 text-brand-red hover:border-brand-red/30 hover:bg-white"}`}
                          disabled={!canEvaluate}
                          aria-label={`${row.skill.label} ${score} sao`}
                          onClick={() => onUpdateScore(student.studentId, row.skill.key, score)}
                        >
                          <Star className={`h-5 w-5 ${typeof row.score === "number" && row.score >= score ? "fill-current" : ""}`} />
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 2xl:justify-end">
                      <span className="rounded-full border border-brand-red/10 bg-white/70 px-3 py-2 text-xs font-semibold text-brand-red">
                        {typeof row.score === "number" ? `${row.score}/5` : "-"}
                      </span>
                      <button
                        type="button"
                        className="rounded-2xl border border-brand-red/10 bg-white/50 px-3 py-2 text-xs font-semibold text-stone-500 hover:border-brand-red/30"
                        disabled={!canEvaluate || typeof row.score !== "number"}
                        onClick={() => onUpdateScore(student.studentId, row.skill.key, undefined)}
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                  <details className="mt-2 rounded-2xl border border-brand-red/10 bg-white/45 px-3 py-2">
                    <summary className="cursor-pointer text-xs font-semibold text-brand-red">Nhận xét tự động</summary>
                    <p className="mt-2 text-xs text-stone-600">{row.comment}</p>
                  </details>
                </article>
              ))}
            </div>
          </div>
        ) : null}

        {activeTab === "notes" ? (
          <div className="grid gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_260px]">
            <label className="block rounded-3xl border border-brand-red/10 bg-white/45 p-4 text-xs font-semibold uppercase tracking-wide text-stone-400">
              Nhận xét tuần
              <textarea
                className="mt-3 min-h-40 w-full rounded-2xl border border-brand-red/10 bg-white/70 px-3 py-2 text-sm font-normal normal-case tracking-normal text-brand-ink outline-none placeholder:text-stone-400"
                value={student.comment ?? ""}
                disabled={!canEvaluate}
                onChange={(event) => onUpdateComment(student.studentId, event.target.value)}
                placeholder={canEvaluate ? "Nhận xét tổng quan cho tuần này..." : "Không có quan sát trong tuần này"}
              />
            </label>
            <div className="rounded-3xl border border-brand-red/10 bg-white/45 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-red">Gợi ý theo điểm</p>
              <div className="mt-3 space-y-2">
                {skillRows
                  .filter((row) => typeof row.score === "number")
                  .slice(0, 4)
                  .map((row) => (
                    <p key={row.skill.key} className="rounded-2xl border border-brand-red/10 bg-white/60 px-3 py-2 text-xs text-stone-600">
                      <span className="font-semibold text-brand-red">{row.skill.label}:</span> {row.comment}
                    </p>
                  ))}
                {observedRows.length === 0 ? <p className="text-sm text-stone-500">Chưa có điểm để sinh nhận xét.</p> : null}
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === "summary" ? (
          <div className="grid gap-3 p-3 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="rounded-3xl border border-brand-red/10 bg-white/45 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-red">Radar 8 kỹ năng</p>
                  <h3 className="mt-1 text-xl font-semibold text-brand-ink">{formatScore(average)}/5</h3>
                </div>
                <span className="rounded-2xl border border-brand-red/10 bg-white/70 px-3 py-2 text-xs font-semibold text-stone-500">
                  {student.checkedItems}/{student.totalItems}
                </span>
              </div>
              <div className="mt-3 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={chartData} outerRadius="72%">
                    <PolarGrid stroke="#e7d8d2" />
                    <PolarAngleAxis dataKey="skill" tick={{ fontSize: 9, fill: "#57534e" }} />
                    <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fontSize: 9, fill: "#78716c" }} />
                    <Radar dataKey="score" stroke="#a52427" fill="#a52427" fillOpacity={0.24} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <p className="rounded-3xl border border-brand-red/10 bg-white/45 p-4 text-sm text-stone-600">
                <span className="block text-xs font-semibold uppercase tracking-wide text-brand-red">Điểm mạnh</span>
                {strongest ? `${strongest.skill.label} ${strongest.score}/5` : "Chưa có dữ liệu"}
              </p>
              <p className="rounded-3xl border border-brand-red/10 bg-white/45 p-4 text-sm text-stone-600">
                <span className="block text-xs font-semibold uppercase tracking-wide text-brand-red">Cần luyện</span>
                {focus ? `${focus.skill.label} ${focus.score}/5` : "Chưa có dữ liệu"}
              </p>
              {skillRows.map((row) => (
                <article key={row.skill.key} className="rounded-3xl border border-brand-red/10 bg-white/45 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-brand-ink">{row.skill.label}</p>
                    <span className="rounded-full border border-brand-red/10 bg-white/70 px-2 py-1 text-xs font-semibold text-brand-red">
                      {typeof row.score === "number" ? `${row.score}/5` : "-"}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-stone-500">{row.description}</p>
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  )
}
