"use client"

import { Printer } from "lucide-react"
import { useEffect, useState } from "react"
import { BrandLogo } from "@/components/shared/brand-logo"
import type { ApiResponse } from "@/lib/api-response"
import { otherIncomeCategoryLabels, paymentMethodLabels, type OtherIncomeReceiptPrintDetail } from "@/lib/contracts/finance"

function formatCurrency(value: string) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0, style: "currency", currency: "VND" }).format(Number(value))
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value))
}

export function OtherIncomeReceiptPrintClient({ receiptId }: { receiptId: string }) {
  const [receipt, setReceipt] = useState<OtherIncomeReceiptPrintDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    void (async () => {
      try {
        const response = await fetch(`/api/other-income-receipts/${receiptId}`, { cache: "no-store" })
        const payload = (await response.json()) as ApiResponse<OtherIncomeReceiptPrintDetail>
        if (!isMounted) return
        if (!response.ok || !payload.success || !payload.data) {
          setError(payload.error?.message ?? "Không tải được phiếu thu khác.")
          return
        }
        setReceipt(payload.data)
      } catch {
        if (isMounted) setError("Không tải được phiếu thu khác.")
      }
    })()
    return () => { isMounted = false }
  }, [receiptId])

  if (error) return <main className="receipt-print-page"><p className="receipt-error">{error}</p></main>
  if (!receipt) return <main className="receipt-print-page"><p className="receipt-error">Đang tải phiếu thu...</p></main>

  return (
    <main className="receipt-print-page">
      <div className="receipt-actions no-print"><button type="button" onClick={() => window.print()} className="glass-button-primary inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold"><Printer className="h-4 w-4" />In / Lưu PDF</button></div>
      <article className="receipt-paper">
        <header className="receipt-header"><div className="receipt-logo"><BrandLogo print imageClassName="receipt-brand-logo" /></div><div className="receipt-meta"><p>Số phiếu: <strong>{receipt.code}</strong></p><p>Ngày thu: <strong>{formatDate(receipt.createdAt)}</strong></p></div></header>
        <section className="receipt-title"><p>{receipt.centerName}</p><h1>Phiếu thu khác</h1><span>{receipt.branchName}</span></section>
        <section className="receipt-grid">
          <div className="receipt-row"><span>Danh mục</span><strong>{otherIncomeCategoryLabels[receipt.category]}</strong></div>
          <div className="receipt-row"><span>Người nộp tiền</span><strong>{receipt.payerName}{receipt.payerPhone ? ` - ${receipt.payerPhone}` : ""}</strong></div>
          <div className="receipt-row"><span>Nội dung thu</span><strong>{receipt.description}</strong></div>
          <div className="receipt-row"><span>Phương thức</span><strong>{paymentMethodLabels[receipt.method]}</strong></div>
          <div className="receipt-row"><span>Người thu</span><strong>{receipt.createdByName}</strong></div>
          <div className="receipt-row"><span>Thực thu</span><strong className="receipt-total">{formatCurrency(receipt.amount)}</strong></div>
          <div className="receipt-row"><span>Bằng chữ</span><strong>{receipt.amountInWords}</strong></div>
        </section>
        {receipt.note ? <p className="receipt-note">Ghi chú: {receipt.note}</p> : null}
        <footer className="receipt-signatures"><div><p>Người nộp tiền</p><span>Ký và ghi rõ họ tên</span></div><div><p>Người thu tiền</p><span>Ký và ghi rõ họ tên</span></div></footer>
      </article>
    </main>
  )
}
