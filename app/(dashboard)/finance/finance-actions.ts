import type { Dispatch, FormEvent, SetStateAction } from "react"
import type { ApiResponse } from "@/lib/api-response"
import type { ExpenseListItem, ReceiptListItem } from "@/lib/contracts/finance"
import type { QueuedTuitionReminder, TuitionReminderItem } from "@/lib/contracts/reminders"
import {
  emptyExpenseForm,
  emptyReceiptForm,
  getBillingPeriodForMonth,
  type ExpenseFormState,
  type FinanceDialog,
  type ReceiptFormState
} from "./finance-utils"

type SetState<T> = Dispatch<SetStateAction<T>>

export function useFinanceActions({
  activeReceiptBillingMonth,
  expenseForm,
  isReceiptMonthlyBilling,
  month,
  receiptBillableSessions,
  receiptBillingMonthOptions,
  receiptForm,
  selectedTemplateId,
  setActiveDialog,
  setError,
  setExpenseForm,
  setIsSubmittingExpense,
  setIsSubmittingReceipt,
  setQueueingEnrollmentId,
  setReceiptForm,
  setRefreshKey
}: {
  activeReceiptBillingMonth: string
  expenseForm: ExpenseFormState
  isReceiptMonthlyBilling: boolean
  month: string
  receiptBillableSessions: number
  receiptBillingMonthOptions: unknown[]
  receiptForm: ReceiptFormState
  selectedTemplateId: string
  setActiveDialog: SetState<FinanceDialog>
  setError: SetState<string | null>
  setExpenseForm: SetState<ExpenseFormState>
  setIsSubmittingExpense: SetState<boolean>
  setIsSubmittingReceipt: SetState<boolean>
  setQueueingEnrollmentId: SetState<string>
  setReceiptForm: SetState<ReceiptFormState>
  setRefreshKey: SetState<number>
}) {
  const refresh = () => setRefreshKey((current) => current + 1)

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
      refresh()
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
      refresh()
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

      refresh()
    } catch {
      setError("Không tạo được task nhắc học phí.")
    } finally {
      setQueueingEnrollmentId("")
    }
  }

  return { queueReminder, submitExpense, submitReceipt }
}
