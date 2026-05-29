"use client"

import { BookOpenCheck, CalendarDays, Camera, Download, Image as ImageIcon, LogOut, MessageSquareHeart, Palette, Rocket, Sprout, StickyNote, Trophy } from "lucide-react"
import { signIn, signOut } from "next-auth/react"
import { useEffect, useMemo, useState } from "react"
import type { ApiResponse } from "@/lib/api-response"
import { absenceRequestStatusLabels, type AbsenceRequestItem } from "@/lib/contracts/absence-requests"
import { subjectLabels } from "@/lib/contracts/assessment"
import { attendanceStatusLabels } from "@/lib/contracts/classes"
import type { CourseFeedbackItem } from "@/lib/contracts/course-feedback"
import type { ParentPortalChild, ParentPortalOverview } from "@/lib/contracts/parent-portal"

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value))
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
}

export default function ParentPortalPage() {
  const [portal, setPortal] = useState<ParentPortalOverview | null>(null)
  const [selectedChildId, setSelectedChildId] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [absenceReasonBySession, setAbsenceReasonBySession] = useState<Record<string, string>>({})
  const [absenceSavingId, setAbsenceSavingId] = useState("")
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, { score: string; comment: string }>>({})
  const [feedbackSavingId, setFeedbackSavingId] = useState("")
  const [error, setError] = useState("")

  const selectedChild = useMemo<ParentPortalChild | undefined>(
    () => portal?.children.find((child) => child.id === selectedChildId) ?? portal?.children[0],
    [portal, selectedChildId]
  )
  const activeCourses = selectedChild?.courses.filter((course) => course.isActive) ?? []
  const totalRemaining = activeCourses.reduce((sum, course) => sum + course.sessionsRemaining, 0)
  const totalBought = activeCourses.reduce((sum, course) => sum + course.sessionsBought, 0)
  const totalUsed = activeCourses.reduce((sum, course) => sum + course.sessionsUsed, 0)
  const progressPercent = totalBought ? Math.min(100, Math.round((totalUsed / totalBought) * 100)) : 0
  const galleryPhotos = selectedChild?.journal.flatMap((item) => item.photos.map((photo) => ({ ...photo, date: item.date, note: item.note }))) ?? []
  const nextSession = selectedChild?.upcomingSessions[0]

  useEffect(() => {
    let isMounted = true

    async function loadPortal() {
      setIsLoading(true)
      setError("")

      try {
        const response = await fetch("/api/parent/portal", { cache: "no-store" })
        const payload = (await response.json()) as ApiResponse<ParentPortalOverview>

        if (!isMounted) return

        if (!response.ok || !payload.success || !payload.data) {
          setError(payload.error?.message ?? "Không tải được cổng phụ huynh.")
          return
        }

        const data = payload.data
        setPortal(data)
        setSelectedChildId((current) => current || data.children[0]?.id || "")
      } catch {
        if (isMounted) setError("Không tải được cổng phụ huynh.")
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void loadPortal()

    return () => {
      isMounted = false
    }
  }, [])

  async function requestAbsence(classSessionId: string) {
    if (!selectedChild) return

    const reason = absenceReasonBySession[classSessionId]?.trim()

    if (!reason) {
      setError("Nhập lý do xin nghỉ trước khi gửi.")
      return
    }

    setAbsenceSavingId(classSessionId)
    setError("")

    try {
      const response = await fetch("/api/absence-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          studentId: selectedChild.id,
          classSessionId,
          reason
        })
      })
      const payload = (await response.json()) as ApiResponse<AbsenceRequestItem>

      if (!response.ok || !payload.success || !payload.data) {
        setError(payload.error?.message ?? "Không gửi được yêu cầu xin nghỉ.")
        return
      }

      setPortal((current) =>
        current
          ? {
              ...current,
              children: current.children.map((child) =>
                child.id === selectedChild.id
                  ? {
                      ...child,
                      upcomingSessions: child.upcomingSessions.map((session) =>
                        session.id === classSessionId
                          ? {
                              ...session,
                              absenceRequest: {
                                id: payload.data!.id,
                                status: payload.data!.status,
                                reason: payload.data!.reason
                              }
                            }
                          : session
                      )
                    }
                  : child
              )
            }
          : current
      )
      setAbsenceReasonBySession((current) => ({ ...current, [classSessionId]: "" }))
    } catch {
      setError("Không gửi được yêu cầu xin nghỉ.")
    } finally {
      setAbsenceSavingId("")
    }
  }

  async function submitFeedback(assessmentId: string) {
    if (!selectedChild) return

    const draft = feedbackDrafts[assessmentId] ?? { score: "5", comment: "" }
    const score = Number(draft.score)

    if (!Number.isInteger(score) || score < 1 || score > 5) {
      setError("Chọn điểm feedback từ 1 đến 5.")
      return
    }

    setFeedbackSavingId(assessmentId)
    setError("")

    try {
      const response = await fetch("/api/parent/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          studentId: selectedChild.id,
          teachingQuality: score,
          teacherAttitude: score,
          studentProgress: score,
          wouldRecommend: score,
          comment: draft.comment.trim() || undefined
        })
      })
      const payload = (await response.json()) as ApiResponse<CourseFeedbackItem>

      if (!response.ok || !payload.success || !payload.data) {
        setError(payload.error?.message ?? "Không gửi được feedback.")
        return
      }

      setPortal((current) =>
        current
          ? {
              ...current,
              children: current.children.map((child) =>
                child.id === selectedChild.id ? { ...child, feedbacks: [payload.data!, ...child.feedbacks] } : child
              )
            }
          : current
      )
      setFeedbackDrafts((current) => ({ ...current, [assessmentId]: { score: "5", comment: "" } }))
    } catch {
      setError("Không gửi được feedback.")
    } finally {
      setFeedbackSavingId("")
    }
  }

  return (
    <main className="min-h-screen text-brand-ink">
      <header className="sticky top-0 z-20 border-b border-brand-red/10 bg-brand-cream/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="neu-button flex h-10 w-10 items-center justify-center rounded-2xl">
              <Sprout className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-brand-red">Kid Seeds Hub</p>
              <p className="text-xs text-stone-500">Cổng phụ huynh</p>
            </div>
          </div>
          <button
            type="button"
            className="neu-list-item inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold text-stone-600 hover:text-brand-red"
            onClick={() => void signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="h-4 w-4" />
            Đăng xuất
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 md:py-8">
        <section className="neu-card rounded-3xl p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-red">Parent Portal</p>
          <h1 className="mt-2 text-3xl font-semibold text-brand-ink">Cổng phụ huynh</h1>
          <p className="mt-1 text-sm text-stone-600">Theo dõi buổi học còn lại, lịch sắp tới, ảnh/nhật ký học và báo cáo cuối khóa.</p>
        </section>

        {error ? (
          <div className="rounded-3xl border border-brand-red/15 bg-white/50 p-4">
            <p className="text-sm font-semibold text-brand-red">{error}</p>
            {error.includes("không có quyền") ? (
              <button
                type="button"
                className="neu-button mt-3 rounded-2xl px-4 py-3 text-sm font-semibold"
                onClick={() =>
                  void signIn("credentials", {
                    phone: "0911000004",
                    password: "Parent@123",
                    callbackUrl: "/parent"
                  })
                }
              >
                Đăng nhập Parent demo
              </button>
            ) : null}
          </div>
        ) : null}

        {isLoading ? (
          <p className="neu-card rounded-3xl p-6 text-sm text-stone-500">Đang tải dữ liệu phụ huynh...</p>
        ) : portal && selectedChild ? (
          <section className="space-y-6">
            <section className="parent-portfolio-hero overflow-hidden rounded-[2rem] border border-brand-red/10 bg-white/45 p-5 md:p-8">
              <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
                <div>
                  <div className="flex flex-wrap gap-2">
                    {portal.children.map((child) => {
                      const isActive = child.id === selectedChild.id

                      return (
                        <button
                          key={child.id}
                          type="button"
                          className={`rounded-full border px-4 py-2 text-xs font-semibold transition hover:-translate-y-0.5 ${
                            isActive ? "border-brand-red bg-brand-red text-white" : "border-brand-red/15 bg-white/45 text-stone-600 hover:text-brand-red"
                          }`}
                          onClick={() => setSelectedChildId(child.id)}
                        >
                          {child.name}
                        </button>
                      )
                    })}
                  </div>
                  <p className="mt-8 text-xs font-semibold uppercase tracking-widest text-brand-red">Learning Portfolio</p>
                  <h2 className="mt-3 max-w-2xl text-4xl font-semibold leading-tight text-brand-ink md:text-6xl">{selectedChild.name}</h2>
                  <p className="mt-4 max-w-xl text-base leading-7 text-stone-600">
                    Một trang portfolio học tập riêng cho bé, gom lịch học, dấu mốc tiến bộ, hình ảnh lớp học và báo cáo cuối khóa để phụ huynh theo dõi nhanh.
                  </p>
                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <MetricCard label="Tiến độ" value={`${progressPercent}%`} />
                    <MetricCard label="Còn lại" value={`${totalRemaining} buổi`} />
                    <MetricCard label="Nhật ký" value={`${selectedChild.journal.length} mục`} />
                  </div>
                </div>

                <div className="parent-visual-stage">
                  <div className="parent-profile-frame">
                    <div className="parent-avatar">{getInitials(selectedChild.name)}</div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-brand-red">Kid Seeds Hub</p>
                      <p className="mt-1 text-xl font-semibold text-brand-ink">{selectedChild.name}</p>
                      <p className="mt-1 text-sm text-stone-500">{activeCourses.map((course) => subjectLabels[course.subject]).join(" + ") || "Learning journey"}</p>
                    </div>
                  </div>
                  <div className="parent-floating-card parent-floating-card-one">
                    <BookOpenCheck className="h-5 w-5 text-brand-red" />
                    <span>{nextSession ? `${formatDate(nextSession.date)} - ${nextSession.startTime}` : "Lịch học đang cập nhật"}</span>
                  </div>
                  <div className="parent-floating-card parent-floating-card-two">
                    <Camera className="h-5 w-5 text-brand-red" />
                    <span>{galleryPhotos.length ? `${galleryPhotos.length} ảnh lớp học` : "Khoảnh khắc lớp học"}</span>
                  </div>
                  <div className="parent-filmstrip" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-5 xl:grid-cols-[1fr_380px]">
              <div className="space-y-5">
                <section className="neu-card rounded-3xl p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-brand-red">Course Progress</p>
                      <h2 className="mt-2 text-2xl font-semibold text-brand-ink">Hành trình khóa học</h2>
                    </div>
                    <div className="min-w-44 rounded-2xl border border-brand-red/10 bg-white/35 px-4 py-3">
                      <p className="text-xs text-stone-500">Đã hoàn thành</p>
                      <div className="mt-2 h-2 rounded-full bg-brand-red/10">
                        <div className="h-full rounded-full bg-brand-red transition-all" style={{ width: `${progressPercent}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    {selectedChild.courses.length ? (
                      selectedChild.courses.map((course) => {
                        const courseProgress = course.sessionsBought ? Math.min(100, Math.round((course.sessionsUsed / course.sessionsBought) * 100)) : 0

                        return (
                          <article key={course.enrollmentId} className="parent-course-card rounded-3xl p-5">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-brand-ink">{course.courseName}</p>
                                <p className="mt-1 text-xs text-stone-500">{subjectLabels[course.subject]}</p>
                              </div>
                              <Rocket className="h-5 w-5 text-brand-red" />
                            </div>
                            <p className="mt-5 text-3xl font-semibold text-brand-red">{course.sessionsRemaining}</p>
                            <p className="text-xs text-stone-500">buổi còn lại</p>
                            <div className="mt-4 h-2 rounded-full bg-white/70">
                              <div className="h-full rounded-full bg-brand-red" style={{ width: `${courseProgress}%` }} />
                            </div>
                            <p className="mt-2 text-xs text-stone-500">
                              Đã học {course.sessionsUsed}/{course.sessionsBought} buổi
                            </p>
                          </article>
                        )
                      })
                    ) : (
                      <p className="text-sm text-stone-500">Chưa có khóa học active.</p>
                    )}
                  </div>
                </section>

                <section className="neu-card rounded-3xl p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-brand-red">Gallery</p>
                      <h2 className="mt-2 text-2xl font-semibold text-brand-ink">Khoảnh khắc lớp học</h2>
                    </div>
                    <Palette className="h-5 w-5 text-brand-red" />
                  </div>
                  {galleryPhotos.length ? (
                    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {galleryPhotos.slice(0, 6).map((photo) => (
                        <a key={photo.id} href={photo.url} className="parent-photo-card group block overflow-hidden rounded-3xl border border-brand-red/10 bg-white/50">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={photo.url} alt="Khoảnh khắc lớp học" className="h-44 w-full object-cover transition duration-500 group-hover:scale-105" />
                          <div className="p-3">
                            <p className="text-xs font-semibold text-brand-red">{formatDate(photo.date)}</p>
                            <p className="mt-1 line-clamp-2 text-xs text-stone-600">{photo.note || "Ảnh hoạt động trong lớp học."}</p>
                          </div>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                      <VisualPlaceholder icon={Camera} title="Sản phẩm lớp học" />
                      <VisualPlaceholder icon={BookOpenCheck} title="Hoạt động nhóm" />
                      <VisualPlaceholder icon={Trophy} title="Dấu mốc tiến bộ" />
                    </div>
                  )}
                </section>

                <Panel title="Nhật ký học tập" icon={StickyNote}>
                  {selectedChild.journal.length ? (
                    <div className="relative space-y-3">
                      {selectedChild.journal.map((item) => (
                        <article key={item.id} className="parent-timeline-item rounded-3xl p-4">
                          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                            <div>
                              <p className="text-sm font-semibold text-brand-ink">
                                {formatDate(item.date)} - {attendanceStatusLabels[item.status]}
                              </p>
                              <p className="mt-1 text-xs text-stone-500">
                                {item.courseName}
                                {item.className ? ` - ${item.className}` : ""}
                              </p>
                            </div>
                            <span className="inline-flex w-fit items-center gap-1 rounded-2xl border border-brand-red/10 px-3 py-1.5 text-xs text-stone-500">
                              <ImageIcon className="h-3.5 w-3.5 text-brand-red" />
                              {item.photos.length} ảnh
                            </span>
                          </div>
                          {item.note ? <p className="mt-3 text-sm leading-6 text-stone-600">{item.note}</p> : null}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-stone-500">Chưa có nhật ký học.</p>
                  )}
                </Panel>
              </div>

              <div className="space-y-5">
                <Panel title="Lịch học sắp tới" icon={CalendarDays}>
                  {selectedChild.upcomingSessions.length ? (
                    selectedChild.upcomingSessions.map((session) => (
                      <article key={session.id} className="neu-list-item rounded-2xl p-4">
                        <p className="text-sm font-semibold text-brand-ink">{session.className}</p>
                        <p className="mt-1 text-xs text-stone-500">
                          {formatDate(session.date)} - {session.startTime}-{session.endTime}
                          {session.room ? ` - ${session.room}` : ""}
                        </p>
                        {session.absenceRequest ? (
                          <p className="mt-3 rounded-2xl border border-brand-red/10 px-3 py-2 text-xs font-semibold text-brand-red">
                            Xin nghỉ: {absenceRequestStatusLabels[session.absenceRequest.status]}
                          </p>
                        ) : (
                          <div className="mt-3 space-y-2">
                            <input
                              className="neu-pressed w-full rounded-2xl bg-transparent px-3 py-2 text-xs text-brand-ink outline-none placeholder:text-stone-400"
                              placeholder="Lý do xin nghỉ"
                              value={absenceReasonBySession[session.id] ?? ""}
                              onChange={(event) => setAbsenceReasonBySession((current) => ({ ...current, [session.id]: event.target.value }))}
                            />
                            <button
                              type="button"
                              className="rounded-2xl border border-brand-red/15 px-3 py-2 text-xs font-semibold text-brand-red disabled:opacity-50"
                              disabled={absenceSavingId === session.id}
                              onClick={() => void requestAbsence(session.id)}
                            >
                              {absenceSavingId === session.id ? "Đang gửi" : "Xin nghỉ buổi này"}
                            </button>
                          </div>
                        )}
                      </article>
                    ))
                  ) : (
                    <p className="text-sm text-stone-500">Chưa có lịch học sắp tới.</p>
                  )}
                </Panel>

                <Panel title="Báo cáo cuối khóa" icon={Download}>
                  {selectedChild.finalAssessments.length ? (
                    selectedChild.finalAssessments.map((report) => {
                      const hasFeedback = selectedChild.feedbacks.some((feedback) => feedback.createdAt >= report.createdAt)
                      const draft = feedbackDrafts[report.id] ?? { score: "5", comment: "" }

                      return (
                        <article key={report.id} className="parent-report-card rounded-3xl p-4">
                          <p className="text-sm font-semibold text-brand-ink">{report.courseName}</p>
                          <p className="mt-1 text-xs text-stone-500">
                            {subjectLabels[report.subject]} - {report.completedWeeks}/{report.requiredWeeks} tuần - GV {report.teacherName}
                          </p>
                          <p className="mt-3 line-clamp-3 text-xs leading-5 text-stone-600">{report.teacherSummary}</p>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <a
                              className="inline-flex items-center gap-2 rounded-2xl bg-brand-red px-3 py-2 text-xs font-semibold text-white"
                              href={`/final-assessments/${report.id}/print`}
                              target="_blank"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Xem / Lưu PDF
                            </a>
                            {hasFeedback ? (
                              <span className="inline-flex items-center gap-2 rounded-2xl border border-brand-red/10 px-3 py-2 text-xs font-semibold text-brand-red">
                                <MessageSquareHeart className="h-3.5 w-3.5" />
                                Đã feedback
                              </span>
                            ) : null}
                          </div>
                          {!hasFeedback ? (
                            <div className="content-border mt-4 space-y-2 pt-4">
                              <div className="grid grid-cols-[96px_1fr] gap-2">
                                <select
                                  className="neu-pressed rounded-2xl bg-transparent px-3 py-2 text-xs font-semibold text-brand-ink outline-none"
                                  value={draft.score}
                                  onChange={(event) =>
                                    setFeedbackDrafts((current) => ({
                                      ...current,
                                      [report.id]: { ...draft, score: event.target.value }
                                    }))
                                  }
                                >
                                  {[5, 4, 3, 2, 1].map((score) => (
                                    <option key={score} value={score}>
                                      {score}/5
                                    </option>
                                  ))}
                                </select>
                                <input
                                  className="neu-pressed rounded-2xl bg-transparent px-3 py-2 text-xs text-brand-ink outline-none placeholder:text-stone-400"
                                  placeholder="Góp ý sau khóa học"
                                  value={draft.comment}
                                  onChange={(event) =>
                                    setFeedbackDrafts((current) => ({
                                      ...current,
                                      [report.id]: { ...draft, comment: event.target.value }
                                    }))
                                  }
                                />
                              </div>
                              <button
                                type="button"
                                className="inline-flex items-center gap-2 rounded-2xl border border-brand-red/15 px-3 py-2 text-xs font-semibold text-brand-red disabled:opacity-50"
                                disabled={feedbackSavingId === report.id}
                                onClick={() => void submitFeedback(report.id)}
                              >
                                <MessageSquareHeart className="h-3.5 w-3.5" />
                                {feedbackSavingId === report.id ? "Đang gửi" : "Gửi feedback"}
                              </button>
                            </div>
                          ) : null}
                        </article>
                      )
                    })
                  ) : (
                    <p className="text-sm text-stone-500">Chưa có báo cáo cuối khóa.</p>
                  )}
                </Panel>
              </div>
            </section>
          </section>
        ) : (
          <p className="neu-card rounded-3xl p-6 text-sm text-stone-500">Tài khoản phụ huynh chưa có học viên liên kết.</p>
        )}
      </div>
    </main>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-brand-red/10 bg-white/45 p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-brand-red">{value}</p>
    </div>
  )
}

function VisualPlaceholder({ icon: Icon, title }: { icon: typeof Camera; title: string }) {
  return (
    <div className="parent-photo-placeholder rounded-3xl border border-brand-red/10 p-5">
      <Icon className="h-6 w-6 text-brand-red" />
      <p className="mt-6 text-sm font-semibold text-brand-ink">{title}</p>
      <p className="mt-1 text-xs text-stone-500">Sẽ tự nổi bật khi giáo viên thêm ảnh lớp học.</p>
    </div>
  )
}

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof CalendarDays; children: React.ReactNode }) {
  return (
    <section className="neu-card rounded-3xl p-5">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-brand-red" />
        <h2 className="text-lg font-semibold text-brand-ink">{title}</h2>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  )
}
