import { Plus } from "lucide-react"
import type { ReactNode } from "react"

export function LearningMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-brand-red/10 bg-white/45 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-brand-ink">{value}</p>
    </div>
  )
}

export function SectionHeader({ title, description, icon }: { title: string; description?: string; icon?: ReactNode }) {
  return (
    <div className="p-5">
      <h2 className="flex items-center gap-2 font-semibold text-brand-ink">
        {icon}
        {title}
      </h2>
      {description ? <p className="mt-1 text-sm text-stone-500">{description}</p> : null}
    </div>
  )
}

export function FormFooter({ loading, label, loadingLabel, disabled = false }: { loading: boolean; label: string; loadingLabel: string; disabled?: boolean }) {
  return (
    <div className="flex justify-end p-5">
      <button type="submit" disabled={loading || disabled} className="glass-button-primary inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">
        <Plus className="h-4 w-4" />
        {loading ? loadingLabel : label}
      </button>
    </div>
  )
}

export function InfoCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="neu-card rounded-3xl p-5">
      <h2 className="font-semibold text-brand-ink">{title}</h2>
      <div className="mt-4 space-y-2">
        {items.map((item) => <p key={item} className="rounded-2xl border border-brand-red/10 px-3 py-2 text-sm text-stone-600">{item}</p>)}
      </div>
    </div>
  )
}

export function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-brand-red/10 bg-white/45 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-brand-ink">{value}</p>
    </div>
  )
}

export function ListCard({ title, count, children }: { title: string; count?: string; children: ReactNode }) {
  return (
    <div className="neu-card rounded-3xl">
      <div className="flex items-center justify-between gap-3 p-5">
        <h2 className="font-semibold text-brand-ink">{title}</h2>
        {count ? <span className="rounded-2xl border border-brand-red/10 px-3 py-2 text-xs font-semibold text-brand-red">{count}</span> : null}
      </div>
      <div className="content-border max-h-[58vh] space-y-3 overflow-auto p-5">{children}</div>
    </div>
  )
}

export function EmptyState({ text }: { text: string }) {
  return <p className="rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500">{text}</p>
}

export function DetailInput({
  label,
  value,
  onChange,
  type = "text",
  min,
  hint,
  required = false
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  min?: number
  hint?: string
  required?: boolean
}) {
  return (
    <label className="group relative block text-sm font-semibold text-stone-700">
      {label}
      <input
        className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none placeholder:text-stone-400"
        type={type}
        min={min}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      />
      {hint ? <FieldHint>{hint}</FieldHint> : null}
    </label>
  )
}

export function FieldHint({ children }: { children: ReactNode }) {
  return (
    <span className="pointer-events-none absolute left-0 top-full z-20 mt-2 hidden max-w-xs rounded-2xl border border-brand-red/10 bg-white/95 px-3 py-2 text-xs font-medium leading-5 text-stone-600 shadow-[0_14px_35px_rgba(165,36,39,0.14)] group-focus-within:block group-hover:block">
      {children}
    </span>
  )
}
