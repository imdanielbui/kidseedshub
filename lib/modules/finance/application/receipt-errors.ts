export const receiptCreationErrorCodes = {
  enrollmentNotFound: "ENROLLMENT_NOT_FOUND",
  studentMismatch: "STUDENT_MISMATCH",
  multiStudentReceipt: "MULTI_STUDENT_RECEIPT",
  noPayableSessions: "NO_PAYABLE_SESSIONS",
  invalidBillingPeriod: "INVALID_BILLING_PERIOD",
  walletCreditExceedsBalance: "WALLET_CREDIT_EXCEEDS_BALANCE",
  walletCreditExceedsAmount: "WALLET_CREDIT_EXCEEDS_AMOUNT"
} as const

export type ReceiptCreationErrorCode = (typeof receiptCreationErrorCodes)[keyof typeof receiptCreationErrorCodes]

export class ReceiptCreationError extends Error {
  constructor(readonly code: ReceiptCreationErrorCode) {
    super(code)
    this.name = "ReceiptCreationError"
  }
}

export function receiptCreationErrorFromUnknown(error: unknown) {
  if (error instanceof ReceiptCreationError) return error
  if (!(error instanceof Error)) return null

  const match = Object.values(receiptCreationErrorCodes).find((code) => code === error.message)
  return match ? new ReceiptCreationError(match) : null
}
