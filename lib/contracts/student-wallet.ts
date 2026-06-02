export const studentWalletEntryTypeLabels = {
  CREDIT: "Ghi credit",
  APPLIED: "Đã dùng credit"
} as const

export type StudentWalletEntryTypeKey = keyof typeof studentWalletEntryTypeLabels

export type StudentWalletEntryItem = {
  id: string
  studentId: string
  studentCode: string
  studentName: string
  amount: string
  type: StudentWalletEntryTypeKey
  makeupEntitlementId?: string
  receiptId?: string
  receiptCode?: string
  note?: string
  createdByName: string
  createdAt: string
}

export type StudentWalletSummary = {
  studentId?: string
  balance: string
  entries: StudentWalletEntryItem[]
}
