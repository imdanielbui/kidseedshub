import type { Dispatch, FormEvent, SetStateAction } from "react"
import type { ApiResponse } from "@/lib/api-response"
import type { PaymentMethodKey, ReceiptListItem } from "@/lib/contracts/finance"
import type { StudentDetail } from "@/lib/contracts/students"
import { formatMoneyInput } from "./student-detail-money"
import { type ReceiptDraftLine, type ReceiptExtraDraftLine, getBillingPeriodForMonth, toReceiptDraftLine } from "./student-detail-utils"
import type { useStudentReceiptState } from "./student-detail-receipt-state"

type ReceiptState = ReturnType<typeof useStudentReceiptState>

export function useStudentReceiptActions({
  activeReceiptBillingMonth,
  actualReceiptAmount,
  hasManualReceiptAmount,
  isReceiptMonthlyBilling,
  loadFinanceLedger,
  loadReceipts,
  loadStudent,
  payableAmount,
  pendingBillableEnrollmentId,
  receiptExtraLineSummaries,
  receiptLineSummaries,
  receiptMethod,
  receiptNote,
  receiptValidationErrors,
  setError,
  setIsConfirmingPayment,
  setIsConfirmingReceiptAmount,
  setIsReceiptAmountOverride,
  setIsSubmittingReceipt,
  setIsWalletCreditManual,
  setLastReceipt,
  setPendingBillableEnrollmentId,
  setReceiptAmount,
  setReceiptBillingMode,
  setReceiptExtraLines,
  setReceiptLines,
  setReceiptNote,
  setWalletCreditInput,
  studentId,
  walletCreditAmount
}: {
  activeReceiptBillingMonth: string
  actualReceiptAmount: number
  hasManualReceiptAmount: boolean
  isReceiptMonthlyBilling: boolean
  loadFinanceLedger: () => Promise<void>
  loadReceipts: () => Promise<void>
  loadStudent: () => Promise<void>
  payableAmount: number
  pendingBillableEnrollmentId: string | null
  receiptExtraLineSummaries: ReceiptState["receiptExtraLineSummaries"]
  receiptLineSummaries: ReceiptState["receiptLineSummaries"]
  receiptMethod: PaymentMethodKey
  receiptNote: string
  receiptValidationErrors: string[]
  setError: Dispatch<SetStateAction<string | null>>
  setIsConfirmingPayment: Dispatch<SetStateAction<boolean>>
  setIsConfirmingReceiptAmount: Dispatch<SetStateAction<boolean>>
  setIsReceiptAmountOverride: Dispatch<SetStateAction<boolean>>
  setIsSubmittingReceipt: Dispatch<SetStateAction<boolean>>
  setIsWalletCreditManual: Dispatch<SetStateAction<boolean>>
  setLastReceipt: Dispatch<SetStateAction<ReceiptListItem | null>>
  setPendingBillableEnrollmentId: Dispatch<SetStateAction<string | null>>
  setReceiptAmount: Dispatch<SetStateAction<string>>
  setReceiptBillingMode: Dispatch<SetStateAction<"COURSE" | "MONTHLY">>
  setReceiptExtraLines: Dispatch<SetStateAction<ReceiptExtraDraftLine[]>>
  setReceiptLines: Dispatch<SetStateAction<ReceiptDraftLine[]>>
  setReceiptNote: Dispatch<SetStateAction<string>>
  setWalletCreditInput: Dispatch<SetStateAction<string>>
  studentId: string
  walletCreditAmount: number
}) {
  function resetReceiptOverrides() {
    setReceiptAmount("")
    setIsReceiptAmountOverride(false)
    setIsWalletCreditManual(false)
  }

  async function submitReceipt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (receiptValidationErrors.length) {
      setError(receiptValidationErrors[0])
      return
    }

    setError(null)
    setIsConfirmingPayment(true)
  }

  async function confirmReceiptPayment() {
    setIsSubmittingReceipt(true)
    setError(null)
    const billingPeriod = isReceiptMonthlyBilling ? getBillingPeriodForMonth(activeReceiptBillingMonth) : null

    try {
      const response = await fetch("/api/receipts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          studentId,
          amount: hasManualReceiptAmount ? actualReceiptAmount : undefined,
          lines: receiptLineSummaries.map((summary) => ({
            enrollmentId: summary.line.enrollmentId,
            billableSessions: summary.billableSessions,
            freeTrialSessions: summary.freeTrialSessions,
            paidSessionsBeforeReceipt: summary.paidSessionsBeforeReceipt,
            discountInput: summary.line.discountInput.trim() || undefined,
            extraDiscountInput: summary.line.extraDiscountInput.trim() || undefined,
            billingPeriodStart: billingPeriod?.startIso,
            billingPeriodEnd: billingPeriod?.endIso,
            billingLabel: billingPeriod?.label
          })),
          extraLines: receiptExtraLineSummaries.map((summary) => ({
            type: summary.line.type,
            description: summary.line.description.trim(),
            quantity: summary.quantity,
            unitPrice: summary.unitPrice,
            note: summary.line.note.trim() || undefined
          })),
          walletCreditAmount: walletCreditAmount > 0 ? walletCreditAmount : undefined,
          method: receiptMethod,
          note: receiptNote.trim() || undefined
        })
      })
      const payload = (await response.json()) as ApiResponse<ReceiptListItem>

      if (!response.ok || !payload.success || !payload.data) {
        setError(payload.error?.message ?? "Không tạo được phiếu thu.")
        return
      }

      setReceiptAmount("")
      setWalletCreditInput("")
      setIsWalletCreditManual(false)
      setIsReceiptAmountOverride(false)
      setReceiptBillingMode("COURSE")
      setReceiptNote("")
      setReceiptExtraLines([])
      setIsConfirmingPayment(false)
      setLastReceipt(payload.data)
      await loadStudent()
      await loadReceipts()
      await loadFinanceLedger()
    } catch {
      setError("Không tạo được phiếu thu.")
    } finally {
      setIsSubmittingReceipt(false)
    }
  }

  function toggleReceiptLine(course: StudentDetail["courses"][number]) {
    setReceiptLines((current) => current.some((line) => line.enrollmentId === course.enrollmentId)
      ? current.filter((line) => line.enrollmentId !== course.enrollmentId)
      : [...current, toReceiptDraftLine(course)])
    resetReceiptOverrides()
  }

  function updateReceiptLine(enrollmentId: string, patch: Partial<ReceiptDraftLine>) {
    setReceiptLines((current) => current.map((line) => line.enrollmentId === enrollmentId ? { ...line, ...patch } : line))
    resetReceiptOverrides()
  }

  function addReceiptExtraLine() {
    setReceiptExtraLines((current) => [...current, {
      id: `extra-${Date.now()}`,
      type: "TUTORING",
      description: "Phụ đạo theo giờ",
      quantity: "1",
      unitPrice: "",
      note: ""
    }])
    resetReceiptOverrides()
  }

  function updateReceiptExtraLine(id: string, patch: Partial<ReceiptExtraDraftLine>) {
    setReceiptExtraLines((current) => current.map((line) => line.id === id ? { ...line, ...patch } : line))
    resetReceiptOverrides()
  }

  function removeReceiptExtraLine(id: string) {
    setReceiptExtraLines((current) => current.filter((line) => line.id !== id))
    resetReceiptOverrides()
  }

  function confirmBillableOverride() {
    if (!pendingBillableEnrollmentId) return

    const summary = receiptLineSummaries.find((line) => line.line.enrollmentId === pendingBillableEnrollmentId)
    updateReceiptLine(pendingBillableEnrollmentId, {
      isBillableOverride: true,
      billableSessions: String(summary?.billableSessions ?? 0)
    })
    setPendingBillableEnrollmentId(null)
  }

  function confirmReceiptAmountOverride() {
    setReceiptAmount(formatMoneyInput(Math.round(payableAmount)))
    setIsReceiptAmountOverride(true)
    setIsConfirmingReceiptAmount(false)
  }

  return {
    addReceiptExtraLine,
    confirmBillableOverride,
    confirmReceiptAmountOverride,
    confirmReceiptPayment,
    removeReceiptExtraLine,
    submitReceipt,
    toggleReceiptLine,
    updateReceiptExtraLine,
    updateReceiptLine
  }
}
