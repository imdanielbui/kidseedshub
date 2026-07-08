import { Printer } from "lucide-react"
import Link from "next/link"
import { paymentMethodLabels, receiptExtraLineTypeLabels, type ReceiptListItem } from "@/lib/contracts/finance"
import { makeupEntitlementStatusLabels, type MakeupEntitlementItem } from "@/lib/contracts/makeup-entitlements"
import type { StudentDetail } from "@/lib/contracts/students"
import { studentWalletEntryTypeLabels, type StudentWalletSummary } from "@/lib/contracts/student-wallet"
import { EmptyState } from "./student-detail-presentational"

type FormatDate = (value: string) => string
type FormatCurrency = (value: number) => string

type FormatterProps = {
  formatDate: FormatDate
  formatCurrency: FormatCurrency
}

export function StudentWalletCard({
  summary,
  formatDate,
  formatCurrency
}: {
  summary: StudentWalletSummary | null
} & FormatterProps) {
  const entries = summary?.entries ?? []
  const balance = Number(summary?.balance ?? 0)

  return (
    <section className="neu-card rounded-3xl">
      <div className="flex flex-col gap-2 p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-semibold text-brand-ink">Ví credit học viên</h2>
          <p className="mt-1 text-sm text-stone-500">Credit từ học bù và các lần đã áp dụng vào phiếu thu.</p>
        </div>
        <span className="rounded-2xl border border-brand-red/10 px-3 py-2 text-xs font-semibold text-brand-red">{formatCurrency(balance)}</span>
      </div>
      <div className="content-border max-h-[34vh] space-y-3 overflow-auto p-5">
        {entries.length ? entries.map((entry) => (
          <article key={entry.id} className="neu-list-item rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-brand-red/15 px-2 py-1 text-xs font-semibold text-brand-red">{studentWalletEntryTypeLabels[entry.type]}</span>
                  <span className="rounded-full border border-brand-red/10 px-2 py-1 text-xs font-semibold text-stone-500">{formatDate(entry.createdAt)}</span>
                  {entry.receiptCode ? <span className="rounded-full border border-brand-red/10 px-2 py-1 text-xs font-semibold text-stone-500">{entry.receiptCode}</span> : null}
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-stone-500">{entry.note ?? "Không có ghi chú ví."}</p>
              </div>
              <p className="shrink-0 text-sm font-semibold text-brand-red">{formatCurrency(Number(entry.amount))}</p>
            </div>
          </article>
        )) : <EmptyState text={summary ? "Chưa có giao dịch ví." : "Không có dữ liệu ví hoặc tài khoản không có quyền xem ví."} />}
      </div>
    </section>
  )
}

export function EnrollmentTransferHistory({
  transfers,
  formatDate,
  formatCurrency
}: {
  transfers: StudentDetail["enrollmentTransfers"]
} & FormatterProps) {
  return (
    <section className="neu-card rounded-3xl">
      <div className="flex flex-col gap-2 p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-semibold text-brand-ink">Lịch sử chuyển lớp/khóa</h2>
          <p className="mt-1 text-sm text-stone-500">Audit phí còn dư và lớp/khóa mới sau mỗi lần chuyển.</p>
        </div>
        <span className="rounded-2xl border border-brand-red/10 px-3 py-2 text-xs font-semibold text-brand-red">{transfers.length} lần</span>
      </div>
      <div className="content-border max-h-[34vh] space-y-3 overflow-auto p-5">
        {transfers.length ? transfers.map((transfer) => (
          <article key={transfer.id} className="neu-list-item rounded-2xl p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-brand-ink">
                  {transfer.fromCourseName}
                  {transfer.toCourseName ? ` -> ${transfer.toCourseName}` : ""}
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  {transfer.fromClassName ? `Lớp cũ ${transfer.fromClassName}` : "Không có lớp cũ"}
                  {transfer.toClassName ? ` · lớp mới ${transfer.toClassName}` : ""}
                </p>
                <p className="mt-2 line-clamp-2 text-xs text-stone-500">{transfer.reason}</p>
              </div>
              <div className="shrink-0 text-left md:text-right">
                <p className="text-sm font-semibold text-brand-red">{formatCurrency(Number(transfer.creditAmount))}</p>
                <p className="mt-1 text-xs text-stone-500">{transfer.remainingSessions} buổi còn · {formatDate(transfer.createdAt)}</p>
                <p className="mt-1 text-xs text-stone-500">Tạo bởi {transfer.createdByName}</p>
              </div>
            </div>
          </article>
        )) : <EmptyState text="Chưa có lịch sử chuyển lớp/khóa." />}
      </div>
    </section>
  )
}

export function MakeupEntitlementCard({
  entitlements,
  formatDate,
  formatCurrency
}: {
  entitlements: MakeupEntitlementItem[]
} & FormatterProps) {
  return (
    <section className="neu-card rounded-3xl">
      <div className="flex flex-col gap-2 p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-semibold text-brand-ink">Học bù, credit và refund</h2>
          <p className="mt-1 text-sm text-stone-500">Theo dõi mỗi quyền học bù và cách quyền đó được xử lý.</p>
        </div>
        <span className="rounded-2xl border border-brand-red/10 px-3 py-2 text-xs font-semibold text-brand-red">{entitlements.length} quyền</span>
      </div>
      <div className="content-border max-h-[34vh] space-y-3 overflow-auto p-5">
        {entitlements.length ? entitlements.map((entitlement) => (
          <article key={entitlement.id} className="neu-list-item rounded-2xl p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-brand-red/15 px-2 py-1 text-xs font-semibold text-brand-red">{makeupEntitlementStatusLabels[entitlement.status]}</span>
                  <span className="rounded-full border border-brand-red/10 px-2 py-1 text-xs font-semibold text-stone-500">{entitlement.month}</span>
                  <span className="rounded-full border border-brand-red/10 px-2 py-1 text-xs font-semibold text-stone-500">{entitlement.isEligible ? "Đủ điều kiện" : "Không đủ điều kiện"}</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-brand-ink">{entitlement.courseName}</p>
                <p className="mt-1 line-clamp-2 text-xs text-stone-500">
                  {entitlement.className ? `${entitlement.className} · ` : ""}
                  {entitlement.sessionDate ? `Nghỉ ngày ${formatDate(entitlement.sessionDate)}` : entitlement.eligibilityReason ?? "Chưa có ngày nghỉ gốc."}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold text-stone-500">
                  {entitlement.scheduledFor ? <span className="rounded-full border border-brand-red/10 px-2 py-1">Học bù {formatDate(entitlement.scheduledFor)}</span> : null}
                  {entitlement.resolvedAmount ? <span className="rounded-full border border-brand-red/10 px-2 py-1">Số tiền {formatCurrency(Number(entitlement.resolvedAmount))}</span> : null}
                  {entitlement.refundExpenseCode ? <span className="rounded-full border border-brand-red/10 px-2 py-1">Refund {entitlement.refundExpenseCode}</span> : null}
                </div>
              </div>
              <p className="shrink-0 text-xs text-stone-500">{formatDate(entitlement.updatedAt)}</p>
            </div>
          </article>
        )) : <EmptyState text="Chưa có quyền học bù, credit hoặc refund." />}
      </div>
    </section>
  )
}

export function ReceiptHistoryCard({
  receipts,
  formatDate,
  formatCurrency
}: {
  receipts: ReceiptListItem[]
} & FormatterProps) {
  return (
    <section className="neu-card rounded-3xl">
      <div className="flex flex-col gap-2 p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-semibold text-brand-ink">Lịch sử phiếu thu</h2>
          <p className="mt-1 text-sm text-stone-500">Toàn bộ phiếu thu của học viên, gồm phiếu theo khóa, theo tháng và phiếu gộp nhiều khóa.</p>
        </div>
        <span className="rounded-2xl border border-brand-red/10 px-3 py-2 text-xs font-semibold text-brand-red">{receipts.length} phiếu</span>
      </div>
      <div className="content-border max-h-[42vh] space-y-3 overflow-auto p-5">
        {receipts.length ? receipts.map((receipt) => (
          <article key={receipt.id} className="neu-list-item rounded-2xl p-4 transition hover:shadow-md">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-brand-red/15 px-2 py-1 text-xs font-semibold text-brand-red">{receipt.code}</span>
                  <span className="rounded-full border border-brand-red/10 px-2 py-1 text-xs font-semibold text-stone-500">{paymentMethodLabels[receipt.method]}</span>
                  <span className="rounded-full border border-brand-red/10 px-2 py-1 text-xs font-semibold text-stone-500">{formatDate(receipt.createdAt)}</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-brand-ink">{receipt.courseName}</p>
                <p className="mt-1 line-clamp-2 text-xs text-stone-500">{receipt.note ?? "Không có ghi chú phiếu thu."}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold text-stone-500">
                  {receipt.lines.length ? receipt.lines.map((line) => (
                    <span key={line.id} className="rounded-full border border-brand-red/10 px-2 py-1">
                      {line.courseName}: {line.billableSessions} buổi{line.billingLabel ? ` · ${line.billingLabel}` : ""} · {formatCurrency(Number(line.amount))}
                    </span>
                  )) : (
                    <span className="rounded-full border border-brand-red/10 px-2 py-1">{receipt.billableSessions} buổi tính phí</span>
                  )}
                  {receipt.extraLines.map((line) => (
                    <span key={line.id} className="rounded-full border border-brand-red/10 px-2 py-1">
                      {receiptExtraLineTypeLabels[line.type]}: {line.description} · {formatCurrency(Number(line.amount))}
                    </span>
                  ))}
                  {Number(receipt.walletCreditAmount) > 0 ? (
                    <span className="rounded-full border border-brand-red/10 px-2 py-1">
                      Dùng credit {formatCurrency(Number(receipt.walletCreditAmount))}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-2 lg:items-end">
                <p className="text-base font-semibold text-brand-red">{formatCurrency(Number(receipt.amount))}</p>
                {Number(receipt.walletCreditAmount) > 0 ? (
                  <p className="text-xs font-semibold text-stone-500">Trước credit {formatCurrency(Number(receipt.amountBeforeWalletCredit))}</p>
                ) : null}
                <Link href={`/receipts/${receipt.id}/print`} target="_blank" className="glass-button-secondary inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold">
                  <Printer className="h-3.5 w-3.5" />
                  In phiếu
                </Link>
              </div>
            </div>
          </article>
        )) : <EmptyState text="Chưa có phiếu thu nào cho học viên này." />}
      </div>
    </section>
  )
}
