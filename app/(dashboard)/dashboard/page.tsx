"use client"

import { AlertTriangle, BadgeDollarSign, Bell, CalendarCheck, CheckCircle2, Users } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import type { ApiResponse } from "@/lib/api-response"
import { dashboardAlertSections, type DashboardAlerts } from "@/lib/contracts/dashboard"
import { makeupEntitlementStatusLabels } from "@/lib/contracts/makeup-entitlements"
import type { InternalNotificationItem } from "@/lib/contracts/operations"

const metrics = [
  { label: "Học viên active", value: "0", icon: Users },
  { label: "Thu tháng này", value: "0đ", icon: BadgeDollarSign },
  { label: "Lớp hôm nay", value: "0", icon: CalendarCheck },
  { label: "Cảnh báo", value: "0", icon: AlertTriangle }
]

const emptyAlerts: DashboardAlerts = {
  sessionsLow: [],
  staleTrialLeads: [],
  dueTasks: [],
  makeupStateAlerts: []
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value))
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

export default function DashboardPage() {
  const [alerts, setAlerts] = useState<DashboardAlerts>(emptyAlerts)
  const [notifications, setNotifications] = useState<InternalNotificationItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadDashboard() {
      try {
        const [alertResponse, notificationResponse] = await Promise.all([
          fetch("/api/dashboard/alerts", { cache: "no-store" }),
          fetch("/api/notifications?limit=6", { cache: "no-store" })
        ])
        const [alertPayload, notificationPayload] = (await Promise.all([
          alertResponse.json(),
          notificationResponse.json()
        ])) as [ApiResponse<DashboardAlerts>, ApiResponse<InternalNotificationItem[]>]

        if (!isMounted) return

        if (!alertResponse.ok || !alertPayload.success || !alertPayload.data) {
          setError(alertPayload.error?.message ?? "Không tải được cảnh báo.")
          return
        }

        setAlerts(alertPayload.data)
        setNotifications(notificationPayload.success && notificationPayload.data ? notificationPayload.data : [])
      } catch {
        if (isMounted) setError("Không tải được cảnh báo.")
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
  const displayedMetrics = metrics.map((metric) =>
    metric.label === "Cảnh báo" ? { ...metric, value: String(totalAlerts) } : metric
  )

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
    <main className="space-y-6">
      <div className="neu-card rounded-3xl p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-red">Kid Seeds Hub</p>
        <h1 className="mt-2 text-3xl font-semibold text-brand-ink">Dashboard vận hành</h1>
        <p className="mt-2 max-w-2xl text-sm text-stone-600">
          Theo dõi lead, quỹ buổi, task đến hạn và tài chính trong ngày.
        </p>
      </div>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {displayedMetrics.map((metric) => {
          const Icon = metric.icon
          return (
            <div key={metric.label} className="neu-card rounded-3xl">
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-stone-500">{metric.label}</p>
                  <div className="neu-pressed flex h-10 w-10 items-center justify-center rounded-2xl">
                    <Icon className="h-5 w-5 text-brand-red" />
                  </div>
                </div>
              </div>
              <div className="content-border px-5 py-4">
                <p className="mt-4 text-3xl font-semibold text-brand-ink">{metric.value}</p>
              </div>
            </div>
          )
        })}
      </section>
      {error ? (
        <p className="rounded-3xl border border-brand-red/15 bg-white/50 p-4 text-sm text-brand-red">{error}</p>
      ) : null}
      <section className="neu-card rounded-3xl">
        <div className="flex items-center justify-between gap-3 p-5">
          <div>
            <h2 className="font-semibold text-brand-ink">Thông báo nội bộ</h2>
            <p className="mt-1 text-sm text-stone-500">Các sự kiện mới từ học phí, xin nghỉ và lịch nghỉ.</p>
          </div>
          <Bell className="h-5 w-5 text-brand-red" />
        </div>
        <div className="content-border grid gap-3 p-3 lg:grid-cols-2">
          {isLoading ? <p className="rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500">Đang tải thông báo...</p> : null}
          {!isLoading && notifications.length
            ? notifications.map((notification) => (
                <article key={notification.id} className="neu-list-item rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
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
              ))
            : null}
          {!isLoading && notifications.length === 0 ? (
            <p className="rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500">Chưa có thông báo nội bộ.</p>
          ) : null}
        </div>
      </section>
      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
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
