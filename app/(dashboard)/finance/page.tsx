"use client"

import { BarChart3, BellRing, Download, FileText, Plus, ReceiptText, RefreshCcw, TrendingDown, TrendingUp, WalletCards } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { PermissionState } from "./finance-presentational"
import { useFinanceData } from "./finance-data"
import { useFinanceActions } from "./finance-actions"
import { useFinancePayrollActions } from "./finance-payroll-actions"
import { ExpenseDialog, OtherIncomeReceiptDialog, StudentReceiptPickerDialog } from "./finance-dialogs"
import { ExpensesTab, OverviewTab, PayrollTab, ReceiptsTab, RemindersTab } from "./finance-tabs"
import {
  buildYearOptions,
  emptyExpenseForm,
  emptyOtherIncomeReceiptForm,
  financeMonthChoices,
  formatMoney,
  getCurrentMonth,
  getMonthPart,
  getReceiptTotal,
  getYearPart,
  type ExpenseFormState,
  type FinanceDialog,
  type FinanceTab,
  type OtherIncomeReceiptFormState,
  type PayrollLineEditState,
} from "./finance-utils"

export default function FinancePage() {
  const router = useRouter()
  const [month, setMonth] = useState(getCurrentMonth)
  const [activeTab, setActiveTab] = useState<FinanceTab>("overview")
  const [activeDialog, setActiveDialog] = useState<FinanceDialog>(null)
  const [expenseForm, setExpenseForm] = useState<ExpenseFormState>(emptyExpenseForm)
  const [otherIncomeReceiptForm, setOtherIncomeReceiptForm] = useState<OtherIncomeReceiptFormState>(emptyOtherIncomeReceiptForm)
  const [selectedTemplateId, setSelectedTemplateId] = useState("TUITION_LOW_SESSIONS")
  const [refreshKey, setRefreshKey] = useState(0)
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false)
  const [isSubmittingOtherIncomeReceipt, setIsSubmittingOtherIncomeReceipt] = useState(false)
  const [isCreatingPayroll, setIsCreatingPayroll] = useState(false)
  const [payrollActionId, setPayrollActionId] = useState("")
  const [payrollLineEdits, setPayrollLineEdits] = useState<Record<string, PayrollLineEditState>>({})
  const [queueingEnrollmentId, setQueueingEnrollmentId] = useState("")
  const financeData = useFinanceData({ month, refreshKey, selectedTemplateId })
  const {
    canCreateReceipt, canManageReminders, canUseFinance, error, expenses, isAdmin,
    isLoading, isLoadingSession, otherIncomeReceipts, payrollRuns, receipts, reminders, setError,
    students, summary, templates
  } = financeData
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

  const selectedTab = availableTabs.some((tab) => tab.id === activeTab) ? activeTab : availableTabs[0]?.id

  const adminSummaryCards = useMemo(
    () => [
      { label: "Thực thu", value: summary ? formatMoney(summary.revenue) : "0đ", icon: TrendingUp },
      { label: "Thu khác", value: summary ? formatMoney(summary.otherIncomeRevenue) : "0đ", icon: ReceiptText },
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
      { label: "Doanh thu của bạn", value: formatMoney(String(getReceiptTotal(receipts) + otherIncomeReceipts.reduce((total, receipt) => total + Number(receipt.amount), 0))), icon: TrendingUp },
      { label: "Phiếu thu", value: `${receipts.length + otherIncomeReceipts.length} phiếu`, icon: ReceiptText },
      { label: "Số buổi đã bán", value: `${receipts.reduce((total, receipt) => total + receipt.sessions, 0)} buổi`, icon: WalletCards }
    ],
    [otherIncomeReceipts, receipts]
  )
  const payrollRun = payrollRuns[0]

  const { queueReminder, submitExpense, submitOtherIncomeReceipt } = useFinanceActions({
    expenseForm,
    otherIncomeReceiptForm,
    month,
    selectedTemplateId,
    setActiveDialog,
    setError,
    setExpenseForm,
    setOtherIncomeReceiptForm,
    setIsSubmittingExpense,
    setIsSubmittingOtherIncomeReceipt,
    setQueueingEnrollmentId,
    setRefreshKey
  })

  const { createPayrollRun, runPayrollAction, savePayrollLine, updatePayrollLineEdit } = useFinancePayrollActions({
    month,
    payrollLineEdits,
    setError,
    setIsCreatingPayroll,
    setPayrollActionId,
    setPayrollLineEdits,
    setRefreshKey
  })

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
                <>
                  <button type="button" className="neu-list-item inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-stone-600 hover:text-brand-red" onClick={() => setActiveDialog("student-receipt")}>
                    <Plus className="h-4 w-4" />
                    Thu học phí
                  </button>
                  <button type="button" className="glass-button-primary inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold" onClick={() => setActiveDialog("other-income-receipt")}>
                    <Plus className="h-4 w-4" />
                    Phiếu thu khác
                  </button>
                </>
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
          otherIncomeReceipts={otherIncomeReceipts}
          expenses={expenses}
          summary={summary}
        />
      ) : null}

      {canUseFinance && selectedTab === "receipts" ? (
        <ReceiptsTab
          canCreateReceipt={canCreateReceipt}
          isLoading={isPageLoading}
          receipts={receipts}
          otherIncomeReceipts={otherIncomeReceipts}
          onCreateStudentTuition={() => setActiveDialog("student-receipt")}
          onCreateOtherIncome={() => setActiveDialog("other-income-receipt")}
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

      {activeDialog === "student-receipt" ? <StudentReceiptPickerDialog students={students} onClose={() => setActiveDialog(null)} onSelectStudent={(studentId) => router.push(`/students/${studentId}?tab=finance`)} /> : null}

      {activeDialog === "other-income-receipt" ? <OtherIncomeReceiptDialog form={otherIncomeReceiptForm} isSubmitting={isSubmittingOtherIncomeReceipt} onClose={() => setActiveDialog(null)} onSubmit={submitOtherIncomeReceipt} setForm={setOtherIncomeReceiptForm} /> : null}

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
