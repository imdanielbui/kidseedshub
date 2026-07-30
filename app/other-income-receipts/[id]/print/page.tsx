import { OtherIncomeReceiptPrintClient } from "./other-income-receipt-print-client"

export default async function OtherIncomeReceiptPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <OtherIncomeReceiptPrintClient receiptId={id} />
}
