"use client"

import { Plus } from "lucide-react"
import { useId } from "react"
import type { PipelineOptions } from "@/lib/contracts/crm"
import { genderLabels, type StudentGenderKey } from "@/lib/contracts/students"

export type LeadFormState = {
  parentName: string
  parentPhone: string
  parentEmail: string
  studentName: string
  birthDate: string
  gender: StudentGenderKey
  leadSource: string
  leadNote: string
  healthNote: string
  saleOwnerId: string
  classId: string
}

export const emptyLeadForm: LeadFormState = {
  parentName: "",
  parentPhone: "",
  parentEmail: "",
  studentName: "",
  birthDate: "",
  gender: "UNKNOWN",
  leadSource: "",
  leadNote: "",
  healthNote: "",
  saleOwnerId: "",
  classId: ""
}

type LeadFormPanelProps = {
  value: LeadFormState
  onChange: (value: LeadFormState) => void
  options: PipelineOptions
  isSubmitting: boolean
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  submitLabel?: string
}

export function LeadFormPanel({ value, onChange, options, isSubmitting, onSubmit, submitLabel = "Tạo lead và sinh mã học viên" }: LeadFormPanelProps) {
  const leadSourceListId = useId()
  const leadSources = options.leadSources ?? []

  function update<Key extends keyof LeadFormState>(key: Key, nextValue: LeadFormState[Key]) {
    onChange({ ...value, [key]: nextValue })
  }

  return (
    <form className="grid gap-2 md:grid-cols-4" onSubmit={onSubmit}>
      <LeadInput label="Tên phụ huynh" value={value.parentName} onChange={(nextValue) => update("parentName", nextValue)} required />
      <LeadInput label="Số điện thoại" value={value.parentPhone} onChange={(nextValue) => update("parentPhone", nextValue)} required />
      <LeadInput label="Tên học viên" value={value.studentName} onChange={(nextValue) => update("studentName", nextValue)} required />
      <LeadInput label="Email phụ huynh" type="email" value={value.parentEmail} onChange={(nextValue) => update("parentEmail", nextValue)} />
      <LeadInput label="Ngày sinh" type="date" value={value.birthDate} onChange={(nextValue) => update("birthDate", nextValue)} />

      <label className="block">
        <span className="text-sm font-medium text-stone-600">Giới tính</span>
        <select
          className="mt-2 w-full rounded-2xl border border-brand-red/10 bg-white/50 px-3 py-2 text-sm text-brand-ink outline-none"
          value={value.gender}
          onChange={(event) => update("gender", event.target.value as StudentGenderKey)}
        >
          {Object.entries(genderLabels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <LeadInput
        label="Nguồn lead"
        list={leadSources.length ? leadSourceListId : undefined}
        placeholder={leadSources.length ? "Chọn nguồn đã có hoặc nhập mới" : "Nhập nguồn lead"}
        value={value.leadSource}
        onChange={(nextValue) => update("leadSource", nextValue)}
      />
      {leadSources.length ? (
        <datalist id={leadSourceListId}>
          {leadSources.map((source) => (
            <option key={source} value={source} />
          ))}
        </datalist>
      ) : null}

      <label className="block">
        <span className="text-sm font-medium text-stone-600">Sale bởi</span>
        <select
          className="mt-2 w-full rounded-2xl border border-brand-red/10 bg-white/50 px-3 py-2 text-sm text-brand-ink outline-none"
          value={value.saleOwnerId}
          onChange={(event) => update("saleOwnerId", event.target.value)}
        >
          <option value="">Tự động</option>
          {options.sales.map((sale) => (
            <option key={sale.id} value={sale.id}>
              {sale.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-sm font-medium text-stone-600">Lớp học</span>
        <select
          className="mt-2 w-full rounded-2xl border border-brand-red/10 bg-white/50 px-3 py-2 text-sm text-brand-ink outline-none"
          value={value.classId}
          onChange={(event) => update("classId", event.target.value)}
        >
          <option value="">Chưa xếp lớp</option>
          {options.classes.map((klass) => (
            <option key={klass.id} value={klass.id}>
              {klass.name}
            </option>
          ))}
        </select>
      </label>

      <LeadInput label="Lưu ý sức khỏe" value={value.healthNote} onChange={(nextValue) => update("healthNote", nextValue)} />

      <label className="md:col-span-2">
        <span className="text-sm font-medium text-stone-600">Ghi chú lead</span>
        <textarea
          className="mt-2 min-h-20 w-full rounded-2xl border border-brand-red/10 bg-white/50 px-3 py-2 text-sm text-brand-ink outline-none"
          value={value.leadNote}
          onChange={(event) => update("leadNote", event.target.value)}
        />
      </label>

      <button className="glass-button-primary inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold md:col-span-4" disabled={isSubmitting} type="submit">
        <Plus className="h-4 w-4" />
        {isSubmitting ? "Đang tạo" : submitLabel}
      </button>
    </form>
  )
}

function LeadInput({
  label,
  type = "text",
  value,
  onChange,
  required = false,
  list,
  placeholder
}: {
  label: string
  type?: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  list?: string
  placeholder?: string
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-stone-600">{label}</span>
      <input
        className="mt-2 w-full rounded-2xl border border-brand-red/10 bg-white/50 px-3 py-2 text-sm text-brand-ink outline-none placeholder:text-stone-400"
        type={type}
        value={value}
        list={list}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      />
    </label>
  )
}
