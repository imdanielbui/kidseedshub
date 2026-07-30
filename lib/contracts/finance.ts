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

export const receiptExtraLineTypeLabels = {
  TUTORING: "Phụ đạo",
  OTHER: "Thu riêng"
} as const

export const otherIncomeCategoryLabels = {
  WORKSHOP_EVENT: "Workshop / Sự kiện",
  MATERIALS: "Giáo trình - học cụ",
  REGISTRATION_FEE: "Phí đăng ký",
  OTHER: "Thu khác"
} as const

export type PaymentMethodKey = keyof typeof paymentMethodLabels
export type ExpenseCategoryKey = keyof typeof expenseCategoryLabels
export type ReceiptExtraLineTypeKey = keyof typeof receiptExtraLineTypeLabels
export type OtherIncomeCategoryKey = keyof typeof otherIncomeCategoryLabels

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
  billingPeriodStart?: string
  billingPeriodEnd?: string
  billingLabel?: string
}

export type ReceiptExtraLineItem = {
  id: string
  type: ReceiptExtraLineTypeKey
  description: string
  quantity: string
  unitPrice: string
  amount: string
  note?: string
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
  extraLines: ReceiptExtraLineItem[]
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

export type OtherIncomeReceiptItem = {
  id: string
  code: string
  category: OtherIncomeCategoryKey
  amount: string
  payerName: string
  payerPhone?: string
  description: string
  note?: string
  method: PaymentMethodKey
  createdByName: string
  createdAt: string
}

export type OtherIncomeReceiptPrintDetail = OtherIncomeReceiptItem & {
  centerName: string
  branchName: string
  amountInWords: string
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
  netRevenue: string
  walletCreditApplied: string
  walletCreditIssued: string
  expense: string
  salaryExpense: string
  refundExpense: string
  operatingExpense: string
  profit: string
  netProfit: string
  otherIncomeRevenue: string
  tuitionRevenue: string
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
