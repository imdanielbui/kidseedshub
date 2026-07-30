import type { Dispatch, FormEvent, SetStateAction } from "react"
import type { ApiResponse } from "@/lib/api-response"
import type { ExpenseListItem, OtherIncomeReceiptItem } from "@/lib/contracts/finance"
import type { QueuedTuitionReminder, TuitionReminderItem } from "@/lib/contracts/reminders"
import {
  emptyExpenseForm,
  emptyOtherIncomeReceiptForm,
  parseMoneyInput,
  type ExpenseFormState,
  type FinanceDialog,
  type OtherIncomeReceiptFormState
} from "./finance-utils"

type SetState<T> = Dispatch<SetStateAction<T>>

export function useFinanceActions({
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
}: {
  expenseForm: ExpenseFormState
  otherIncomeReceiptForm: OtherIncomeReceiptFormState
  month: string
  selectedTemplateId: string
  setActiveDialog: SetState<FinanceDialog>
  setError: SetState<string | null>
  setExpenseForm: SetState<ExpenseFormState>
  setOtherIncomeReceiptForm: SetState<OtherIncomeReceiptFormState>
  setIsSubmittingExpense: SetState<boolean>
  setIsSubmittingOtherIncomeReceipt: SetState<boolean>
  setQueueingEnrollmentId: SetState<string>
  setRefreshKey: SetState<number>
}) {
  const refresh = () => setRefreshKey((current) => current + 1)

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

  async function submitOtherIncomeReceipt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmittingOtherIncomeReceipt(true)
    setError(null)

    try {
      const response = await fetch("/api/other-income-receipts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          category: otherIncomeReceiptForm.category,
          amount: parseMoneyInput(otherIncomeReceiptForm.amount),
          payerName: otherIncomeReceiptForm.payerName.trim(),
          payerPhone: otherIncomeReceiptForm.payerPhone.trim() || undefined,
          description: otherIncomeReceiptForm.description.trim(),
          note: otherIncomeReceiptForm.note.trim() || undefined,
          method: otherIncomeReceiptForm.method
        })
      })
      const payload = (await response.json()) as ApiResponse<OtherIncomeReceiptItem>

      if (!response.ok || !payload.success) {
        setError(payload.error?.message ?? "Không tạo được phiếu thu khác.")
        return
      }

      setOtherIncomeReceiptForm(emptyOtherIncomeReceiptForm)
      setActiveDialog(null)
      refresh()
    } catch {
      setError("Không tạo được phiếu thu khác.")
    } finally {
      setIsSubmittingOtherIncomeReceipt(false)
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

  return { queueReminder, submitExpense, submitOtherIncomeReceipt }
}
