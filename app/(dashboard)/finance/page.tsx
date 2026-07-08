"use client"

import { BarChart3, BellRing, Download, FileText, Plus, ReceiptText, RefreshCcw, TrendingDown, TrendingUp, WalletCards } from "lucide-react"
import { useEffect, useMemo, useState, type FormEvent } from "react"
import type { ApiResponse } from "@/lib/api-response"
import type { ExpenseListItem, FinanceSummary, ReceiptListItem } from "@/lib/contracts/finance"
import type { PayrollLineItem, PayrollRunItem } from "@/lib/contracts/payroll"
import type { QueuedTuitionReminder, TuitionReminderItem, ZaloTemplateItem } from "@/lib/contracts/reminders"
import type { StudentListItem } from "@/lib/contracts/students"
import type { ClassListItem } from "@/lib/contracts/courses"
import { PermissionState } from "./finance-presentational"
import { ExpenseDialog, ReceiptDialog } from "./finance-dialogs"
import { ExpensesTab, OverviewTab, PayrollTab, ReceiptsTab, RemindersTab } from "./finance-tabs"
import {
  buildYearOptions,
  countCourseSessionsInBillingMonth,
  emptyExpenseForm,
  emptyReceiptForm,
  financeMonthChoices,
  formatMoney,
  getBillingMonthChoicesForYear,
  getBillingMonthInRange,
  getBillingPeriodForMonth,
  getBillingYearOptions,
  getCourseBillingMonthOptions,
  getCurrentMonth,
  getMonthPart,
  getReceiptTotal,
  getYearPart,
  type ExpenseFormState,
  type FinanceDialog,
  type FinanceRole,
  type FinanceTab,
  type PayrollLineEditState,
  type ReceiptBillingMode,
  type ReceiptFormState,
  type SessionPayload
} from "./finance-utils"

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
	  const [classes, setClasses] = useState<ClassListItem[]>([])
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
  const selectedMonthPart = getMonthPart(month)
  const selectedYearPart = getYearPart(month)
  const yearOptions = useMemo(() => buildYearOptions(selectedYearPart), [selectedYearPart])

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
	        const remindersRequest = canManageReminders ? fetch(`/api/tuition-reminders?templateId=${selectedTemplateId}&billingMonth=${month}`, { cache: "no-store" }) : null

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
	    const [studentsResponse, classesResponse] = await Promise.all([
	      fetch("/api/students?limit=100", { cache: "no-store" }),
	      fetch("/api/classes?active=true&summary=true", { cache: "no-store" })
	    ])
	    const studentsPayload = (await studentsResponse.json()) as ApiResponse<StudentListItem[]>
	    const classesPayload = (await classesResponse.json()) as ApiResponse<ClassListItem[]>

	    if (isMounted && studentsResponse.ok && studentsPayload.success && studentsPayload.data) {
	      setStudents(studentsPayload.data)
	    }

	    if (isMounted && classesResponse.ok && classesPayload.success && classesPayload.data) {
	      setClasses(classesPayload.data)
	    }
	  } catch {
	    if (isMounted) {
	      setStudents([])
	      setClasses([])
	    }
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
	          course,
	          courseName: course.courseName,
	          sessionsRemaining: course.sessionsRemaining
	        }))
	      ),
	    [students]
	  )
	  const selectedReceiptEnrollment = useMemo(
	    () => enrollmentOptions.find((option) => option.enrollmentId === receiptForm.enrollmentId),
	    [enrollmentOptions, receiptForm.enrollmentId]
	  )
	  const isReceiptMonthlyBilling = receiptForm.billingMode === "MONTHLY"
	  const receiptBillingMonthOptions = useMemo(
	    () => getCourseBillingMonthOptions(selectedReceiptEnrollment?.course, classes),
	    [classes, selectedReceiptEnrollment?.course]
	  )
	  const activeReceiptBillingMonth = useMemo(
	    () => getBillingMonthInRange(receiptForm.billingMonth, receiptBillingMonthOptions),
	    [receiptForm.billingMonth, receiptBillingMonthOptions]
	  )
	  const activeReceiptBillingYear = useMemo(() => getYearPart(activeReceiptBillingMonth), [activeReceiptBillingMonth])
	  const receiptBillingYearOptions = useMemo(
	    () => getBillingYearOptions(receiptBillingMonthOptions, activeReceiptBillingMonth),
	    [activeReceiptBillingMonth, receiptBillingMonthOptions]
	  )
	  const receiptBillingMonthChoices = useMemo(
	    () => getBillingMonthChoicesForYear(receiptBillingMonthOptions, activeReceiptBillingYear),
	    [activeReceiptBillingYear, receiptBillingMonthOptions]
	  )
	  const suggestedReceiptSessions = useMemo(
	    () => isReceiptMonthlyBilling ? countCourseSessionsInBillingMonth(selectedReceiptEnrollment?.course, classes, activeReceiptBillingMonth) : undefined,
	    [activeReceiptBillingMonth, classes, isReceiptMonthlyBilling, selectedReceiptEnrollment?.course]
	  )
	  const selectedReceiptUnitPrice = selectedReceiptEnrollment?.course.courseTotalSessions
	    ? Number(selectedReceiptEnrollment.course.coursePrice) / selectedReceiptEnrollment.course.courseTotalSessions
	    : 0
	  const defaultReceiptSessions = selectedReceiptEnrollment ? selectedReceiptEnrollment.sessionsRemaining : 0
	  const receiptBillableSessions = Number(receiptForm.billableSessions || suggestedReceiptSessions || defaultReceiptSessions || 0)
	  const receiptExpectedAmount = selectedReceiptUnitPrice * receiptBillableSessions
	  const payrollRun = payrollRuns[0]

	  function suggestReceiptSessions(enrollmentId: string, billingMonth: string, billingMode: ReceiptBillingMode) {
	    const option = enrollmentOptions.find((item) => item.enrollmentId === enrollmentId)
	    if (billingMode === "COURSE") return option ? String(option.sessionsRemaining) : ""
	    const suggested = countCourseSessionsInBillingMonth(option?.course, classes, billingMonth)
	    return suggested === undefined ? "" : String(Math.max(0, suggested))
	  }

  async function submitReceipt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmittingReceipt(true)
    setError(null)

    try {
      if (isReceiptMonthlyBilling && !receiptBillingMonthOptions.length) {
        setError("Khóa học này chưa có khoảng tháng hợp lệ để thu theo tháng.")
        return
      }

      const billingPeriod = isReceiptMonthlyBilling ? getBillingPeriodForMonth(activeReceiptBillingMonth) : null
      const response = await fetch("/api/receipts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
	          enrollmentId: receiptForm.enrollmentId,
	          lines: [{
	            enrollmentId: receiptForm.enrollmentId,
	            billableSessions: receiptBillableSessions,
	            billingPeriodStart: billingPeriod?.startIso,
	            billingPeriodEnd: billingPeriod?.endIso,
	            billingLabel: billingPeriod?.label
	          }],
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
	          billingMonth: reminder.billingMonth ?? month,
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
            <div className="grid w-full grid-cols-2 gap-2 sm:w-[280px]">
              <label className="text-sm font-medium text-stone-600">
                Tháng
                <select
                  className="neu-pressed mt-2 block w-full rounded-2xl bg-transparent px-3 py-3 text-brand-ink outline-none"
                  value={selectedMonthPart}
                  onChange={(event) => setMonth(`${selectedYearPart}-${event.target.value}`)}
                >
                  {financeMonthChoices.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-stone-600">
                Năm
                <select
                  className="neu-pressed mt-2 block w-full rounded-2xl bg-transparent px-3 py-3 text-brand-ink outline-none"
                  value={selectedYearPart}
                  onChange={(event) => setMonth(`${event.target.value}-${selectedMonthPart}`)}
                >
                  {yearOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>
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
        <ReceiptDialog
          activeReceiptBillingMonth={activeReceiptBillingMonth}
          activeReceiptBillingYear={activeReceiptBillingYear}
          classes={classes}
          defaultReceiptSessions={defaultReceiptSessions}
          enrollmentOptions={enrollmentOptions}
          isMonthlyBilling={isReceiptMonthlyBilling}
          isSubmitting={isSubmittingReceipt}
          receiptBillingMonthChoices={receiptBillingMonthChoices}
          receiptBillingMonthOptions={receiptBillingMonthOptions}
          receiptBillingYearOptions={receiptBillingYearOptions}
          receiptExpectedAmount={receiptExpectedAmount}
          receiptForm={receiptForm}
          setReceiptForm={setReceiptForm}
          suggestedReceiptSessions={suggestedReceiptSessions}
          suggestReceiptSessions={suggestReceiptSessions}
          onClose={() => setActiveDialog(null)}
          onSubmit={submitReceipt}
        />
      ) : null}

      {activeDialog === "expense" && isAdmin ? (
        <ExpenseDialog
          expenseForm={expenseForm}
          isSubmitting={isSubmittingExpense}
          onClose={() => setActiveDialog(null)}
          onSubmit={submitExpense}
          setExpenseForm={setExpenseForm}
        />
      ) : null}
    </main>
  )
}
