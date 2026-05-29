import { ReceiptPrintClient } from "./receipt-print-client"

type ReceiptPrintPageProps = {
  params: Promise<{ id: string }>
}

export default async function ReceiptPrintPage({ params }: ReceiptPrintPageProps) {
  const { id } = await params

  return <ReceiptPrintClient receiptId={id} />
}
