"use client"

import { BarChart3, CalendarClock, CheckCircle2, CircleDollarSign, LineChart, MessageSquareHeart, Percent, RefreshCcw, UserRoundCheck } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import type { ApiResponse } from "@/lib/api-response"
import type { CourseFeedbackItem } from "@/lib/contracts/course-feedback"
import { makeupEntitlementStatusLabels } from "@/lib/contracts/makeup-entitlements"
import type { AdvancedAnalyticsReport, SaleKpiReport } from "@/lib/contracts/reports"

function getCurrentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

function formatMoney(value: string) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
  }).format(Number(value))
}

function formatDate(value?: string) {
  if (!value) return "Chưa đặt lịch"
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(value))
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-brand-red/10 px-3 py-2">
      <p className="text-xs text-stone-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-brand-ink">{value}</p>
    </div>
  )
}

export default function ReportsPage() {
  const [month, setMonth] = useState(getCurrentMonth)
  const [report, setReport] = useState<SaleKpiReport | null>(null)
  const [advancedReport, setAdvancedReport] = useState<AdvancedAnalyticsReport | null>(null)
  const [feedbacks, setFeedbacks] = useState<CourseFeedbackItem[]>([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let isMounted = true

    async function loadReport() {
      try {
        const [response, feedbackResponse, advancedResponse] = await Promise.all([
          fetch(`/api/reports/sale-kpi?month=${month}`, { cache: "no-store" }),
          fetch("/api/course-feedback", { cache: "no-store" }),
          fetch(`/api/reports/advanced?month=${month}`, { cache: "no-store" })
        ])
        const [payload, feedbackPayload, advancedPayload] = (await Promise.all([
          response.json(),
          feedbackResponse.json(),
          advancedResponse.json()
        ])) as [
          ApiResponse<SaleKpiReport>,
          ApiResponse<CourseFeedbackItem[]>,
          ApiResponse<AdvancedAnalyticsReport>
        ]

        if (!isMounted) return

        if (!response.ok || !payload.success || !payload.data) {
          setError(payload.error?.message ?? "Không tải được KPI Sale.")
          setReport(null)
          return
        }

        setReport(payload.data)
        setFeedbacks(feedbackPayload.success && feedbackPayload.data ? feedbackPayload.data : [])
        setAdvancedReport(advancedPayload.success && advancedPayload.data ? advancedPayload.data : null)
        setError("")
      } catch {
        if (isMounted) {
          setError("Không tải được KPI Sale.")
          setReport(null)
          setAdvancedReport(null)
          setFeedbacks([])
        }
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void loadReport()

    return () => {
      isMounted = false
    }
  }, [month, refreshKey])

  const summaryCards = useMemo(
    () => [
      { label: "Lead xử lý", value: String(report?.totals.leadCount ?? 0), icon: UserRoundCheck },
      { label: "Chuyển đổi", value: String(report?.totals.convertedCount ?? 0), icon: CheckCircle2 },
      { label: "Tỉ lệ chốt", value: `${report?.totals.conversionRate ?? 0}%`, icon: Percent },
      { label: "Doanh thu Sale", value: formatMoney(report?.totals.revenue ?? "0"), icon: CircleDollarSign }
    ],
    [report]
  )

  return (
    <main className="space-y-6">
      <div className="neu-card rounded-3xl p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-red">Reports</p>
            <h1 className="mt-2 text-3xl font-semibold text-brand-ink">Báo cáo KPI Sale</h1>
            <p className="mt-2 max-w-2xl text-sm text-stone-600">Theo dõi lead đã xử lý, tỉ lệ chuyển đổi, doanh thu và task của từng Sale.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="text-sm font-medium text-stone-600">
              Tháng
              <input
                className="neu-pressed mt-2 block rounded-2xl bg-transparent px-4 py-3 text-brand-ink outline-none"
                type="month"
                value={month}
                onChange={(event) => {
                  setIsLoading(true)
                  setMonth(event.target.value)
                }}
              />
            </label>
            <button
              type="button"
              className="neu-list-item inline-flex items-center justify-center gap-2 self-end rounded-2xl px-4 py-3 text-sm font-semibold text-stone-600 hover:text-brand-red"
              onClick={() => {
                setIsLoading(true)
                setRefreshKey((current) => current + 1)
              }}
            >
              <RefreshCcw className="h-4 w-4" />
              Tải lại
            </button>
          </div>
        </div>
      </div>

      {error ? <p className="rounded-3xl border border-brand-red/15 bg-white/50 p-4 text-sm text-brand-red">{error}</p> : null}

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="neu-card rounded-3xl">
          <div className="flex items-center justify-between p-5">
            <div>
              <h2 className="font-semibold text-brand-ink">Nguồn lead</h2>
              <p className="mt-1 text-sm text-stone-500">Feature 5/42 - tỉ lệ chuyển đổi theo nguồn.</p>
            </div>
            <LineChart className="h-5 w-5 text-brand-red" />
          </div>
          <div className="content-border space-y-2 p-5">
            {advancedReport?.leadSources.slice(0, 5).map((row) => (
              <div key={row.source} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-2xl border border-brand-red/10 px-3 py-2 text-sm">
                <span className="truncate font-semibold text-brand-ink">{row.source}</span>
                <span className="text-stone-500">{row.leadCount} lead</span>
                <span className="font-semibold text-brand-red">{row.conversionRate}%</span>
              </div>
            )) ?? <p className="text-sm text-stone-500">Chưa có dữ liệu nguồn lead.</p>}
          </div>
        </div>

        <div className="neu-card rounded-3xl">
          <div className="flex items-center justify-between p-5">
            <div>
              <h2 className="font-semibold text-brand-ink">Doanh thu Sale</h2>
              <p className="mt-1 text-sm text-stone-500">Feature 31 - tổng phiếu thu theo người tạo.</p>
            </div>
            <BarChart3 className="h-5 w-5 text-brand-red" />
          </div>
          <div className="content-border space-y-2 p-5">
            {advancedReport?.saleRevenue.slice(0, 5).map((row) => (
              <div key={row.userId} className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-2xl border border-brand-red/10 px-3 py-2 text-sm">
                <span className="truncate font-semibold text-brand-ink">{row.saleName}</span>
                <span className="text-right font-semibold text-brand-red">{formatMoney(row.revenue)}</span>
                <span className="text-xs text-stone-500">{row.receiptCount} phiếu thu</span>
              </div>
            )) ?? <p className="text-sm text-stone-500">Chưa có doanh thu Sale trong tháng.</p>}
          </div>
        </div>

        <div className="neu-card rounded-3xl">
          <div className="flex items-center justify-between p-5">
            <div>
              <h2 className="font-semibold text-brand-ink">Dự báo doanh thu</h2>
              <p className="mt-1 text-sm text-stone-500">Feature 43 - dựa trên active enrollment và buổi còn lại.</p>
            </div>
            <CircleDollarSign className="h-5 w-5 text-brand-red" />
          </div>
          <div className="content-border grid gap-2 p-5 sm:grid-cols-2">
            <MetricChip label="Enrollment active" value={String(advancedReport?.forecast.activeEnrollmentCount ?? 0)} />
            <MetricChip label="Sắp hết buổi" value={String(advancedReport?.forecast.lowSessionEnrollmentCount ?? 0)} />
            <MetricChip label="TB buổi còn" value={String(advancedReport?.forecast.averageRemainingSessions ?? 0)} />
            <MetricChip label="Dự kiến gia hạn" value={formatMoney(advancedReport?.forecast.projectedRenewalRevenue ?? "0")} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="neu-card rounded-3xl">
          <div className="p-5">
            <h2 className="font-semibold text-brand-ink">Retention theo khóa</h2>
            <p className="mt-1 text-sm text-stone-500">Feature 40 - enrollment có nhiều hơn một phiếu thu được tính là renew.</p>
          </div>
          <div className="content-border space-y-2 p-5">
            {advancedReport?.retention.slice(0, 5).map((row) => (
              <div key={row.courseId} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-2xl border border-brand-red/10 px-3 py-2 text-sm">
                <span className="truncate font-semibold text-brand-ink">{row.courseName}</span>
                <span className="text-stone-500">{row.renewedEnrollmentCount}/{row.activeEnrollmentCount}</span>
                <span className="font-semibold text-brand-red">{row.retentionRate}%</span>
              </div>
            )) ?? <p className="text-sm text-stone-500">Chưa có dữ liệu retention.</p>}
          </div>
        </div>

        <div className="neu-card rounded-3xl">
          <div className="p-5">
            <h2 className="font-semibold text-brand-ink">Tổng quan vận hành</h2>
            <p className="mt-1 text-sm text-stone-500">Feature 41 - lớp, học viên và vắng mặt trong tháng.</p>
          </div>
          <div className="content-border grid gap-2 p-5 sm:grid-cols-3">
            <MetricChip label="Lớp lịch" value={String(advancedReport?.operations.scheduledClassCount ?? 0)} />
            <MetricChip label="Lớp xong" value={String(advancedReport?.operations.completedClassCount ?? 0)} />
            <MetricChip label="Tỉ lệ vắng" value={`${advancedReport?.operations.absenceRate ?? 0}%`} />
            <MetricChip label="Học viên active" value={String(advancedReport?.operations.activeStudentCount ?? 0)} />
            <MetricChip label="Inactive" value={String(advancedReport?.operations.inactiveStudentCount ?? 0)} />
            <MetricChip label="Có/vắng" value={`${advancedReport?.operations.presentCount ?? 0}/${advancedReport?.operations.absentCount ?? 0}`} />
          </div>
        </div>
      </section>

      <section className="neu-card rounded-3xl">
        <div className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-semibold text-brand-ink">Học bù, credit và refund</h2>
            <p className="mt-1 text-sm text-stone-500">Theo dõi quyền học bù theo trạng thái trong tháng báo cáo.</p>
          </div>
          <div className="neu-pressed inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-brand-red">
            <CalendarClock className="h-4 w-4" />
            {advancedReport?.month ?? month}
          </div>
        </div>
        <div className="content-border space-y-4 p-5">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
            <MetricChip label="Chờ xếp lịch" value={String(advancedReport?.makeupEntitlements.pendingScheduleCount ?? 0)} />
            <MetricChip label="Hết hạn" value={String(advancedReport?.makeupEntitlements.expiredCount ?? 0)} />
            <MetricChip label="Đã credit" value={String(advancedReport?.makeupEntitlements.creditedCount ?? 0)} />
            <MetricChip label="Đã refund" value={String(advancedReport?.makeupEntitlements.refundedCount ?? 0)} />
            <MetricChip label="Tổng credit" value={formatMoney(advancedReport?.makeupEntitlements.totalWalletCreditAmount ?? "0")} />
            <MetricChip label="Tổng refund" value={formatMoney(advancedReport?.makeupEntitlements.totalRefundAmount ?? "0")} />
          </div>
          <div className="space-y-2">
            {advancedReport?.makeupEntitlements.rows.length ? (
              advancedReport.makeupEntitlements.rows.map((row) => (
                <article key={row.entitlementId} className="neu-list-item rounded-2xl p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-brand-ink">{row.studentName}</h3>
                      <p className="mt-1 text-xs text-stone-500">
                        {row.courseName} - {makeupEntitlementStatusLabels[row.status]}
                      </p>
                    </div>
                    <div className="grid gap-2 text-xs text-stone-600 sm:grid-cols-2 lg:min-w-[560px] lg:grid-cols-4">
                      <span className="rounded-2xl border border-brand-red/10 px-3 py-2">Tháng {row.month}</span>
                      <span className="rounded-2xl border border-brand-red/10 px-3 py-2">{formatDate(row.scheduledFor)}</span>
                      <span className="rounded-2xl border border-brand-red/10 px-3 py-2">{formatMoney(row.walletCreditAmount)} credit</span>
                      <span className="rounded-2xl border border-brand-red/10 px-3 py-2">
                        {row.refundExpenseCode ? `Refund ${row.refundExpenseCode}` : formatMoney(row.resolvedAmount ?? "0")}
                      </span>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <p className="rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500">Chưa có quyền học bù trong tháng này.</p>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon

          return (
            <div key={card.label} className="neu-card rounded-3xl">
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-stone-500">{card.label}</p>
                  <div className="neu-pressed flex h-10 w-10 items-center justify-center rounded-2xl">
                    <Icon className="h-5 w-5 text-brand-red" />
                  </div>
                </div>
              </div>
              <div className="content-border px-5 py-4">
                <p className="text-3xl font-semibold text-brand-ink">{card.value}</p>
              </div>
            </div>
          )
        })}
      </section>

      <section className="neu-card rounded-3xl">
        <div className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-semibold text-brand-ink">Hiệu suất theo Sale</h2>
            <p className="mt-1 text-sm text-stone-500">Lead base là học viên có contact log hoặc receipt do Sale tạo trong tháng.</p>
          </div>
          <div className="neu-pressed inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-brand-red">
            <BarChart3 className="h-4 w-4" />
            {report?.month ?? month}
          </div>
        </div>
        <div className="content-border space-y-3 p-3">
          {isLoading ? <p className="rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500">Đang tải KPI Sale...</p> : null}
          {!isLoading && report?.rows.length
            ? report.rows.map((row) => (
                <article key={row.userId} className="neu-list-item rounded-2xl p-4">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="neu-pressed flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl">
                        <UserRoundCheck className="h-5 w-5 text-brand-red" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-brand-ink">{row.saleName}</h3>
                        <p className="mt-1 text-sm text-stone-500">
                          {row.leadCount} lead - {row.convertedCount} chốt - {row.receiptCount} phiếu thu
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-2 text-sm text-stone-600 sm:grid-cols-2 xl:min-w-[620px] xl:grid-cols-5">
                      <span className="rounded-2xl border border-brand-red/10 px-3 py-2">{row.conversionRate}% chốt</span>
                      <span className="rounded-2xl border border-brand-red/10 px-3 py-2">{formatMoney(row.revenue)}</span>
                      <span className="rounded-2xl border border-brand-red/10 px-3 py-2">{row.averageDaysToClose} ngày</span>
                      <span className="rounded-2xl border border-brand-red/10 px-3 py-2">{row.openTaskCount} task mở</span>
                      <span className="rounded-2xl border border-brand-red/10 px-3 py-2">{row.doneTaskCount} task xong</span>
                    </div>
                  </div>
                </article>
              ))
            : null}
          {!isLoading && report && report.rows.length === 0 ? (
            <p className="rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500">Chưa có dữ liệu KPI Sale trong tháng này.</p>
          ) : null}
        </div>
      </section>

      <section className="neu-card rounded-3xl">
        <div className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-semibold text-brand-ink">Feedback phụ huynh sau khóa</h2>
            <p className="mt-1 text-sm text-stone-500">Tổng hợp nhận xét gần nhất từ cổng phụ huynh.</p>
          </div>
          <div className="neu-pressed inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-brand-red">
            <MessageSquareHeart className="h-4 w-4" />
            {feedbacks.length} feedback
          </div>
        </div>
        <div className="content-border space-y-3 p-3">
          {feedbacks.length ? (
            feedbacks.map((feedback) => (
              <article key={feedback.id} className="neu-list-item rounded-2xl p-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-brand-ink">{feedback.studentName}</h3>
                    <p className="mt-1 text-sm text-stone-500">
                      PH {feedback.parentName} - {new Date(feedback.createdAt).toLocaleDateString("vi-VN")}
                    </p>
                    {feedback.comment ? <p className="mt-3 text-sm leading-6 text-stone-600">{feedback.comment}</p> : null}
                  </div>
                  <div className="grid gap-2 text-sm text-stone-600 sm:grid-cols-2 xl:min-w-[520px] xl:grid-cols-5">
                    <span className="rounded-2xl border border-brand-red/10 px-3 py-2">{feedback.averageScore}/5 TB</span>
                    <span className="rounded-2xl border border-brand-red/10 px-3 py-2">Dạy {feedback.teachingQuality}/5</span>
                    <span className="rounded-2xl border border-brand-red/10 px-3 py-2">GV {feedback.teacherAttitude}/5</span>
                    <span className="rounded-2xl border border-brand-red/10 px-3 py-2">Tiến bộ {feedback.studentProgress}/5</span>
                    <span className="rounded-2xl border border-brand-red/10 px-3 py-2">GT {feedback.wouldRecommend}/5</span>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <p className="rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500">Chưa có feedback phụ huynh.</p>
          )}
        </div>
      </section>
    </main>
  )
}
