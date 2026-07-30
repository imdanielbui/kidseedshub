import { Plus } from "lucide-react"
import { useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from "react"
import { DialogFormShell } from "@/components/shared/dialog-shell"
import { expenseCategoryLabels, otherIncomeCategoryLabels, paymentMethodLabels, type ExpenseCategoryKey, type PaymentMethodKey } from "@/lib/contracts/finance"
import type { StudentListItem } from "@/lib/contracts/students"
import { FinanceInput } from "./finance-presentational"
import type { ExpenseFormState, OtherIncomeReceiptFormState } from "./finance-utils"

export function StudentReceiptPickerDialog({ students, onClose, onSelectStudent }: { students: StudentListItem[]; onClose: () => void; onSelectStudent: (studentId: string) => void }) {
  const [query, setQuery] = useState("")
  const normalizedQuery = query.trim().toLowerCase()
  const matches = useMemo(
    () => students.filter((student) => !normalizedQuery || [student.code, student.name, student.parentName, student.parentPhone].some((value) => value.toLowerCase().includes(normalizedQuery))).slice(0, 12),
    [normalizedQuery, students]
  )

  return (
    <DialogFormShell title="Thu học phí học viên" eyebrow="Student tuition" description="Chọn học viên để dùng đầy đủ workflow học phí, kỳ thu, phụ đạo, credit và xác nhận đóng tiền trong hồ sơ học viên." onClose={onClose} onSubmit={(event) => event.preventDefault()} size="lg" footer={<button type="button" className="neu-list-item rounded-2xl px-4 py-3 text-sm font-semibold text-stone-600 hover:text-brand-red" onClick={onClose}>Đóng</button>}>
      <label>
        <span className="text-sm font-medium text-stone-600">Tìm học viên hoặc phụ huynh</span>
        <input className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Mã HS, tên bé, phụ huynh hoặc SĐT" autoFocus />
      </label>
      <div className="mt-4 max-h-[46vh] space-y-2 overflow-auto pr-1">
        {matches.length ? matches.map((student) => (
          <button key={student.id} type="button" className="neu-list-item flex w-full items-center justify-between gap-3 rounded-2xl p-4 text-left hover:text-brand-red" onClick={() => onSelectStudent(student.id)}>
            <span className="min-w-0"><span className="block font-semibold text-brand-ink">{student.name}</span><span className="mt-1 block text-xs text-stone-500">{student.code} - {student.parentName} - {student.parentPhone}</span></span>
            <span className="shrink-0 text-xs font-semibold">Mở tài chính</span>
          </button>
        )) : <p className="rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500">Không tìm thấy học viên phù hợp.</p>}
      </div>
    </DialogFormShell>
  )
}

export function OtherIncomeReceiptDialog({ form, isSubmitting, onClose, onSubmit, setForm }: { form: OtherIncomeReceiptFormState; isSubmitting: boolean; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; setForm: Dispatch<SetStateAction<OtherIncomeReceiptFormState>> }) {
  return (
    <DialogFormShell title="Tạo phiếu thu khác" eyebrow="Other income" description="Ghi nhận khoản thu không thuộc học phí. Phiếu này không làm thay đổi khóa học, số buổi hoặc ví học viên." onClose={onClose} onSubmit={onSubmit} size="lg" footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between"><button type="button" className="neu-list-item rounded-2xl px-4 py-3 text-sm font-semibold text-stone-600 hover:text-brand-red" onClick={onClose}>Hủy</button><button type="submit" disabled={isSubmitting} className="glass-button-primary inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"><Plus className="h-4 w-4" />{isSubmitting ? "Đang lưu" : "Lưu phiếu thu"}</button></div>}>
      <div className="grid gap-3 md:grid-cols-2">
        <label><span className="text-sm font-medium text-stone-600">Danh mục thu</span><select className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm font-medium text-brand-ink outline-none" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as OtherIncomeReceiptFormState["category"] }))}>{Object.entries(otherIncomeCategoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <FinanceInput label="Số tiền" type="number" min="1" value={form.amount} onChange={(value) => setForm((current) => ({ ...current, amount: value }))} required />
        <FinanceInput label="Người nộp tiền" value={form.payerName} onChange={(value) => setForm((current) => ({ ...current, payerName: value }))} required />
        <FinanceInput label="Số điện thoại người nộp" value={form.payerPhone} onChange={(value) => setForm((current) => ({ ...current, payerPhone: value }))} />
        <div className="md:col-span-2"><FinanceInput label="Nội dung thu" value={form.description} onChange={(value) => setForm((current) => ({ ...current, description: value }))} required /></div>
        <label><span className="text-sm font-medium text-stone-600">Phương thức</span><select className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm font-medium text-brand-ink outline-none" value={form.method} onChange={(event) => setForm((current) => ({ ...current, method: event.target.value as PaymentMethodKey }))}>{Object.entries(paymentMethodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <FinanceInput label="Ghi chú" value={form.note} onChange={(value) => setForm((current) => ({ ...current, note: value }))} />
      </div>
    </DialogFormShell>
  )
}

export function ExpenseDialog({ expenseForm, isSubmitting, onClose, onSubmit, setExpenseForm }: { expenseForm: ExpenseFormState; isSubmitting: boolean; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; setExpenseForm: Dispatch<SetStateAction<ExpenseFormState>> }) {
  return (
    <DialogFormShell title="Tạo phiếu chi" eyebrow="Expense" description="Ghi nhận chi phí vận hành theo danh mục." onClose={onClose} onSubmit={onSubmit} size="lg" footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between"><button type="button" className="neu-list-item rounded-2xl px-4 py-3 text-sm font-semibold text-stone-600 hover:text-brand-red" onClick={onClose}>Hủy</button><button type="submit" disabled={isSubmitting} className="glass-button-primary inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"><Plus className="h-4 w-4" />{isSubmitting ? "Đang lưu" : "Lưu phiếu chi"}</button></div>}>
      <div className="grid gap-3 md:grid-cols-2">
        <label><span className="text-sm font-medium text-stone-600">Danh mục</span><select className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm font-medium text-brand-ink outline-none" value={expenseForm.category} onChange={(event) => setExpenseForm((current) => ({ ...current, category: event.target.value as ExpenseCategoryKey }))}>{Object.entries(expenseCategoryLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <FinanceInput label="Ngày chi" type="date" value={expenseForm.date} onChange={(value) => setExpenseForm((current) => ({ ...current, date: value }))} required />
        <FinanceInput label="Số tiền" type="number" min="1" value={expenseForm.amount} onChange={(value) => setExpenseForm((current) => ({ ...current, amount: value }))} required />
        <FinanceInput label="Invoice URL" type="url" value={expenseForm.invoiceUrl} onChange={(value) => setExpenseForm((current) => ({ ...current, invoiceUrl: value }))} />
        <label className="md:col-span-2"><span className="text-sm font-medium text-stone-600">Mô tả</span><textarea className="neu-pressed mt-2 min-h-24 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none placeholder:text-stone-400" value={expenseForm.description} onChange={(event) => setExpenseForm((current) => ({ ...current, description: event.target.value }))} required /></label>
      </div>
    </DialogFormShell>
  )
}
