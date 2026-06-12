"use client"

import { Printer } from "lucide-react"
import { useEffect, useState } from "react"
import { BrandLogo } from "@/components/shared/brand-logo"
import type { ApiResponse } from "@/lib/api-response"
import { paymentMethodLabels, receiptExtraLineTypeLabels, type ReceiptPrintDetail } from "@/lib/contracts/finance"

function formatCurrency(value: string | number) {
  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 0,
    style: "currency",
    currency: "VND"
  }).format(Number(value))
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(value))
}

function ReceiptRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="receipt-row">
      <span>{label}</span>
      <strong className={strong ? "receipt-total" : undefined}>{value}</strong>
    </div>
  )
}

function formatLineDiscount(line: ReceiptPrintDetail["lines"][number]) {
  const cashDiscount = Number(line.discountAmount)
  const percentDiscount = Number(line.discountPercent)
  const grossAmount = Number(line.grossAmount)
  const totalDiscount = cashDiscount + grossAmount * percentDiscount / 100
  const parts = []

  if (percentDiscount > 0) parts.push(`${percentDiscount}%`)
  if (cashDiscount > 0) parts.push(formatCurrency(cashDiscount))

  return parts.length ? `${parts.join(" + ")} (${formatCurrency(totalDiscount)})` : formatCurrency(0)
}

export function ReceiptPrintClient({ receiptId }: { receiptId: string }) {
  const [receipt, setReceipt] = useState<ReceiptPrintDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const discountTotal = receipt ? Number(receipt.discountAmount) : 0
  const walletCreditAmount = receipt ? Number(receipt.walletCreditAmount) : 0

  useEffect(() => {
    let isMounted = true

    async function loadReceipt() {
      try {
        const response = await fetch(`/api/receipts/${receiptId}`, { cache: "no-store" })
        const payload = (await response.json()) as ApiResponse<ReceiptPrintDetail>

        if (!isMounted) return

        if (!response.ok || !payload.success || !payload.data) {
          setError(payload.error?.message ?? "Không tải được phiếu thu.")
          return
        }

        setReceipt(payload.data)
      } catch {
        if (isMounted) setError("Không tải được phiếu thu.")
      }
    }

    void loadReceipt()

    return () => {
      isMounted = false
    }
  }, [receiptId])

  if (error) {
    return <main className="receipt-print-page"><p className="receipt-error">{error}</p></main>
  }

  if (!receipt) {
    return <main className="receipt-print-page"><p className="receipt-error">Đang tải phiếu thu...</p></main>
  }

  return (
    <main className="receipt-print-page">
      <div className="receipt-actions no-print">
        <button type="button" onClick={() => window.print()} className="glass-button-primary inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold">
          <Printer className="h-4 w-4" />
          In / Lưu PDF
        </button>
      </div>

      <article className="receipt-paper">
        <header className="receipt-header">
          <div className="receipt-logo">
            <BrandLogo print imageClassName="receipt-brand-logo" />
          </div>
          <div className="receipt-meta">
            <p>Số phiếu: <strong>{receipt.code}</strong></p>
            <p>Ngày thu: <strong>{formatDate(receipt.createdAt)}</strong></p>
          </div>
        </header>

        <section className="receipt-title">
          <p>{receipt.centerName}</p>
          <h1>Phiếu thu học phí</h1>
          <span>{receipt.branchName}</span>
        </section>

        <section className="receipt-grid">
          <ReceiptRow label="Học viên" value={`${receipt.studentName} (${receipt.studentCode})`} />
          <ReceiptRow label="Phụ huynh" value={`${receipt.parentName} - ${receipt.parentPhone}`} />
          <ReceiptRow label="Khóa học" value={receipt.lines.length > 1 ? `${receipt.lines.length} khóa đã đăng ký` : receipt.courseName} />
          <ReceiptRow label="Nội dung" value={receipt.content} />
          <ReceiptRow label="Phương thức" value={paymentMethodLabels[receipt.method]} />
          <ReceiptRow label="Người thu" value={receipt.createdByName} />
        </section>

        <section className="receipt-section">
          <h2>Chi tiết khóa đã đăng ký</h2>
          <div className="receipt-line-table">
            <div className="receipt-line-table-head">
              <span>Khóa</span>
              <span>Buổi tính phí</span>
              <span>Học thử</span>
              <span>Đã học trước</span>
              <span>Giảm giá</span>
              <span>Thành tiền</span>
            </div>
            {(receipt.lines.length ? receipt.lines : [{
              id: receipt.id,
              enrollmentId: receipt.enrollmentId,
              courseName: receipt.courseName,
              coursePrice: receipt.coursePrice,
              courseTotalSessions: receipt.courseTotalSessions,
              unitPrice: receipt.unitPrice,
              grossAmount: receipt.grossAmount,
              discountAmount: receipt.discountAmount,
              discountPercent: receipt.discountPercent,
              amount: receipt.amount,
              billableSessions: receipt.billableSessions,
              freeTrialSessions: receipt.freeTrialSessions,
              paidSessionsBeforeReceipt: receipt.paidSessionsBeforeReceipt,
              remainingSessionsAfterReceipt: receipt.remainingSessionsAfterReceipt
            }]).map((line) => {
              return (
                <div key={line.id} className="receipt-line-table-row">
                  <span>
                    <strong>{line.courseName}</strong>
                    <small>{formatCurrency(line.coursePrice)} · {line.courseTotalSessions} buổi · {formatCurrency(line.unitPrice)}/buổi</small>
                  </span>
                  <span>{line.billableSessions}</span>
                  <span>{line.freeTrialSessions}</span>
                  <span>{line.paidSessionsBeforeReceipt}</span>
                  <span>{formatLineDiscount(line)}</span>
                  <span><strong>{formatCurrency(line.amount)}</strong></span>
                </div>
              )
            })}
          </div>
        </section>

        {receipt.extraLines.length ? (
          <section className="receipt-section">
            <h2>Cần thu riêng</h2>
            <div className="receipt-line-table">
              <div className="receipt-line-table-head">
                <span>Loại</span>
                <span>Nội dung</span>
                <span>Số giờ/sl</span>
                <span>Đơn giá</span>
                <span>Ghi chú</span>
                <span>Thành tiền</span>
              </div>
              {receipt.extraLines.map((line) => (
                <div key={line.id} className="receipt-line-table-row">
                  <span>{receiptExtraLineTypeLabels[line.type]}</span>
                  <span><strong>{line.description}</strong></span>
                  <span>{Number(line.quantity).toLocaleString("vi-VN")}</span>
                  <span>{formatCurrency(line.unitPrice)}</span>
                  <span>{line.note ?? "-"}</span>
                  <span><strong>{formatCurrency(line.amount)}</strong></span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="receipt-section">
          <h2>Thanh toán</h2>
          <div className="receipt-grid">
            <ReceiptRow label="Tổng tiền trước giảm" value={formatCurrency(receipt.grossAmount)} />
            <ReceiptRow label="Tổng giảm giá" value={formatCurrency(receipt.discountAmount)} />
            <ReceiptRow label="Chiết khấu %" value={receipt.lines.length > 1 ? "Theo từng dòng" : `${receipt.discountPercent}%`} />
            <ReceiptRow label="Tổng khuyến mãi" value={formatCurrency(discountTotal)} />
            <ReceiptRow label="Tổng sau giảm" value={formatCurrency(receipt.amountBeforeWalletCredit)} />
            <ReceiptRow label="Credit chuyển lớp/ví" value={walletCreditAmount > 0 ? `-${formatCurrency(walletCreditAmount)}` : formatCurrency(0)} />
            <ReceiptRow label="Thực thu phụ huynh" value={formatCurrency(receipt.amount)} strong />
            <ReceiptRow label="Bằng chữ" value={receipt.amountInWords} strong />
          </div>
          {receipt.note ? <p className="receipt-note">Ghi chú phiếu thu: {receipt.note}</p> : null}
        </section>

        <footer className="receipt-signatures">
          <div>
            <p>Người nộp tiền</p>
            <span>Ký và ghi rõ họ tên</span>
          </div>
          <div>
            <p>Người thu tiền</p>
            <span>Ký và ghi rõ họ tên</span>
          </div>
        </footer>
      </article>
    </main>
  )
}
