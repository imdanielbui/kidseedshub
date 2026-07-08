import { BellRing, CheckCircle2, MessageSquareText, Plus, RefreshCcw, WalletCards, type LucideIcon } from "lucide-react"
import { expenseCategoryLabels, paymentMethodLabels, type ExpenseListItem, type FinanceSummary, type ReceiptListItem } from "@/lib/contracts/finance"
import { payrollRunStatusLabels, type PayrollLineItem, type PayrollRunItem } from "@/lib/contracts/payroll"
import type { TuitionReminderItem, ZaloTemplateItem } from "@/lib/contracts/reminders"
import { ExpenseItem, FinanceInput, PanelState, PayrollMetric, ReceiptItem, SectionHeader, SummaryBreakdown } from "./finance-presentational"
import { formatMoney, type PayrollLineEditState } from "./finance-utils"

export function OverviewTab({
  cards,
  expenses,
  isAdmin,
  isLoading,
  receipts,
  summary
}: {
  cards: Array<{ label: string; value: string; icon: LucideIcon }>
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

export function ReceiptsTab({
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

export function ExpensesTab({
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

export function PayrollTab({
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

export function RemindersTab({
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
                    {reminder.billingMonth ? `Cần thu ${reminder.billableSessionsDue ?? 0}` : `Còn ${reminder.sessionsRemaining}`}
                  </span>
                </div>
                {reminder.billingLabel ? (
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-stone-500">
                    <span className="rounded-full border border-brand-red/10 px-2 py-1">{reminder.billingLabel}</span>
                    <span className="rounded-full border border-brand-red/10 px-2 py-1">Đã thu {reminder.billedSessionsInMonth ?? 0} buổi</span>
                    <span className="rounded-full border border-brand-red/10 px-2 py-1">Dự kiến {formatMoney(reminder.expectedAmount ?? "0")}</span>
                  </div>
                ) : null}
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
