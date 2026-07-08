import { Plus, type LucideIcon } from "lucide-react"
import { expenseCategoryLabels, paymentMethodLabels, type ExpenseListItem, type FinanceSummary, type ReceiptListItem } from "@/lib/contracts/finance"
import { ExpenseItem, PanelState, ReceiptItem, SectionHeader, SummaryBreakdown } from "./finance-presentational"

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
