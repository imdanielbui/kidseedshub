"use client"

import { DialogFormShell } from "@/components/shared/dialog-shell"
import { BarChart3, BellRing, CheckCircle2, Download, FileText, Lock, MessageSquareText, Plus, ReceiptText, RefreshCcw, TrendingDown, TrendingUp, WalletCards } from "lucide-react"
import { useEffect, useMemo, useState, type FormEvent } from "react"
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

type FinanceRole = "ADMIN" | "SALE" | "TEACHER" | "PARENT"
type FinanceTab = "overview" | "receipts" | "expenses" | "payroll" | "reminders"
type FinanceDialog = "receipt" | "expense" | null

type SessionPayload = {
  user?: {
    role?: FinanceRole
  }
} | null

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

function getReceiptTotal(receipts: ReceiptListItem[]) {
  return receipts.reduce((total, receipt) => total + Number(receipt.amount), 0)
}

export default function FinancePage() {
  const [month, setMonth] = useState(getCurrentMonth)
  const [activeTab, setActiveTab] = useState<FinanceTab>("overview")
  const [activeDialog, setActiveDialog] = useState<FinanceDialog>(null)
  const [sessionRole, setSessionRole] = useState<FinanceRole | null>(null)
  const [isLoadingSession, setIsLoadingSession] = useState(true)
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

  const isAdmin = sessionRole === "ADMIN"
  const isSale = sessionRole === "SALE"
  const canUseFinance = isAdmin || isSale
  const canCreateReceipt = isAdmin || isSale
  const canManageReminders = isAdmin || isSale

  const availableTabs = useMemo(
    () => [
      { id: "overview" as const, label: "Tổng quan", icon: BarChart3, isAvailable: canUseFinance },
      { id: "receipts" as const, label: "Phiếu thu", icon: ReceiptText, isAvailable: canUseFinance },
      { id: "expenses" as const, label: "Phiếu chi", icon: FileText, isAvailable: isAdmin },
      { id: "payroll" as const, label: "Payroll", icon: WalletCards, isAvailable: isAdmin },
      { id: "reminders" as const, label: "Nhắc học phí", icon: BellRing, isAvailable: canManageReminders }
    ].filter((tab) => tab.isAvailable),
    [canManageReminders, canUseFinance, isAdmin]
  )

  useEffect(() => {
    let isMounted = true

    async function loadSessionRole() {
      setIsLoadingSession(true)

      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" })
        const payload = (await response.json()) as SessionPayload

        if (!isMounted) return

        setSessionRole(payload?.user?.role ?? null)
      } catch {
        if (isMounted) setSessionRole(null)
      } finally {
        if (isMounted) setIsLoadingSession(false)
      }
    }

    loadSessionRole()

    return () => {
      isMounted = false
    }
  }, [])

  const selectedTab = availableTabs.some((tab) => tab.id === activeTab) ? activeTab : availableTabs[0]?.id

  useEffect(() => {
    if (isLoadingSession) return

    let isMounted = true

    async function loadFinance() {
      if (!canUseFinance) {
        setSummary(null)
        setReceipts([])
        setExpenses([])
        setPayrollRuns([])
        setTemplates([])
        setReminders([])
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        const summaryRequest = isAdmin ? fetch(`/api/finance/summary?month=${month}`, { cache: "no-store" }) : null
        const receiptsRequest = fetch(`/api/receipts?month=${month}`, { cache: "no-store" })
        const expensesRequest = isAdmin ? fetch(`/api/expenses?month=${month}`, { cache: "no-store" }) : null
        const payrollRequest = isAdmin ? fetch(`/api/payroll-runs?month=${month}`, { cache: "no-store" }) : null
        const templatesRequest = canManageReminders ? fetch("/api/message-templates", { cache: "no-store" }) : null
        const remindersRequest = canManageReminders ? fetch(`/api/tuition-reminders?templateId=${selectedTemplateId}`, { cache: "no-store" }) : null

        const [summaryResult, receiptsResult, expensesResult, payrollResult, templatesResult, remindersResult] = await Promise.all([
          summaryRequest ? summaryRequest.then(async (response) => ({ response, payload: await response.json() as ApiResponse<FinanceSummary> })) : Promise.resolve(null),
          receiptsRequest.then(async (response) => ({ response, payload: await response.json() as ApiResponse<ReceiptListItem[]> })),
          expensesRequest ? expensesRequest.then(async (response) => ({ response, payload: await response.json() as ApiResponse<ExpenseListItem[]> })) : Promise.resolve(null),
          payrollRequest ? payrollRequest.then(async (response) => ({ response, payload: await response.json() as ApiResponse<PayrollRunItem[]> })) : Promise.resolve(null),
          templatesRequest ? templatesRequest.then(async (response) => ({ response, payload: await response.json() as ApiResponse<ZaloTemplateItem[]> })) : Promise.resolve(null),
          remindersRequest ? remindersRequest.then(async (response) => ({ response, payload: await response.json() as ApiResponse<TuitionReminderItem[]> })) : Promise.resolve(null)
        ])

        if (!isMounted) return

        setSummary(summaryResult?.response.ok && summaryResult.payload.success && summaryResult.payload.data ? summaryResult.payload.data : null)
        setReceipts(receiptsResult.response.ok && receiptsResult.payload.success && receiptsResult.payload.data ? receiptsResult.payload.data : [])
        setExpenses(expensesResult?.response.ok && expensesResult.payload.success && expensesResult.payload.data ? expensesResult.payload.data : [])
        setPayrollRuns(payrollResult?.response.ok && payrollResult.payload.success && payrollResult.payload.data ? payrollResult.payload.data : [])
        setTemplates(templatesResult?.response.ok && templatesResult.payload.success && templatesResult.payload.data ? templatesResult.payload.data : [])
        setReminders(remindersResult?.response.ok && remindersResult.payload.success && remindersResult.payload.data ? remindersResult.payload.data : [])

        const firstError = [summaryResult, receiptsResult, expensesResult, payrollResult, templatesResult, remindersResult]
          .map((result) => result?.payload.error)
          .find(Boolean)
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
  }, [canManageReminders, canUseFinance, isAdmin, isLoadingSession, month, refreshKey, selectedTemplateId])

  useEffect(() => {
    if (!canCreateReceipt) return

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
  }, [canCreateReceipt])

  const adminSummaryCards = useMemo(
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
  const saleSummaryCards = useMemo(
    () => [
      { label: "Doanh thu của bạn", value: formatMoney(String(getReceiptTotal(receipts))), icon: TrendingUp },
      { label: "Phiếu thu", value: `${receipts.length} phiếu`, icon: ReceiptText },
      { label: "Số buổi đã bán", value: `${receipts.reduce((total, receipt) => total + receipt.sessions, 0)} buổi`, icon: WalletCards }
    ],
    [receipts]
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

  async function submitReceipt(event: FormEvent<HTMLFormElement>) {
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
      setActiveDialog(null)
      setRefreshKey((current) => current + 1)
    } catch {
      setError("Không tạo được phiếu thu.")
    } finally {
      setIsSubmittingReceipt(false)
    }
  }

  async function submitExpense(event: FormEvent<HTMLFormElement>) {
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
      setActiveDialog(null)
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

  const isPageLoading = isLoadingSession || isLoading

  return (
    <main className="space-y-4">
      <section className="neu-card rounded-3xl p-4 md:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-red">Finance</p>
            <h1 className="mt-2 text-2xl font-semibold text-brand-ink md:text-3xl">Tài chính</h1>
            <p className="mt-1 max-w-2xl text-sm text-stone-600">
              Đối soát theo tháng, xử lý phiếu thu, payroll và nhắc học phí trong từng tab.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end xl:justify-end">
            <label className="text-sm font-medium text-stone-600">
              Tháng
              <input
                className="neu-pressed mt-2 block rounded-2xl bg-transparent px-4 py-3 text-brand-ink outline-none"
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="neu-list-item inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-stone-600 hover:text-brand-red"
                onClick={() => setRefreshKey((current) => current + 1)}
              >
                <RefreshCcw className="h-4 w-4" />
                Tải lại
              </button>
              {canCreateReceipt ? (
                <button
                  type="button"
                  className="glass-button-primary inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold"
                  onClick={() => setActiveDialog("receipt")}
                >
                  <Plus className="h-4 w-4" />
                  Phiếu thu
                </button>
              ) : null}
              {isAdmin ? (
                <>
                  <button
                    type="button"
                    className="neu-list-item inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-stone-600 hover:text-brand-red"
                    onClick={() => setActiveDialog("expense")}
                  >
                    <Plus className="h-4 w-4" />
                    Phiếu chi
                  </button>
                  <a
                    className="glass-button-primary inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold"
                    href="/api/exports/students-finance"
                  >
                    <Download className="h-4 w-4" />
                    Xuất Excel
                  </a>
                </>
              ) : null}
            </div>
          </div>
        </div>
        <div className="content-border mt-5 pt-4">
          {availableTabs.length ? (
            <div className="neu-pressed flex gap-1 overflow-x-auto rounded-2xl p-1">
              {availableTabs.map((tab) => {
                const Icon = tab.icon
                const isActive = selectedTab === tab.id

                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                      isActive ? "bg-brand-red text-white" : "text-stone-600 hover:text-brand-red"
                    }`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                )
              })}
            </div>
          ) : (
            <PermissionState />
          )}
        </div>
      </section>

      {error ? (
        <p className="rounded-3xl border border-brand-red/15 bg-white/50 p-4 text-sm text-brand-red">{error}</p>
      ) : null}

      {!isLoadingSession && !canUseFinance ? (
        <PermissionState />
      ) : null}

      {canUseFinance && selectedTab === "overview" ? (
        <OverviewTab
          cards={isAdmin ? adminSummaryCards : saleSummaryCards}
          isAdmin={isAdmin}
          isLoading={isPageLoading}
          receipts={receipts}
          expenses={expenses}
          summary={summary}
        />
      ) : null}

      {canUseFinance && selectedTab === "receipts" ? (
        <ReceiptsTab
          canCreateReceipt={canCreateReceipt}
          isLoading={isPageLoading}
          receipts={receipts}
          onCreate={() => setActiveDialog("receipt")}
        />
      ) : null}

      {isAdmin && selectedTab === "expenses" ? (
        <ExpensesTab
          expenses={expenses}
          isLoading={isPageLoading}
          onCreate={() => setActiveDialog("expense")}
        />
      ) : null}

      {isAdmin && selectedTab === "payroll" ? (
        <PayrollTab
          isCreatingPayroll={isCreatingPayroll}
          payrollActionId={payrollActionId}
          payrollLineEdits={payrollLineEdits}
          payrollRun={payrollRun}
          month={month}
          onCreatePayroll={() => void createPayrollRun()}
          onRunPayrollAction={(run, action) => void runPayrollAction(run, action)}
          onSavePayrollLine={(run, line) => void savePayrollLine(run, line)}
          onUpdatePayrollLineEdit={updatePayrollLineEdit}
        />
      ) : null}

      {canManageReminders && selectedTab === "reminders" ? (
        <RemindersTab
          queueingEnrollmentId={queueingEnrollmentId}
          reminders={reminders}
          selectedTemplateId={selectedTemplateId}
          templates={templates}
          onQueue={(reminder) => void queueReminder(reminder)}
          onSelectTemplate={setSelectedTemplateId}
        />
      ) : null}

      {activeDialog === "receipt" ? (
        <DialogFormShell
          title="Tạo phiếu thu"
          eyebrow="Receipt"
          description="Ghi nhận học phí và cộng số buổi vào khóa đã đăng ký."
          onClose={() => setActiveDialog(null)}
          onSubmit={submitReceipt}
          size="lg"
          footer={
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button type="button" className="neu-list-item rounded-2xl px-4 py-3 text-sm font-semibold text-stone-600 hover:text-brand-red" onClick={() => setActiveDialog(null)}>
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmittingReceipt}
                className="glass-button-primary inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                {isSubmittingReceipt ? "Đang lưu" : "Lưu phiếu thu"}
              </button>
            </div>
          }
        >
          <div className="grid gap-3 md:grid-cols-2">
            <label className="md:col-span-2">
              <span className="text-sm font-medium text-stone-600">Học viên / khóa học</span>
              <select
                className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm font-medium text-brand-ink outline-none"
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
            </label>
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
            <label>
              <span className="text-sm font-medium text-stone-600">Phương thức</span>
              <select
                className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm font-medium text-brand-ink outline-none"
                value={receiptForm.method}
                onChange={(event) => setReceiptForm((current) => ({ ...current, method: event.target.value as PaymentMethodKey }))}
              >
                {Object.entries(paymentMethodLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <FinanceInput
              label="Ghi chú"
              value={receiptForm.note}
              onChange={(value) => setReceiptForm((current) => ({ ...current, note: value }))}
            />
          </div>
        </DialogFormShell>
      ) : null}

      {activeDialog === "expense" && isAdmin ? (
        <DialogFormShell
          title="Tạo phiếu chi"
          eyebrow="Expense"
          description="Ghi nhận chi phí vận hành theo danh mục."
          onClose={() => setActiveDialog(null)}
          onSubmit={submitExpense}
          size="lg"
          footer={
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button type="button" className="neu-list-item rounded-2xl px-4 py-3 text-sm font-semibold text-stone-600 hover:text-brand-red" onClick={() => setActiveDialog(null)}>
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmittingExpense}
                className="glass-button-primary inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                {isSubmittingExpense ? "Đang lưu" : "Lưu phiếu chi"}
              </button>
            </div>
          }
        >
          <div className="grid gap-3 md:grid-cols-2">
            <label>
              <span className="text-sm font-medium text-stone-600">Danh mục</span>
              <select
                className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm font-medium text-brand-ink outline-none"
                value={expenseForm.category}
                onChange={(event) => setExpenseForm((current) => ({ ...current, category: event.target.value as ExpenseCategoryKey }))}
              >
                {Object.entries(expenseCategoryLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
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
                className="neu-pressed mt-2 min-h-24 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none placeholder:text-stone-400"
                value={expenseForm.description}
                onChange={(event) => setExpenseForm((current) => ({ ...current, description: event.target.value }))}
                required
              />
            </label>
          </div>
        </DialogFormShell>
      ) : null}
    </main>
  )
}

function OverviewTab({
  cards,
  expenses,
  isAdmin,
  isLoading,
  receipts,
  summary
}: {
  cards: Array<{ label: string; value: string; icon: typeof TrendingUp }>
  expenses: ExpenseListItem[]
  isAdmin: boolean
  isLoading: boolean
  receipts: ReceiptListItem[]
  summary: FinanceSummary | null
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {cards.map((card) => {
            const Icon = card.icon
            return (
              <div key={card.label} className="neu-card rounded-3xl p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-stone-500">{card.label}</p>
                  <div className="neu-pressed flex h-10 w-10 items-center justify-center rounded-2xl">
                    <Icon className="h-5 w-5 text-brand-red" />
                  </div>
                </div>
                <p className="mt-4 text-2xl font-semibold text-brand-ink">{card.value}</p>
              </div>
            )
          })}
        </div>
        {isAdmin ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <SummaryBreakdown
              title="Theo phương thức thu"
              emptyText="Chưa có phiếu thu trong tháng."
              rows={summary?.receiptsByMethod.map((row) => ({
                key: row.method,
                label: paymentMethodLabels[row.method],
                amount: row.amount,
                count: row.count
              })) ?? []}
            />
            <SummaryBreakdown
              title="Theo danh mục chi"
              emptyText="Chưa có phiếu chi trong tháng."
              rows={summary?.expensesByCategory.map((row) => ({
                key: row.category,
                label: expenseCategoryLabels[row.category],
                amount: row.amount,
                count: row.count
              })) ?? []}
            />
          </div>
        ) : null}
      </div>
      <div className="neu-card rounded-3xl">
        <SectionHeader title="Hoạt động gần đây" eyebrow={isAdmin ? "Ledger" : "Sale ledger"} />
        <div className="content-border max-h-[62vh] space-y-3 overflow-auto p-4">
          {isLoading ? (
            <PanelState text="Đang tải hoạt động tài chính..." />
          ) : receipts.length || expenses.length ? (
            <>
              {receipts.slice(0, 5).map((receipt) => <ReceiptItem key={receipt.id} receipt={receipt} compact />)}
              {isAdmin ? expenses.slice(0, 5).map((expense) => <ExpenseItem key={expense.id} expense={expense} compact />) : null}
            </>
          ) : (
            <PanelState text="Chưa có hoạt động trong tháng." />
          )}
        </div>
      </div>
    </section>
  )
}

function ReceiptsTab({
  canCreateReceipt,
  isLoading,
  onCreate,
  receipts
}: {
  canCreateReceipt: boolean
  isLoading: boolean
  onCreate: () => void
  receipts: ReceiptListItem[]
}) {
  return (
    <section className="neu-card rounded-3xl">
      <SectionHeader
        title="Sổ phiếu thu"
        eyebrow="Receipts"
        action={canCreateReceipt ? (
          <button type="button" className="glass-button-primary inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold" onClick={onCreate}>
            <Plus className="h-4 w-4" />
            Tạo phiếu thu
          </button>
        ) : null}
      />
      <div className="content-border max-h-[68vh] space-y-3 overflow-auto p-4">
        {isLoading ? (
          <PanelState text="Đang tải phiếu thu..." />
        ) : receipts.length ? (
          receipts.map((receipt) => <ReceiptItem key={receipt.id} receipt={receipt} />)
        ) : (
          <PanelState text="Chưa có phiếu thu trong tháng." />
        )}
      </div>
    </section>
  )
}

function ExpensesTab({
  expenses,
  isLoading,
  onCreate
}: {
  expenses: ExpenseListItem[]
  isLoading: boolean
  onCreate: () => void
}) {
  return (
    <section className="neu-card rounded-3xl">
      <SectionHeader
        title="Sổ phiếu chi"
        eyebrow="Expenses"
        action={
          <button type="button" className="glass-button-primary inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold" onClick={onCreate}>
            <Plus className="h-4 w-4" />
            Tạo phiếu chi
          </button>
        }
      />
      <div className="content-border max-h-[68vh] space-y-3 overflow-auto p-4">
        {isLoading ? (
          <PanelState text="Đang tải phiếu chi..." />
        ) : expenses.length ? (
          expenses.map((expense) => <ExpenseItem key={expense.id} expense={expense} />)
        ) : (
          <PanelState text="Chưa có phiếu chi trong tháng." />
        )}
      </div>
    </section>
  )
}

function PayrollTab({
  isCreatingPayroll,
  month,
  onCreatePayroll,
  onRunPayrollAction,
  onSavePayrollLine,
  onUpdatePayrollLineEdit,
  payrollActionId,
  payrollLineEdits,
  payrollRun
}: {
  isCreatingPayroll: boolean
  month: string
  onCreatePayroll: () => void
  onRunPayrollAction: (run: PayrollRunItem, action: "generate" | "approve" | "pay") => void
  onSavePayrollLine: (run: PayrollRunItem, line: PayrollLineItem) => void
  onUpdatePayrollLineEdit: (line: PayrollLineItem, patch: Partial<PayrollLineEditState>) => void
  payrollActionId: string
  payrollLineEdits: Record<string, PayrollLineEditState>
  payrollRun?: PayrollRunItem
}) {
  return (
    <section className="neu-card rounded-3xl">
      <SectionHeader
        title={`Payroll tháng ${month}`}
        eyebrow="Payroll"
        action={payrollRun ? (
          <div className="flex flex-wrap gap-2">
            <span className="rounded-2xl border border-brand-red/10 px-3 py-2 text-xs font-semibold text-brand-red">
              {payrollRunStatusLabels[payrollRun.status]}
            </span>
            {payrollRun.status === "DRAFT" ? (
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-2xl border border-brand-red/15 px-3 py-2 text-xs font-semibold text-brand-red disabled:opacity-50"
                disabled={payrollActionId === `${payrollRun.id}:generate`}
                onClick={() => onRunPayrollAction(payrollRun, "generate")}
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
                onClick={() => onRunPayrollAction(payrollRun, "approve")}
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
                onClick={() => onRunPayrollAction(payrollRun, "pay")}
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
            onClick={onCreatePayroll}
          >
            <Plus className="h-4 w-4" />
            {isCreatingPayroll ? "Đang tạo" : "Tạo payroll tháng"}
          </button>
        )}
      />
      <div className="content-border grid gap-3 p-4 md:grid-cols-4">
        <PayrollMetric label="Tổng gross" value={payrollRun ? formatMoney(payrollRun.totalGrossAmount) : "0đ"} />
        <PayrollMetric label="Khấu trừ" value={payrollRun ? formatMoney(payrollRun.totalDeductions) : "0đ"} />
        <PayrollMetric label="Thưởng/điều chỉnh" value={payrollRun ? formatMoney(payrollRun.totalAdjustments) : "0đ"} />
        <PayrollMetric label="Cần chi" value={payrollRun ? formatMoney(payrollRun.totalFinalAmount) : "0đ"} />
      </div>
      <div className="content-border max-h-[62vh] space-y-3 overflow-auto p-4">
        {payrollRun ? (
          payrollRun.lines.length ? (
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
                      <FinanceInput label="Giờ" type="number" min="0" value={edit?.hoursWorked ?? ""} onChange={(value) => onUpdatePayrollLineEdit(line, { hoursWorked: value })} />
                      <FinanceInput label="Khấu trừ" type="number" value={edit?.deductions ?? ""} onChange={(value) => onUpdatePayrollLineEdit(line, { deductions: value })} />
                      <FinanceInput label="Điều chỉnh" type="number" value={edit?.adjustments ?? ""} onChange={(value) => onUpdatePayrollLineEdit(line, { adjustments: value })} />
                      <FinanceInput label="Ghi chú" value={edit?.note ?? ""} onChange={(value) => onUpdatePayrollLineEdit(line, { note: value })} />
                      <button
                        type="button"
                        className="self-end rounded-2xl border border-brand-red/15 px-3 py-3 text-xs font-semibold text-brand-red disabled:opacity-50"
                        disabled={isSavingLine}
                        onClick={() => onSavePayrollLine(payrollRun, line)}
                      >
                        {isSavingLine ? "Đang lưu" : "Lưu chỉnh"}
                      </button>
                    </div>
                  ) : null}
                </article>
              )
            })
          ) : (
            <PanelState text="Kỳ payroll chưa có dòng lương. Bấm sinh lại dòng để lấy hồ sơ nhân sự và giờ đã duyệt." />
          )
        ) : (
          <PanelState text="Chưa có payroll cho tháng đang chọn." />
        )}
        {payrollRun?.salaryExpenseCode ? (
          <p className="rounded-2xl border border-brand-red/10 bg-white/35 p-4 text-sm text-stone-600">
            Đã tạo phiếu chi lương {payrollRun.salaryExpenseCode} - {formatMoney(payrollRun.salaryExpenseAmount ?? "0")}
          </p>
        ) : null}
      </div>
    </section>
  )
}

function RemindersTab({
  onQueue,
  onSelectTemplate,
  queueingEnrollmentId,
  reminders,
  selectedTemplateId,
  templates
}: {
  onQueue: (reminder: TuitionReminderItem) => void
  onSelectTemplate: (templateId: string) => void
  queueingEnrollmentId: string
  reminders: TuitionReminderItem[]
  selectedTemplateId: string
  templates: ZaloTemplateItem[]
}) {
  return (
    <section className="neu-card rounded-3xl">
      <SectionHeader
        title="Nhắc học phí"
        eyebrow="Automation"
        action={
          <label className="text-sm font-medium text-stone-600">
            Template
            <select
              className="neu-pressed mt-2 block rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none"
              value={selectedTemplateId}
              onChange={(event) => onSelectTemplate(event.target.value)}
            >
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
        }
      />
      <div className="content-border max-h-[68vh] overflow-auto p-4">
        {reminders.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {reminders.map((reminder) => (
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
                  onClick={() => onQueue(reminder)}
                >
                  <BellRing className="h-3.5 w-3.5" />
                  {queueingEnrollmentId === reminder.enrollmentId ? "Đang tạo" : "Tạo task nhắc"}
                </button>
              </article>
            ))}
          </div>
        ) : (
          <PanelState text="Không có học viên cần nhắc học phí theo ngưỡng hiện tại." />
        )}
      </div>
      {templates.length ? (
        <div className="content-border flex items-center gap-2 px-5 py-4 text-xs text-stone-500">
          <MessageSquareText className="h-4 w-4 text-brand-red" />
          {templates.length} template Zalo đã duyệt sẵn trong hệ thống.
        </div>
      ) : null}
    </section>
  )
}

function ReceiptItem({ compact = false, receipt }: { compact?: boolean; receipt: ReceiptListItem }) {
  return (
    <article className="neu-list-item rounded-2xl p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-brand-ink">{receipt.code}</p>
            <span className="rounded-full border border-brand-red/10 px-2 py-1 text-[11px] font-semibold text-stone-500">{paymentMethodLabels[receipt.method]}</span>
          </div>
          <p className="mt-1 text-xs text-stone-500">
            {receipt.studentName} - {receipt.courseName}
          </p>
          {!compact ? (
            <p className="mt-2 text-xs text-stone-500">
              {receipt.sessions} buổi - {formatDate(receipt.createdAt)} - tạo bởi {receipt.createdByName}
            </p>
          ) : null}
        </div>
        <div className="text-left sm:text-right">
          <p className="text-sm font-semibold text-brand-red">{formatMoney(receipt.amount)}</p>
          {!compact ? (
            <a className="mt-2 inline-flex text-xs font-semibold text-stone-500 hover:text-brand-red" href={`/receipts/${receipt.id}/print`} target="_blank">
              In phiếu
            </a>
          ) : null}
        </div>
      </div>
    </article>
  )
}

function ExpenseItem({ compact = false, expense }: { compact?: boolean; expense: ExpenseListItem }) {
  return (
    <article className="neu-list-item rounded-2xl p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-brand-ink">{expense.code}</p>
            <span className="rounded-full border border-brand-red/10 px-2 py-1 text-[11px] font-semibold text-stone-500">{expenseCategoryLabels[expense.category]}</span>
            {expense.refundEntitlementId ? (
              <span className="rounded-full border border-brand-red/10 px-2 py-1 text-[11px] font-semibold text-brand-red">
                Refund{expense.refundStudentName ? ` - ${expense.refundStudentName}` : ""}
              </span>
            ) : null}
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-stone-500">{expense.description}</p>
          {!compact ? <p className="mt-2 text-xs text-stone-500">{formatDate(expense.date)} - tạo bởi {expense.createdByName}</p> : null}
        </div>
        <p className="text-sm font-semibold text-brand-red">{formatMoney(expense.amount)}</p>
      </div>
    </article>
  )
}

function SummaryBreakdown({
  emptyText,
  rows,
  title
}: {
  emptyText: string
  rows: Array<{ key: string; label: string; amount: string; count: number }>
  title: string
}) {
  return (
    <div className="neu-card rounded-3xl">
      <h2 className="p-5 font-semibold text-brand-ink">{title}</h2>
      <div className="content-border space-y-2 p-4">
        {rows.length ? rows.map((row) => (
          <div key={row.key} className="neu-list-item flex items-center justify-between gap-3 rounded-2xl p-3">
            <div>
              <p className="text-sm font-semibold text-brand-ink">{row.label}</p>
              <p className="mt-1 text-xs text-stone-500">{row.count} giao dịch</p>
            </div>
            <p className="text-sm font-semibold text-brand-red">{formatMoney(row.amount)}</p>
          </div>
        )) : <PanelState text={emptyText} />}
      </div>
    </div>
  )
}

function SectionHeader({
  action,
  eyebrow,
  title
}: {
  action?: React.ReactNode
  eyebrow: string
  title: string
}) {
  return (
    <div className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-red">{eyebrow}</p>
        <h2 className="mt-2 text-lg font-semibold text-brand-ink">{title}</h2>
      </div>
      {action}
    </div>
  )
}

function PermissionState() {
  return (
    <section className="neu-card rounded-3xl p-6">
      <div className="flex items-center gap-3">
        <div className="neu-pressed flex h-12 w-12 items-center justify-center rounded-2xl">
          <Lock className="h-5 w-5 text-brand-red" />
        </div>
        <div>
          <p className="font-semibold text-brand-ink">Không có quyền xem tài chính</p>
          <p className="mt-1 text-sm text-stone-500">Tài khoản này chưa được cấp quyền phù hợp cho workspace tài chính.</p>
        </div>
      </div>
    </section>
  )
}

function PanelState({ text }: { text: string }) {
  return <p className="rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500">{text}</p>
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
