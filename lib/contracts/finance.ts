export const paymentMethodLabels = {
  CASH: "Tiền mặt",
  BANK_TRANSFER: "Chuyển khoản"
} as const

export const expenseCategoryLabels = {
  SALARY: "Lương",
  MATERIALS: "Vật tư / Kit",
  UTILITIES: "Điện nước",
  MARKETING: "Marketing",
  OTHER: "Khác"
} as const

export type PaymentMethodKey = keyof typeof paymentMethodLabels
export type ExpenseCategoryKey = keyof typeof expenseCategoryLabels

export type ReceiptLineItem = {
  id: string
  enrollmentId: string
  courseName: string
  coursePrice: string
  courseTotalSessions: number
  unitPrice: string
  grossAmount: string
  discountAmount: string
  discountPercent: string
  amount: string
  billableSessions: number
  freeTrialSessions: number
  paidSessionsBeforeReceipt: number
  remainingSessionsAfterReceipt: number
}

export type ReceiptListItem = {
  id: string
  code: string
  enrollmentId: string
  studentCode: string
  studentName: string
  parentName: string
  parentPhone: string
  courseName: string
  coursePrice: string
  courseTotalSessions: number
  amount: string
  grossAmount: string
  discountAmount: string
  discountPercent: string
  walletCreditAmount: string
  amountBeforeWalletCredit: string
  discountNote?: string
  sessions: number
  billableSessions: number
  freeTrialSessions: number
  paidSessionsBeforeReceipt: number
  remainingSessionsAfterReceipt: number
  method: PaymentMethodKey
  note?: string
  createdByName: string
  createdAt: string
  lines: ReceiptLineItem[]
}

export type ReceiptPrintDetail = ReceiptListItem & {
  centerName: string
  branchName: string
  content: string
  amountInWords: string
  unitPrice: string
  joinSessionNumber?: number
  totalCourseSessionsAtJoin?: number
}

export type ExpenseListItem = {
  id: string
  code: string
  category: ExpenseCategoryKey
  amount: string
  description: string
  date: string
  createdByName: string
  refundEntitlementId?: string
  refundStudentId?: string
  refundStudentName?: string
}

export type FinanceSummary = {
  month: string
  revenue: string
  walletCreditApplied: string
  walletCreditIssued: string
  expense: string
  salaryExpense: string
  refundExpense: string
  operatingExpense: string
  profit: string
  netProfit: string
  receiptCount: number
  expenseCount: number
  receiptsByMethod: Array<{
    method: PaymentMethodKey
    amount: string
    count: number
  }>
  expensesByCategory: Array<{
    category: ExpenseCategoryKey
    amount: string
    count: number
  }>
}
