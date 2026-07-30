import type { ExpenseCategoryKey, OtherIncomeCategoryKey, PaymentMethodKey, ReceiptListItem } from "@/lib/contracts/finance"

export type FinanceRole = "ADMIN" | "SALE" | "TEACHER" | "PARENT"
export type FinanceTab = "overview" | "receipts" | "expenses" | "payroll" | "reminders"
export type FinanceDialog = "student-receipt" | "other-income-receipt" | "expense" | null

export type SessionPayload = {
  user?: {
    role?: FinanceRole
  }
} | null

export type ExpenseFormState = {
  category: ExpenseCategoryKey
  amount: string
  description: string
  invoiceUrl: string
  date: string
}

export type OtherIncomeReceiptFormState = {
  category: OtherIncomeCategoryKey
  amount: string
  payerName: string
  payerPhone: string
  description: string
  note: string
  method: PaymentMethodKey
}

export type PayrollLineEditState = {
  hoursWorked: string
  deductions: string
  adjustments: string
  note: string
}

export function getCurrentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

export const financeMonthChoices = Array.from({ length: 12 }, (_, index) => {
  const value = String(index + 1).padStart(2, "0")
  return { value, label: `Tháng ${value}` }
})

const financeYearStart = 2020
const financeYearLookahead = 20

export const emptyExpenseForm: ExpenseFormState = {
  category: "MATERIALS",
  amount: "",
  description: "",
  invoiceUrl: "",
  date: new Date().toISOString().slice(0, 10)
}

export const emptyOtherIncomeReceiptForm: OtherIncomeReceiptFormState = {
  category: "WORKSHOP_EVENT",
  amount: "",
  payerName: "",
  payerPhone: "",
  description: "",
  note: "",
  method: "BANK_TRANSFER"
}

export function getMonthPart(value: string) {
  const monthPart = value.split("-")[1] ?? "01"
  return financeMonthChoices.some((choice) => choice.value === monthPart) ? monthPart : "01"
}

export function getYearPart(value: string) {
  const yearPart = value.split("-")[0] ?? ""
  return /^\d{4}$/.test(yearPart) ? yearPart : String(new Date().getFullYear())
}

export function buildYearOptions(selectedYear: string) {
  const currentYear = new Date().getFullYear()
  const selectedYearNumber = Number(selectedYear)
  const firstYear = Math.min(financeYearStart, selectedYearNumber)
  const lastYear = Math.max(currentYear + financeYearLookahead, selectedYearNumber)
  return Array.from({ length: lastYear - firstYear + 1 }, (_, index) => String(lastYear - index))
}

export function formatMoney(value: string) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(value))
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value))
}

export function getReceiptTotal(receipts: ReceiptListItem[]) {
  return receipts.reduce((total, receipt) => total + Number(receipt.amount), 0)
}
