import { Lock } from "lucide-react"
import type { ReactNode } from "react"
import { expenseCategoryLabels, otherIncomeCategoryLabels, paymentMethodLabels, type ExpenseListItem, type OtherIncomeReceiptItem, type ReceiptListItem } from "@/lib/contracts/finance"
import { formatDate, formatMoney } from "./finance-utils"

export function ReceiptItem({ compact = false, receipt }: { compact?: boolean; receipt: ReceiptListItem }) {
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
              {receipt.sessions} buổi{receipt.lines[0]?.billingLabel ? ` - ${receipt.lines[0].billingLabel}` : ""} - {formatDate(receipt.createdAt)} - tạo bởi {receipt.createdByName}
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

export function ExpenseItem({ compact = false, expense }: { compact?: boolean; expense: ExpenseListItem }) {
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

export function OtherIncomeReceiptItem({ compact = false, receipt }: { compact?: boolean; receipt: OtherIncomeReceiptItem }) {
  return (
    <article className="neu-list-item rounded-2xl p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-brand-ink">{receipt.code}</p>
            <span className="rounded-full border border-brand-red/10 px-2 py-1 text-[11px] font-semibold text-stone-500">{otherIncomeCategoryLabels[receipt.category]}</span>
          </div>
          <p className="mt-1 text-xs text-stone-500">{receipt.payerName} - {receipt.description}</p>
          {!compact ? <p className="mt-2 text-xs text-stone-500">{formatDate(receipt.createdAt)} - tạo bởi {receipt.createdByName}</p> : null}
        </div>
        <div className="text-left sm:text-right">
          <p className="text-sm font-semibold text-brand-red">{formatMoney(receipt.amount)}</p>
          {!compact ? <a className="mt-2 inline-flex text-xs font-semibold text-stone-500 hover:text-brand-red" href={`/other-income-receipts/${receipt.id}/print`} target="_blank">In phiếu</a> : null}
        </div>
      </div>
    </article>
  )
}

export function SummaryBreakdown({
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

export function SectionHeader({
  action,
  eyebrow,
  title
}: {
  action?: ReactNode
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

export function PermissionState() {
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

export function PanelState({ text }: { text: string }) {
  return <p className="rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500">{text}</p>
}

export function FinanceInput({
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

export function PayrollMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="neu-pressed rounded-2xl p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-brand-ink">{value}</p>
    </div>
  )
}
