"use client"

import { BellRing, CheckCircle2, Download, MessageSquareText, Plus, ReceiptText, RefreshCcw, TrendingDown, TrendingUp, WalletCards } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import type { ApiResponse } from "@/lib/api-response"
import {
  expenseCategoryLabels,
  paymentMethodLabels,
  type ExpenseCategoryKey,
  type ExpenseListItem,
  type FinanceSummary,
  type PaymentMethodKey,
  type ReceiptListItem
} from "@/lib/contracts/finance"
import { payrollRunStatusLabels, type PayrollLineItem, type PayrollRunItem } from "@/lib/contracts/payroll"
import type { QueuedTuitionReminder, TuitionReminderItem, ZaloTemplateItem } from "@/lib/contracts/reminders"
import type { StudentListItem } from "@/lib/contracts/students"

type ReceiptFormState = {
  enrollmentId: string
  amount: string
  sessions: string
  method: PaymentMethodKey
  note: string
}

type ExpenseFormState = {
  category: ExpenseCategoryKey
  amount: string
  description: string
  invoiceUrl: string
  date: string
}

type PayrollLineEditState = {
  hoursWorked: string
  deductions: string
  adjustments: string
  note: string
}

const emptyReceiptForm: ReceiptFormState = {
  enrollmentId: "",
  amount: "",
  sessions: "1",
  method: "BANK_TRANSFER",
  note: ""
}

const emptyExpenseForm: ExpenseFormState = {
  category: "MATERIALS",
  amount: "",
  description: "",
  invoiceUrl: "",
  date: new Date().toISOString().slice(0, 10)
}

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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(value))
}

export default function FinancePage() {
  const [month, setMonth] = useState(getCurrentMonth)
  const [summary, setSummary] = useState<FinanceSummary | null>(null)
  const [receipts, setReceipts] = useState<ReceiptListItem[]>([])
  const [expenses, setExpenses] = useState<ExpenseListItem[]>([])
  const [payrollRuns, setPayrollRuns] = useState<PayrollRunItem[]>([])
  const [students, setStudents] = useState<StudentListItem[]>([])
  const [templates, setTemplates] = useState<ZaloTemplateItem[]>([])
  const [reminders, setReminders] = useState<TuitionReminderItem[]>([])
  const [receiptForm, setReceiptForm] = useState<ReceiptFormState>(emptyReceiptForm)
  const [expenseForm, setExpenseForm] = useState<ExpenseFormState>(emptyExpenseForm)
  const [selectedTemplateId, setSelectedTemplateId] = useState("TUITION_LOW_SESSIONS")
  const [refreshKey, setRefreshKey] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmittingReceipt, setIsSubmittingReceipt] = useState(false)
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false)
  const [isCreatingPayroll, setIsCreatingPayroll] = useState(false)
  const [payrollActionId, setPayrollActionId] = useState("")
  const [payrollLineEdits, setPayrollLineEdits] = useState<Record<string, PayrollLineEditState>>({})
  const [queueingEnrollmentId, setQueueingEnrollmentId] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadFinance() {
      setIsLoading(true)
      setError(null)

      try {
        const [summaryResponse, receiptsResponse, expensesResponse, payrollResponse, templatesResponse, remindersResponse] = await Promise.all([
          fetch(`/api/finance/summary?month=${month}`, { cache: "no-store" }),
          fetch(`/api/receipts?month=${month}`, { cache: "no-store" }),
          fetch(`/api/expenses?month=${month}`, { cache: "no-store" }),
          fetch(`/api/payroll-runs?month=${month}`, { cache: "no-store" }),
          fetch("/api/message-templates", { cache: "no-store" }),
          fetch(`/api/tuition-reminders?templateId=${selectedTemplateId}`, { cache: "no-store" })
        ])
        const [summaryPayload, receiptsPayload, expensesPayload, payrollPayload, templatesPayload, remindersPayload] = (await Promise.all([
          summaryResponse.json(),
          receiptsResponse.json(),
          expensesResponse.json(),
          payrollResponse.json(),
          templatesResponse.json(),
          remindersResponse.json()
        ])) as [
          ApiResponse<FinanceSummary>,
          ApiResponse<ReceiptListItem[]>,
          ApiResponse<ExpenseListItem[]>,
          ApiResponse<PayrollRunItem[]>,
          ApiResponse<ZaloTemplateItem[]>,
          ApiResponse<TuitionReminderItem[]>
        ]

        if (!isMounted) return

        if (summaryResponse.ok && summaryPayload.success && summaryPayload.data) {
          setSummary(summaryPayload.data)
        } else {
          setSummary(null)
        }

        if (receiptsResponse.ok && receiptsPayload.success && receiptsPayload.data) {
          setReceipts(receiptsPayload.data)
        } else {
          setReceipts([])
        }

        if (expensesResponse.ok && expensesPayload.success && expensesPayload.data) {
          setExpenses(expensesPayload.data)
        } else {
          setExpenses([])
        }

        if (payrollResponse.ok && payrollPayload.success && payrollPayload.data) {
          setPayrollRuns(payrollPayload.data)
        } else {
          setPayrollRuns([])
        }

        setTemplates(templatesPayload.success && templatesPayload.data ? templatesPayload.data : [])
        setReminders(remindersPayload.success && remindersPayload.data ? remindersPayload.data : [])

        const firstError = summaryPayload.error ?? receiptsPayload.error ?? expensesPayload.error ?? payrollPayload.error ?? templatesPayload.error ?? remindersPayload.error
        if (firstError) setError(firstError.message)
      } catch {
        if (isMounted) setError("Không tải được dữ liệu tài chính.")
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadFinance()

    return () => {
      isMounted = false
    }
  }, [month, refreshKey, selectedTemplateId])

  useEffect(() => {
    let isMounted = true

    async function loadStudents() {
      try {
        const response = await fetch("/api/students?limit=100", { cache: "no-store" })
        const payload = (await response.json()) as ApiResponse<StudentListItem[]>

        if (isMounted && response.ok && payload.success && payload.data) {
          setStudents(payload.data)
        }
      } catch {
        if (isMounted) setStudents([])
      }
    }

    loadStudents()

    return () => {
      isMounted = false
    }
  }, [])

  const summaryCards = useMemo(
    () => [
      { label: "Doanh thu gross", value: summary ? formatMoney(summary.revenue) : "0đ", icon: TrendingUp },
      { label: "Refund", value: summary ? formatMoney(summary.refundExpense) : "0đ", icon: TrendingDown },
      { label: "Doanh thu ròng", value: summary ? formatMoney(summary.netRevenue) : "0đ", icon: WalletCards },
      { label: "Chi vận hành", value: summary ? formatMoney(summary.operatingExpense) : "0đ", icon: TrendingDown },
      { label: "Lương", value: summary ? formatMoney(summary.salaryExpense) : "0đ", icon: ReceiptText },
      { label: "Lợi nhuận ròng", value: summary ? formatMoney(summary.netProfit) : "0đ", icon: WalletCards }
    ],
    [summary]
  )
  const enrollmentOptions = useMemo(
    () =>
      students.flatMap((student) =>
        student.courses.map((course) => ({
          studentName: student.name,
          parentName: student.parentName,
          enrollmentId: course.enrollmentId,
          courseName: course.courseName,
          sessionsRemaining: course.sessionsRemaining
        }))
      ),
    [students]
  )
  const payrollRun = payrollRuns[0]

  async function submitReceipt(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmittingReceipt(true)
    setError(null)

    try {
      const response = await fetch("/api/receipts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          enrollmentId: receiptForm.enrollmentId,
          amount: Number(receiptForm.amount),
          sessions: Number(receiptForm.sessions),
          method: receiptForm.method,
          note: receiptForm.note.trim() || undefined
        })
      })
      const payload = (await response.json()) as ApiResponse<ReceiptListItem>

      if (!response.ok || !payload.success) {
        setError(payload.error?.message ?? "Không tạo được phiếu thu.")
        return
      }

      setReceiptForm(emptyReceiptForm)
      setRefreshKey((current) => current + 1)
    } catch {
      setError("Không tạo được phiếu thu.")
    } finally {
      setIsSubmittingReceipt(false)
    }
  }

  async function submitExpense(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmittingExpense(true)
    setError(null)

    try {
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          category: expenseForm.category,
          amount: Number(expenseForm.amount),
          description: expenseForm.description.trim(),
          invoiceUrl: expenseForm.invoiceUrl.trim() || undefined,
          date: new Date(`${expenseForm.date}T00:00:00`).toISOString()
        })
      })
      const payload = (await response.json()) as ApiResponse<ExpenseListItem>

      if (!response.ok || !payload.success) {
        setError(payload.error?.message ?? "Không tạo được phiếu chi.")
        return
      }

      setExpenseForm(emptyExpenseForm)
      setRefreshKey((current) => current + 1)
    } catch {
      setError("Không tạo được phiếu chi.")
    } finally {
      setIsSubmittingExpense(false)
    }
  }

  async function queueReminder(reminder: TuitionReminderItem) {
    setQueueingEnrollmentId(reminder.enrollmentId)
    setError(null)

    try {
      const response = await fetch("/api/tuition-reminders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          enrollmentId: reminder.enrollmentId,
          templateId: selectedTemplateId
        })
      })
      const payload = (await response.json()) as ApiResponse<QueuedTuitionReminder>

      if (!response.ok || !payload.success) {
        setError(payload.error?.message ?? "Không tạo được task nhắc học phí.")
        return
      }

      setRefreshKey((current) => current + 1)
    } catch {
      setError("Không tạo được task nhắc học phí.")
    } finally {
      setQueueingEnrollmentId("")
    }
  }

  async function createPayrollRun() {
    setIsCreatingPayroll(true)
    setError(null)

    try {
      const response = await fetch("/api/payroll-runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ month })
      })
      const payload = (await response.json()) as ApiResponse<PayrollRunItem>

      if (!response.ok || !payload.success) {
        setError(payload.error?.message ?? "Không tạo được kỳ payroll.")
        return
      }

      setRefreshKey((current) => current + 1)
    } catch {
      setError("Không tạo được kỳ payroll.")
    } finally {
      setIsCreatingPayroll(false)
    }
  }

  async function runPayrollAction(run: PayrollRunItem, action: "generate" | "approve" | "pay") {
    setPayrollActionId(`${run.id}:${action}`)
    setError(null)

    try {
      const response = await fetch(`/api/payroll-runs/${run.id}/${action}`, {
        method: "POST"
      })
      const payload = (await response.json()) as ApiResponse<PayrollRunItem>

      if (!response.ok || !payload.success) {
        setError(payload.error?.message ?? "Không cập nhật được payroll.")
        return
      }

      setPayrollLineEdits({})
      setRefreshKey((current) => current + 1)
    } catch {
      setError("Không cập nhật được payroll.")
    } finally {
      setPayrollActionId("")
    }
  }

  async function savePayrollLine(run: PayrollRunItem, line: PayrollLineItem) {
    const edit = payrollLineEdits[line.id]

    if (!edit?.note.trim()) {
      setError("Điều chỉnh payroll cần ghi chú.")
      return
    }

    setPayrollActionId(`${run.id}:line:${line.id}`)
    setError(null)

    try {
      const response = await fetch(`/api/payroll-runs/${run.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lines: [{
            id: line.id,
            hoursWorked: edit.hoursWorked || line.hoursWorked,
            deductions: edit.deductions || line.deductions,
            adjustments: edit.adjustments || line.adjustments,
            note: edit.note.trim()
          }]
        })
      })
      const payload = (await response.json()) as ApiResponse<PayrollRunItem>

      if (!response.ok || !payload.success) {
        setError(payload.error?.message ?? "Không lưu được dòng payroll.")
        return
      }

      setPayrollLineEdits((current) => {
        const next = { ...current }
        delete next[line.id]
        return next
      })
      setRefreshKey((current) => current + 1)
    } catch {
      setError("Không lưu được dòng payroll.")
    } finally {
      setPayrollActionId("")
    }
  }

  function updatePayrollLineEdit(line: PayrollLineItem, patch: Partial<PayrollLineEditState>) {
    setPayrollLineEdits((current) => ({
      ...current,
      [line.id]: {
        hoursWorked: current[line.id]?.hoursWorked ?? "",
        deductions: current[line.id]?.deductions ?? "",
        adjustments: current[line.id]?.adjustments ?? "",
        note: current[line.id]?.note ?? "",
        ...patch
      }
    }))
  }

  return (
    <main className="space-y-6">
      <div className="neu-card rounded-3xl p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-red">Finance</p>
            <h1 className="mt-2 text-3xl font-semibold text-brand-ink">Tài chính</h1>
            <p className="mt-2 max-w-2xl text-sm text-stone-600">
              Phiếu thu, phiếu chi, dashboard tháng và export Excel đối soát.
            </p>
          </div>
          <label className="text-sm font-medium text-stone-600">
            Tháng
            <input
              className="neu-pressed mt-2 block rounded-2xl bg-transparent px-4 py-3 text-brand-ink outline-none"
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
          </label>
          <a
            className="glass-button-primary inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold"
            href="/api/exports/students-finance"
          >
            <Download className="h-4 w-4" />
            Xuất Excel toàn bộ
          </a>
        </div>
      </div>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
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
                <p className="mt-4 text-3xl font-semibold text-brand-ink">{card.value}</p>
              </div>
            </div>
          )
        })}
      </section>
      {error ? (
        <p className="rounded-3xl border border-brand-red/15 bg-white/50 p-4 text-sm text-brand-red">{error}</p>
      ) : null}
      <section className="neu-card rounded-3xl">
        <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-red">Payroll</p>
            <h2 className="mt-2 font-semibold text-brand-ink">Payroll tháng {month}</h2>
            <p className="mt-1 max-w-2xl text-sm text-stone-500">
              Sinh bảng lương từ hồ sơ nhân sự, giờ dạy đã duyệt và nghỉ không lương; khi chi sẽ tạo phiếu chi lương liên kết.
            </p>
          </div>
          {payrollRun ? (
            <div className="flex flex-wrap gap-2">
              <span className="rounded-2xl border border-brand-red/10 px-3 py-2 text-xs font-semibold text-brand-red">
                {payrollRunStatusLabels[payrollRun.status]}
              </span>
              {payrollRun.status === "DRAFT" ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-2xl border border-brand-red/15 px-3 py-2 text-xs font-semibold text-brand-red disabled:opacity-50"
                  disabled={payrollActionId === `${payrollRun.id}:generate`}
                  onClick={() => void runPayrollAction(payrollRun, "generate")}
                >
                  <RefreshCcw className="h-3.5 w-3.5" />
                  {payrollActionId === `${payrollRun.id}:generate` ? "Đang sinh" : "Sinh lại dòng"}
                </button>
              ) : null}
              {payrollRun.status === "DRAFT" && payrollRun.lineCount > 0 ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-2xl bg-brand-red px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  disabled={payrollActionId === `${payrollRun.id}:approve`}
                  onClick={() => void runPayrollAction(payrollRun, "approve")}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {payrollActionId === `${payrollRun.id}:approve` ? "Đang duyệt" : "Duyệt payroll"}
                </button>
              ) : null}
              {payrollRun.status === "APPROVED" ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-2xl bg-brand-red px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  disabled={payrollActionId === `${payrollRun.id}:pay`}
                  onClick={() => void runPayrollAction(payrollRun, "pay")}
                >
                  <WalletCards className="h-3.5 w-3.5" />
                  {payrollActionId === `${payrollRun.id}:pay` ? "Đang chi" : "Tạo phiếu chi lương"}
                </button>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              className="glass-button-primary inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isCreatingPayroll}
              onClick={() => void createPayrollRun()}
            >
              <Plus className="h-4 w-4" />
              {isCreatingPayroll ? "Đang tạo" : "Tạo payroll tháng"}
            </button>
          )}
        </div>
        <div className="content-border grid gap-3 p-5 md:grid-cols-4">
          <PayrollMetric label="Tổng gross" value={payrollRun ? formatMoney(payrollRun.totalGrossAmount) : "0đ"} />
          <PayrollMetric label="Khấu trừ" value={payrollRun ? formatMoney(payrollRun.totalDeductions) : "0đ"} />
          <PayrollMetric label="Thưởng/điều chỉnh" value={payrollRun ? formatMoney(payrollRun.totalAdjustments) : "0đ"} />
          <PayrollMetric label="Cần chi" value={payrollRun ? formatMoney(payrollRun.totalFinalAmount) : "0đ"} />
        </div>
        {payrollRun ? (
          <div className="content-border space-y-3 p-5">
            {payrollRun.lines.length ? (
              payrollRun.lines.map((line) => {
                const edit = payrollLineEdits[line.id]
                const isSavingLine = payrollActionId === `${payrollRun.id}:line:${line.id}`

                return (
                  <article key={line.id} className="neu-list-item rounded-2xl p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-brand-ink">{line.staffName}</p>
                        <p className="mt-1 text-xs text-stone-500">
                          {line.employmentType === "FULL_TIME" ? "Toàn thời gian" : "Bán thời gian"} - {line.hoursWorked}h - gross {formatMoney(line.grossAmount)}
                        </p>
                        <p className="mt-1 text-xs text-stone-500">
                          Khấu trừ {formatMoney(line.deductions)} - Điều chỉnh {formatMoney(line.adjustments)}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-brand-red">{formatMoney(line.finalAmount)}</p>
                    </div>
                    {line.note ? <p className="mt-3 rounded-2xl border border-brand-red/10 bg-white/35 p-3 text-xs text-stone-600">{line.note}</p> : null}
                    {payrollRun.status === "DRAFT" ? (
                      <div className="mt-4 grid gap-3 md:grid-cols-5">
                        <FinanceInput
                          label="Giờ"
                          type="number"
                          min="0"
                          value={edit?.hoursWorked ?? ""}
                          onChange={(value) => updatePayrollLineEdit(line, { hoursWorked: value })}
                        />
                        <FinanceInput
                          label="Khấu trừ"
                          type="number"
                          value={edit?.deductions ?? ""}
                          onChange={(value) => updatePayrollLineEdit(line, { deductions: value })}
                        />
                        <FinanceInput
                          label="Điều chỉnh"
                          type="number"
                          value={edit?.adjustments ?? ""}
                          onChange={(value) => updatePayrollLineEdit(line, { adjustments: value })}
                        />
                        <FinanceInput
                          label="Ghi chú"
                          value={edit?.note ?? ""}
                          onChange={(value) => updatePayrollLineEdit(line, { note: value })}
                        />
                        <button
                          type="button"
                          className="self-end rounded-2xl border border-brand-red/15 px-3 py-3 text-xs font-semibold text-brand-red disabled:opacity-50"
                          disabled={isSavingLine}
                          onClick={() => void savePayrollLine(payrollRun, line)}
                        >
                          {isSavingLine ? "Đang lưu" : "Lưu chỉnh"}
                        </button>
                      </div>
                    ) : null}
                  </article>
                )
              })
            ) : (
              <p className="rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500">
                Kỳ payroll chưa có dòng lương. Bấm sinh lại dòng để lấy hồ sơ nhân sự và giờ đã duyệt.
              </p>
            )}
            {payrollRun.salaryExpenseCode ? (
              <p className="rounded-2xl border border-brand-red/10 bg-white/35 p-4 text-sm text-stone-600">
                Đã tạo phiếu chi lương {payrollRun.salaryExpenseCode} - {formatMoney(payrollRun.salaryExpenseAmount ?? "0")}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="content-border p-5">
            <p className="rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500">Chưa có payroll cho tháng đang chọn.</p>
          </div>
        )}
      </section>
      <section className="neu-card rounded-3xl">
        <div className="flex flex-col gap-4 p-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-red">Automation</p>
            <h2 className="mt-2 font-semibold text-brand-ink">Nhắc học phí qua Zalo template</h2>
            <p className="mt-1 text-sm text-stone-500">Tự tạo nội dung từ template duyệt sẵn cho học viên còn ít buổi.</p>
          </div>
          <label className="text-sm font-medium text-stone-600">
            Template
            <select
              className="neu-pressed mt-2 block rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none"
              value={selectedTemplateId}
              onChange={(event) => setSelectedTemplateId(event.target.value)}
            >
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="content-border grid gap-3 p-5 lg:grid-cols-2">
          {reminders.length ? (
            reminders.slice(0, 6).map((reminder) => (
              <article key={reminder.enrollmentId} className="neu-list-item rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-brand-ink">{reminder.studentName}</p>
                    <p className="mt-1 text-xs text-stone-500">
                      PH {reminder.parentName} - {reminder.parentPhone} - {reminder.courseName}
                    </p>
                  </div>
                  <span className="rounded-2xl border border-brand-red/10 px-3 py-2 text-xs font-semibold text-brand-red">
                    Còn {reminder.sessionsRemaining}
                  </span>
                </div>
                <p className="mt-3 rounded-2xl border border-brand-red/10 bg-white/35 p-3 text-xs leading-5 text-stone-600">{reminder.message}</p>
                <button
                  type="button"
                  className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-brand-red px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  disabled={queueingEnrollmentId === reminder.enrollmentId}
                  onClick={() => void queueReminder(reminder)}
                >
                  <BellRing className="h-3.5 w-3.5" />
                  {queueingEnrollmentId === reminder.enrollmentId ? "Đang tạo" : "Tạo task nhắc"}
                </button>
              </article>
            ))
          ) : (
            <p className="rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500">Không có học viên cần nhắc học phí theo ngưỡng hiện tại.</p>
          )}
        </div>
        {templates.length ? (
          <div className="content-border flex items-center gap-2 px-5 py-4 text-xs text-stone-500">
            <MessageSquareText className="h-4 w-4 text-brand-red" />
            {templates.length} template Zalo đã duyệt sẵn trong hệ thống.
          </div>
        ) : null}
      </section>
      <section className="grid gap-4 xl:grid-cols-2">
        <form className="neu-card rounded-3xl" onSubmit={submitReceipt}>
          <div className="p-5">
            <h2 className="font-semibold text-brand-ink">Tạo phiếu thu</h2>
            <p className="mt-1 text-sm text-stone-500">Ghi nhận học phí và tự cộng số buổi vào khóa đã đăng ký.</p>
          </div>
          <div className="content-border grid gap-3 p-5 md:grid-cols-2">
            <select
              className="neu-pressed rounded-2xl bg-transparent px-4 py-3 text-sm font-medium text-brand-ink outline-none md:col-span-2"
              value={receiptForm.enrollmentId}
              onChange={(event) => setReceiptForm((current) => ({ ...current, enrollmentId: event.target.value }))}
              required
            >
              <option value="">Chọn học viên / khóa học</option>
              {enrollmentOptions.map((option) => (
                <option key={option.enrollmentId} value={option.enrollmentId}>
                  {option.studentName} - {option.courseName} - còn {option.sessionsRemaining} buổi
                </option>
              ))}
            </select>
            <FinanceInput
              label="Số tiền"
              type="number"
              min="1"
              value={receiptForm.amount}
              onChange={(value) => setReceiptForm((current) => ({ ...current, amount: value }))}
              required
            />
            <FinanceInput
              label="Số buổi cộng"
              type="number"
              min="1"
              value={receiptForm.sessions}
              onChange={(value) => setReceiptForm((current) => ({ ...current, sessions: value }))}
              required
            />
            <select
              className="neu-pressed rounded-2xl bg-transparent px-4 py-3 text-sm font-medium text-brand-ink outline-none"
              value={receiptForm.method}
              onChange={(event) => setReceiptForm((current) => ({ ...current, method: event.target.value as PaymentMethodKey }))}
            >
              {Object.entries(paymentMethodLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <FinanceInput
              label="Ghi chú"
              value={receiptForm.note}
              onChange={(value) => setReceiptForm((current) => ({ ...current, note: value }))}
            />
          </div>
          <div className="flex justify-end p-5">
            <button
              type="submit"
              disabled={isSubmittingReceipt}
              className="glass-button-primary inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              {isSubmittingReceipt ? "Đang lưu" : "Lưu phiếu thu"}
            </button>
          </div>
        </form>
        <form className="neu-card rounded-3xl" onSubmit={submitExpense}>
          <div className="p-5">
            <h2 className="font-semibold text-brand-ink">Tạo phiếu chi</h2>
            <p className="mt-1 text-sm text-stone-500">Ghi nhận chi phí vận hành theo danh mục.</p>
          </div>
          <div className="content-border grid gap-3 p-5 md:grid-cols-2">
            <select
              className="neu-pressed rounded-2xl bg-transparent px-4 py-3 text-sm font-medium text-brand-ink outline-none"
              value={expenseForm.category}
              onChange={(event) => setExpenseForm((current) => ({ ...current, category: event.target.value as ExpenseCategoryKey }))}
            >
              {Object.entries(expenseCategoryLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <FinanceInput
              label="Ngày chi"
              type="date"
              value={expenseForm.date}
              onChange={(value) => setExpenseForm((current) => ({ ...current, date: value }))}
              required
            />
            <FinanceInput
              label="Số tiền"
              type="number"
              min="1"
              value={expenseForm.amount}
              onChange={(value) => setExpenseForm((current) => ({ ...current, amount: value }))}
              required
            />
            <FinanceInput
              label="Invoice URL"
              type="url"
              value={expenseForm.invoiceUrl}
              onChange={(value) => setExpenseForm((current) => ({ ...current, invoiceUrl: value }))}
            />
            <label className="md:col-span-2">
              <span className="text-sm font-medium text-stone-600">Mô tả</span>
              <textarea
                className="neu-pressed mt-2 min-h-20 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none placeholder:text-stone-400"
                value={expenseForm.description}
                onChange={(event) => setExpenseForm((current) => ({ ...current, description: event.target.value }))}
                required
              />
            </label>
          </div>
          <div className="flex justify-end p-5">
            <button
              type="submit"
              disabled={isSubmittingExpense}
              className="glass-button-primary inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              {isSubmittingExpense ? "Đang lưu" : "Lưu phiếu chi"}
            </button>
          </div>
        </form>
      </section>
      <section className="grid gap-4 xl:grid-cols-2">
        <div className="neu-card rounded-3xl">
          <h2 className="p-5 font-semibold text-brand-ink">Phiếu thu gần đây</h2>
          <div className="content-border space-y-3 p-5">
            {isLoading ? (
              <p className="rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500">Đang tải phiếu thu...</p>
            ) : receipts.length ? (
              receipts.slice(0, 8).map((receipt) => (
                <article key={receipt.id} className="neu-list-item rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-brand-ink">{receipt.code}</p>
                      <p className="mt-1 text-xs text-stone-500">
                        {receipt.studentName} - {receipt.courseName}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-brand-red">{formatMoney(receipt.amount)}</p>
                  </div>
                  <p className="mt-3 text-xs text-stone-500">
                    {paymentMethodLabels[receipt.method]} - {receipt.sessions} buổi - {formatDate(receipt.createdAt)}
                  </p>
                </article>
              ))
            ) : (
              <p className="rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500">Chưa có phiếu thu trong tháng.</p>
            )}
          </div>
        </div>
        <div className="neu-card rounded-3xl">
          <h2 className="p-5 font-semibold text-brand-ink">Phiếu chi gần đây</h2>
          <div className="content-border space-y-3 p-5">
            {isLoading ? (
              <p className="rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500">Đang tải phiếu chi...</p>
            ) : expenses.length ? (
              expenses.slice(0, 8).map((expense) => (
                <article key={expense.id} className="neu-list-item rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-brand-ink">{expense.code}</p>
                      <p className="mt-1 text-xs text-stone-500">{expense.description}</p>
                    </div>
                    <p className="text-sm font-semibold text-brand-red">{formatMoney(expense.amount)}</p>
                  </div>
                  <p className="mt-3 text-xs text-stone-500">
                    {expenseCategoryLabels[expense.category]} - {formatDate(expense.date)}
                  </p>
                  {expense.refundEntitlementId ? (
                    <p className="mt-2 inline-flex rounded-full border border-brand-red/10 px-2 py-1 text-[11px] font-semibold text-brand-red">
                      Refund{expense.refundStudentName ? ` - ${expense.refundStudentName}` : ""}
                    </p>
                  ) : null}
                </article>
              ))
            ) : (
              <p className="rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500">Chưa có phiếu chi trong tháng.</p>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}

function FinanceInput({
  label,
  type = "text",
  value,
  onChange,
  required = false,
  min
}: {
  label: string
  type?: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  min?: string
}) {
  return (
    <label>
      <span className="text-sm font-medium text-stone-600">{label}</span>
      <input
        className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none placeholder:text-stone-400"
        min={min}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      />
    </label>
  )
}

function PayrollMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="neu-pressed rounded-2xl p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-brand-ink">{value}</p>
    </div>
  )
}
