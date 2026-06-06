"use client"

import {
  AlertTriangle,
  BadgeDollarSign,
  Bell,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  Clock3,
  GraduationCap,
  PhoneCall,
  TrendingUp,
  Users,
  WalletCards
} from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import type { ApiResponse } from "@/lib/api-response"
import { dashboardAlertSections, type DashboardAlerts, type DashboardOverview } from "@/lib/contracts/dashboard"
import { makeupEntitlementStatusLabels } from "@/lib/contracts/makeup-entitlements"
import type { InternalNotificationItem } from "@/lib/contracts/operations"

const emptyAlerts: DashboardAlerts = {
  sessionsLow: [],
  debtWarnings: [],
  staleTrialLeads: [],
  dueTasks: [],
  makeupStateAlerts: []
}

const priorityTone = {
  HIGH: "border-brand-red/30 bg-brand-red/10 text-brand-red",
  MEDIUM: "border-amber-300 bg-amber-50 text-amber-700",
  LOW: "border-emerald-200 bg-emerald-50 text-emerald-700"
} as const

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value))
}

function formatMoney(value?: string) {
  const amount = Number(value ?? 0)

  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
  }).format(Number.isFinite(amount) ? amount : 0)
}

function formatMonth(value: string) {
  const [year, month] = value.split("-").map(Number)
  return new Intl.DateTimeFormat("vi-VN", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1))
}

function getAlertCount(alerts: DashboardAlerts, key: keyof DashboardAlerts) {
  return alerts[key].length
}

function renderAlertItems(alerts: DashboardAlerts, key: keyof DashboardAlerts) {
  if (key === "sessionsLow") {
    return alerts.sessionsLow.map((item) => (
      <article key={item.enrollmentId} className="neu-list-item rounded-2xl p-4">
        <p className="text-sm font-semibold text-brand-ink">{item.studentName}</p>
        <p className="mt-1 text-xs text-stone-500">
          {item.courseName} - còn {item.sessionsRemaining} buổi
        </p>
      </article>
    ))
  }

  if (key === "debtWarnings") {
    return alerts.debtWarnings.map((item) => (
      <article key={item.enrollmentId} className="neu-list-item rounded-2xl p-4">
        <p className="text-sm font-semibold text-brand-ink">{item.studentName}</p>
        <p className="mt-1 text-xs text-stone-500">
          {item.courseName} - còn {item.sessionsRemaining} buổi
        </p>
        <p className="mt-2 text-[11px] text-stone-400">
          {item.latestReceiptAt ? `Thu gần nhất ${formatDateTime(item.latestReceiptAt)}` : "Chưa có phiếu thu"}
        </p>
      </article>
    ))
  }

  if (key === "staleTrialLeads") {
    return alerts.staleTrialLeads.map((item) => (
      <article key={item.studentId} className="neu-list-item rounded-2xl p-4">
        <p className="text-sm font-semibold text-brand-ink">{item.parentName}</p>
        <p className="mt-1 text-xs text-stone-500">
          {item.studentName} - {item.phone} - {item.daysSinceUpdate} ngày
        </p>
      </article>
    ))
  }

  if (key === "dueTasks") {
    return alerts.dueTasks.map((item) => (
      <article key={item.taskId} className="neu-list-item rounded-2xl p-4">
        <p className="text-sm font-semibold text-brand-ink">{item.title}</p>
        <p className="mt-1 text-xs text-stone-500">
          {item.studentName ? `${item.studentName} - ` : ""}
          {formatDateTime(item.dueDate)}
        </p>
      </article>
    ))
  }

  return alerts.makeupStateAlerts.map((item) => (
    <article key={item.entitlementId} className="neu-list-item rounded-2xl p-4">
      <p className="text-sm font-semibold text-brand-ink">{item.studentName}</p>
      <p className="mt-1 text-xs text-stone-500">
        {item.courseName} - {makeupEntitlementStatusLabels[item.status]} - tháng {item.month}
      </p>
      <p className="mt-2 text-[11px] text-stone-400">
        {item.refundExpenseCode ? `Phiếu chi ${item.refundExpenseCode}` : `Cập nhật ${formatDateTime(item.updatedAt)}`}
      </p>
    </article>
  ))
}

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  href
}: {
  label: string
  value: string
  detail: string
  icon: typeof Users
  href?: string
}) {
  const content = (
    <div className="neu-card h-full rounded-3xl p-4 transition hover:shadow-[0_18px_40px_rgba(165,36,39,0.12)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">{label}</p>
          <p className="mt-3 truncate text-2xl font-semibold text-brand-ink">{value}</p>
          <p className="mt-2 line-clamp-2 text-xs text-stone-500">{detail}</p>
        </div>
        <span className="neu-pressed flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl">
          <Icon className="h-5 w-5 text-brand-red" />
        </span>
      </div>
    </div>
  )

  return href ? <Link href={href}>{content}</Link> : content
}

export default function DashboardPage() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null)
  const [alerts, setAlerts] = useState<DashboardAlerts>(emptyAlerts)
  const [notifications, setNotifications] = useState<InternalNotificationItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadDashboard() {
      setIsLoading(true)
      setError(null)

      try {
        const [overviewResponse, alertResponse, notificationResponse] = await Promise.all([
          fetch("/api/dashboard/overview", { cache: "no-store" }),
          fetch("/api/dashboard/alerts", { cache: "no-store" }),
          fetch("/api/notifications?limit=6", { cache: "no-store" })
        ])
        const [overviewPayload, alertPayload, notificationPayload] = (await Promise.all([
          overviewResponse.json(),
          alertResponse.json(),
          notificationResponse.json()
        ])) as [ApiResponse<DashboardOverview>, ApiResponse<DashboardAlerts>, ApiResponse<InternalNotificationItem[]>]

        if (!isMounted) return

        if (!overviewResponse.ok || !overviewPayload.success || !overviewPayload.data) {
          setError(overviewPayload.error?.message ?? "Không tải được dashboard.")
          return
        }

        setOverview(overviewPayload.data)
        setAlerts(alertPayload.success && alertPayload.data ? alertPayload.data : emptyAlerts)
        setNotifications(notificationPayload.success && notificationPayload.data ? notificationPayload.data : [])
      } catch {
        if (isMounted) setError("Không tải được dashboard.")
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadDashboard()

    return () => {
      isMounted = false
    }
  }, [])

  const totalAlerts = useMemo(() => dashboardAlertSections.reduce((total, section) => total + alerts[section.key].length, 0), [alerts])
  const kpis = overview
    ? [
        {
          label: "Doanh thu tháng",
          value: overview.finance ? formatMoney(overview.finance.revenue) : "Không quyền",
          detail: overview.finance
            ? `${overview.finance.receiptCount} phiếu - TB ${formatMoney(overview.finance.averageReceipt)}`
            : "Tài chính chỉ hiển thị theo quyền",
          icon: BadgeDollarSign,
          href: overview.finance ? "/finance" : undefined
        },
        {
          label: "Học thử",
          value: String(overview.pipeline?.trialCount ?? 0),
          detail: `${overview.pipeline?.staleTrialCount ?? 0} lead học thử quá 3 ngày`,
          icon: GraduationCap,
          href: "/pipeline"
        },
        {
          label: "Đã chốt",
          value: String(overview.pipeline?.closedThisMonth ?? 0),
          detail: `${overview.pipeline?.convertedCount ?? 0} đang ở stage đã chốt - ${overview.pipeline?.conversionRate ?? 0}% tỷ lệ`,
          icon: TrendingUp,
          href: "/pipeline"
        },
        {
          label: "Lớp hôm nay",
          value: String(overview.classes.todaySessionCount),
          detail: `${overview.classes.todayStudentSlots} lượt học viên - điểm danh ${overview.classes.attendanceRate}%`,
          icon: CalendarCheck,
          href: "/classes"
        },
        {
          label: "Cần xử lý",
          value: String(overview.followUps.length + totalAlerts),
          detail: `${overview.students.lowSessionCount} sắp hết buổi - ${overview.students.debtWarningCount} cần thu phí`,
          icon: AlertTriangle,
          href: "/students"
        }
      ]
    : []

  async function markNotificationRead(notification: InternalNotificationItem) {
    const response = await fetch(`/api/notifications/${notification.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isRead: true })
    })
    const payload = (await response.json()) as ApiResponse<InternalNotificationItem>

    if (!payload.success || !payload.data) {
      setError(payload.error?.message ?? "Không cập nhật được thông báo.")
      return
    }

    setNotifications((current) => current.map((item) => (item.id === payload.data?.id ? payload.data : item)))
  }

  return (
    <main className="space-y-5">
      <div className="neu-card rounded-3xl p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-red">Kid Seeds Hub</p>
            <h1 className="mt-2 text-2xl font-semibold text-brand-ink md:text-3xl">Dashboard vận hành</h1>
            <p className="mt-1 max-w-3xl text-sm text-stone-600">
              Theo dõi nhanh học thử, doanh thu, học viên đã chốt, lớp hôm nay và các việc cần xử lý.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-stone-600 sm:flex">
            <span className="rounded-2xl border border-brand-red/10 px-3 py-2">
              {overview ? formatMonth(overview.month) : "Đang tải"}
            </span>
            <span className="rounded-2xl border border-brand-red/10 px-3 py-2">
              {overview ? `Cập nhật ${formatDateTime(overview.generatedAt)}` : "Realtime"}
            </span>
          </div>
        </div>
      </div>

      {error ? (
        <p className="rounded-3xl border border-brand-red/15 bg-white/50 p-4 text-sm text-brand-red">{error}</p>
      ) : null}

      {isLoading && !overview ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="neu-card h-36 animate-pulse rounded-3xl p-4">
              <div className="h-4 w-24 rounded-full bg-brand-red/10" />
              <div className="mt-6 h-8 w-28 rounded-full bg-brand-red/10" />
              <div className="mt-4 h-3 w-full rounded-full bg-brand-red/10" />
            </div>
          ))}
        </section>
      ) : null}

      {overview ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {kpis.map((metric) => (
              <StatCard key={metric.label} {...metric} />
            ))}
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.15fr_0.95fr_1fr]">
            <div className="neu-card rounded-3xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-brand-red">Pipeline</p>
                  <h2 className="mt-2 text-lg font-semibold text-brand-ink">Học thử và chốt sale</h2>
                  <p className="mt-1 text-sm text-stone-500">{overview.pipeline?.scopeLabel ?? "Không có quyền pipeline"}</p>
                </div>
                <Link href="/pipeline" className="neu-list-item inline-flex items-center gap-1 rounded-2xl px-3 py-2 text-xs font-semibold text-stone-600 hover:text-brand-red">
                  Pipeline
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="content-border mt-4 grid gap-2 pt-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-brand-red/10 bg-white/35 p-3">
                  <p className="text-xs text-stone-500">Lead mới tháng này</p>
                  <p className="mt-2 text-2xl font-semibold text-brand-ink">{overview.pipeline?.newLeadsThisMonth ?? 0}</p>
                </div>
                <div className="rounded-2xl border border-brand-red/10 bg-white/35 p-3">
                  <p className="text-xs text-stone-500">Đang đánh giá</p>
                  <p className="mt-2 text-2xl font-semibold text-brand-ink">{overview.pipeline?.evaluationCount ?? 0}</p>
                </div>
                <div className="rounded-2xl border border-brand-red/10 bg-white/35 p-3">
                  <p className="text-xs text-stone-500">Tỷ lệ chốt</p>
                  <p className="mt-2 text-2xl font-semibold text-brand-ink">{overview.pipeline?.conversionRate ?? 0}%</p>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {(["LEAD", "TRIAL", "EVALUATION", "CONVERTED", "RETENTION"] as const).map((stage) => {
                  const value = overview.pipeline?.stageCounts[stage] ?? 0
                  const max = Math.max(1, overview.pipeline?.leadCount ?? 0, overview.pipeline?.trialCount ?? 0, overview.pipeline?.convertedCount ?? 0)

                  return (
                    <div key={stage} className="grid grid-cols-[90px_1fr_36px] items-center gap-2 text-xs">
                      <span className="font-semibold text-stone-600">{stage}</span>
                      <span className="h-2 overflow-hidden rounded-full bg-brand-red/10">
                        <span className="block h-full rounded-full bg-brand-red" style={{ width: `${Math.min(100, Math.round((value / max) * 100))}%` }} />
                      </span>
                      <span className="text-right font-semibold text-brand-ink">{value}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="neu-card rounded-3xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-brand-red">Finance</p>
                  <h2 className="mt-2 text-lg font-semibold text-brand-ink">Doanh thu tháng</h2>
                  <p className="mt-1 text-sm text-stone-500">{overview.finance?.scopeLabel ?? "Ẩn theo phân quyền"}</p>
                </div>
                <WalletCards className="h-5 w-5 text-brand-red" />
              </div>
              <div className="content-border mt-4 grid gap-3 pt-4">
                <div>
                  <p className="text-xs text-stone-500">Doanh thu thực thu</p>
                  <p className="mt-2 text-3xl font-semibold text-brand-ink">{formatMoney(overview.finance?.revenue)}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <span className="rounded-2xl border border-brand-red/10 p-3">
                    <span className="block text-stone-500">Chi phí</span>
                    <span className="mt-1 block font-semibold text-brand-ink">{overview.finance?.expense ? formatMoney(overview.finance.expense) : "-"}</span>
                  </span>
                  <span className="rounded-2xl border border-brand-red/10 p-3">
                    <span className="block text-stone-500">Lợi nhuận</span>
                    <span className="mt-1 block font-semibold text-brand-ink">{overview.finance?.profit ? formatMoney(overview.finance.profit) : "-"}</span>
                  </span>
                </div>
                <div className="space-y-2">
                  {overview.finance?.latestReceipts.length ? overview.finance.latestReceipts.map((receipt) => (
                    <Link key={receipt.id} href={`/receipts/${receipt.id}/print`} className="neu-list-item block rounded-2xl p-3">
                      <span className="flex items-center justify-between gap-2 text-sm font-semibold text-brand-ink">
                        <span className="truncate">{receipt.studentName}</span>
                        <span>{formatMoney(receipt.amount)}</span>
                      </span>
                      <span className="mt-1 block text-xs text-stone-500">{receipt.code} - {receipt.parentName} - {formatDateTime(receipt.createdAt)}</span>
                    </Link>
                  )) : (
                    <p className="rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500">Chưa có phiếu thu trong tháng.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="neu-card rounded-3xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-brand-red">Classes</p>
                  <h2 className="mt-2 text-lg font-semibold text-brand-ink">Lớp học hôm nay</h2>
                  <p className="mt-1 text-sm text-stone-500">{overview.classes.scopeLabel}</p>
                </div>
                <Link href="/classes" className="neu-list-item inline-flex items-center gap-1 rounded-2xl px-3 py-2 text-xs font-semibold text-stone-600 hover:text-brand-red">
                  Lớp
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="content-border mt-4 grid grid-cols-3 gap-2 pt-4 text-center text-xs">
                <span className="rounded-2xl border border-brand-red/10 p-3">
                  <span className="block text-stone-500">Active</span>
                  <span className="mt-1 block text-lg font-semibold text-brand-ink">{overview.classes.activeClassCount}</span>
                </span>
                <span className="rounded-2xl border border-brand-red/10 p-3">
                  <span className="block text-stone-500">Hôm nay</span>
                  <span className="mt-1 block text-lg font-semibold text-brand-ink">{overview.classes.todaySessionCount}</span>
                </span>
                <span className="rounded-2xl border border-brand-red/10 p-3">
                  <span className="block text-stone-500">Điểm danh</span>
                  <span className="mt-1 block text-lg font-semibold text-brand-ink">{overview.classes.attendanceRate}%</span>
                </span>
              </div>
              <div className="mt-4 space-y-2">
                {overview.classes.upcomingToday.length ? overview.classes.upcomingToday.map((session) => (
                  <article key={session.id} className="neu-list-item rounded-2xl p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-brand-ink">{session.className}</p>
                        <p className="mt-1 truncate text-xs text-stone-500">{session.courseName} - GV {session.teacherName}</p>
                      </div>
                      <span className="shrink-0 rounded-full border border-brand-red/15 px-2 py-1 text-[11px] font-semibold text-brand-red">
                        {session.attendanceMarked}/{session.studentCount}
                      </span>
                    </div>
                    <p className="mt-2 inline-flex items-center gap-1 text-xs text-stone-500">
                      <Clock3 className="h-3.5 w-3.5 text-brand-red" />
                      {session.startTime}-{session.endTime}{session.room ? ` - ${session.room}` : ""}
                    </p>
                  </article>
                )) : (
                  <p className="rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500">Hôm nay chưa có lớp cần vận hành.</p>
                )}
              </div>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="neu-card rounded-3xl p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-brand-red">Action queue</p>
                  <h2 className="mt-2 text-lg font-semibold text-brand-ink">Việc cần xử lý trước</h2>
                </div>
                <PhoneCall className="h-5 w-5 text-brand-red" />
              </div>
              <div className="content-border mt-4 space-y-3 pt-4">
                {overview.followUps.length ? overview.followUps.map((item) => {
                  const content = (
                    <article className="neu-list-item rounded-2xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-brand-ink">{item.title}</p>
                          <p className="mt-1 text-xs text-stone-500">{item.detail}</p>
                        </div>
                        <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-semibold ${priorityTone[item.priority]}`}>
                          {item.priority}
                        </span>
                      </div>
                    </article>
                  )

                  return item.href ? <Link key={item.id} href={item.href}>{content}</Link> : <div key={item.id}>{content}</div>
                }) : (
                  <p className="rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500">Chưa có việc ưu tiên cần xử lý.</p>
                )}
              </div>
            </div>

            <div className="neu-card rounded-3xl p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-brand-red">Notifications</p>
                  <h2 className="mt-2 text-lg font-semibold text-brand-ink">Thông báo nội bộ</h2>
                </div>
                <Bell className="h-5 w-5 text-brand-red" />
              </div>
              <div className="content-border mt-4 space-y-3 pt-4">
                {notifications.length ? notifications.map((notification) => (
                  <article key={notification.id} className="neu-list-item rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold text-brand-ink">{notification.title}</h3>
                          {!notification.isRead ? (
                            <span className="rounded-full border border-brand-red/15 px-2 py-1 text-[11px] font-semibold text-brand-red">Mới</span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-stone-500">{notification.body}</p>
                        <p className="mt-2 text-[11px] text-stone-400">{formatDateTime(notification.createdAt)}</p>
                      </div>
                      {!notification.isRead ? (
                        <button
                          type="button"
                          className="neu-list-item inline-flex shrink-0 items-center gap-1 rounded-2xl px-3 py-2 text-xs font-semibold text-stone-600 hover:text-brand-red"
                          onClick={() => void markNotificationRead(notification)}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Đã đọc
                        </button>
                      ) : null}
                    </div>
                  </article>
                )) : (
                  <p className="rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500">Chưa có thông báo nội bộ.</p>
                )}
              </div>
            </div>
          </section>
        </>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-5">
        {dashboardAlertSections.map((section) => {
          const alertCount = getAlertCount(alerts, section.key)

          return (
            <div key={section.key} className="neu-card rounded-3xl">
              <div className="flex items-center justify-between gap-3 p-5">
                <h2 className="font-semibold text-brand-ink">{section.title}</h2>
                <span className="rounded-full border border-brand-red/15 px-2 py-1 text-xs font-semibold text-brand-red">
                  {alertCount}
                </span>
              </div>
              <div className="content-border space-y-3 p-3">
                {isLoading ? (
                  <p className="rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500">Đang tải cảnh báo...</p>
                ) : alertCount ? (
                  renderAlertItems(alerts, section.key)
                ) : (
                  <p className="rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500">{section.emptyText}</p>
                )}
              </div>
            </div>
          )
        })}
      </section>
    </main>
  )
}
