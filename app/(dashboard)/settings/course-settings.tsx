"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import { BookOpenCheck, RefreshCcw, Save, Settings2 } from "lucide-react"
import type { ApiResponse } from "@/lib/api-response"
import type { CourseListItem } from "@/lib/contracts/courses"
import type { SubjectListItem } from "@/lib/contracts/subjects"

type CourseFormState = {
  id?: string
  name: string
  subject: string
  description: string
  totalSessions: string
  price: string
  isActive: boolean
}

const emptyCourseForm: CourseFormState = {
  name: "",
  subject: "FUN",
  description: "",
  totalSessions: "12",
  price: "0",
  isActive: true
}

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0
})

async function fetchCourseList() {
  const response = await fetch("/api/courses", { cache: "no-store" })
  return (await response.json()) as ApiResponse<CourseListItem[]>
}

async function fetchSubjectList() {
  const response = await fetch("/api/subjects", { cache: "no-store" })
  return (await response.json()) as ApiResponse<SubjectListItem[]>
}

export function CourseSettings() {
  const [courses, setCourses] = useState<CourseListItem[]>([])
  const [subjects, setSubjects] = useState<SubjectListItem[]>([])
  const [form, setForm] = useState<CourseFormState>(emptyCourseForm)
  const [subjectName, setSubjectName] = useState("")
  const [subjectKey, setSubjectKey] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingSubject, setIsSavingSubject] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const activeCount = useMemo(() => courses.filter((course) => course.isActive).length, [courses])
  const activeSubjects = useMemo(() => subjects.filter((subject) => subject.isActive), [subjects])
  const subjectNameByKey = useMemo(() => new Map(subjects.map((subject) => [subject.key, subject.name])), [subjects])
  const isEditing = Boolean(form.id)

  const loadCourses = useCallback(async () => {
    setIsLoading(true)
    setError("")

    const payload = await fetchCourseList()

    if (!payload.success || !payload.data) {
      setError(payload.error?.message ?? "Không tải được danh sách khóa học.")
      setCourses([])
      setIsLoading(false)
      return
    }

    setCourses(payload.data)
    setIsLoading(false)
  }, [])

  const loadSubjects = useCallback(async () => {
    const payload = await fetchSubjectList()
    if (!payload.success || !payload.data) {
      setError(payload.error?.message ?? "Không tải được danh sách bộ môn.")
      return
    }
    setSubjects(payload.data)
  }, [])

  useEffect(() => {
    let isMounted = true

    async function loadInitialCourses() {
      const [coursePayload, subjectPayload] = await Promise.all([fetchCourseList(), fetchSubjectList()])

      if (!isMounted) return

      if (!coursePayload.success || !coursePayload.data || !subjectPayload.success || !subjectPayload.data) {
        setError(coursePayload.error?.message ?? subjectPayload.error?.message ?? "Không tải được dữ liệu khóa học.")
        setCourses([])
        setIsLoading(false)
        return
      }

      setCourses(coursePayload.data)
      setSubjects(subjectPayload.data)
      setIsLoading(false)
    }

    void loadInitialCourses()

    return () => {
      isMounted = false
    }
  }, [])

  async function createSubject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setMessage("")
    setIsSavingSubject(true)

    try {
      const response = await fetch("/api/subjects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: subjectKey.trim().toUpperCase(), name: subjectName.trim() })
      })
      const payload = (await response.json()) as ApiResponse<SubjectListItem>
      if (!payload.success || !payload.data) {
        setError(payload.error?.message ?? "Không tạo được bộ môn.")
        return
      }
      const createdSubject = payload.data
      setSubjectName("")
      setSubjectKey("")
      setForm((current) => ({ ...current, subject: createdSubject.key }))
      setMessage(`Đã tạo bộ môn ${createdSubject.name} kèm rubric checklist mặc định.`)
      await loadSubjects()
    } catch {
      setError("Không tạo được bộ môn.")
    } finally {
      setIsSavingSubject(false)
    }
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setMessage("")

    const totalSessions = Number(form.totalSessions)
    const price = Number(form.price)

    if (!Number.isInteger(totalSessions) || totalSessions < 1) {
      setError("Tổng số buổi phải là số nguyên lớn hơn 0.")
      return
    }

    if (!Number.isFinite(price) || price < 0) {
      setError("Học phí phải là số không âm.")
      return
    }

    setIsSaving(true)

    const response = await fetch(isEditing ? `/api/courses/${form.id}` : "/api/courses", {
      method: isEditing ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        subject: form.subject,
        description: form.description.trim() || undefined,
        totalSessions,
        price,
        isActive: form.isActive
      })
    })
    const payload = (await response.json()) as ApiResponse<CourseListItem>

    setIsSaving(false)

    if (!payload.success || !payload.data) {
      setError(payload.error?.message ?? "Không lưu được khóa học.")
      return
    }

    setMessage(isEditing ? "Đã cập nhật khóa học." : "Đã tạo khóa học mới.")
    setForm(emptyCourseForm)
    await loadCourses()
  }

  async function toggleActive(course: CourseListItem) {
    setError("")
    setMessage("")

    const response = await fetch(`/api/courses/${course.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: !course.isActive })
    })
    const payload = (await response.json()) as ApiResponse<CourseListItem>

    if (!payload.success) {
      setError(payload.error?.message ?? "Không cập nhật được trạng thái khóa học.")
      return
    }

    setMessage(course.isActive ? "Đã ẩn khóa học khỏi luồng vận hành." : "Đã bật lại khóa học.")
    await loadCourses()
  }

  function editCourse(course: CourseListItem) {
    setError("")
    setMessage("")
    setForm({
      id: course.id,
      name: course.name,
      subject: course.subject,
      description: course.description ?? "",
      totalSessions: String(course.totalSessions),
      price: course.price,
      isActive: course.isActive
    })
  }

  return (
    <section className="neu-card rounded-3xl p-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-red">Course config</p>
          <h2 className="mt-2 text-lg font-semibold text-brand-red">Cấu hình khóa học & biểu phí</h2>
          <p className="mt-1 text-sm text-stone-500">Admin quản lý môn học, quỹ buổi mặc định và học phí dùng cho enrollment/phiếu thu.</p>
        </div>
        <div className="neu-pressed inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-brand-red">
          <Settings2 className="h-4 w-4" />
          {activeCount}/{courses.length} đang mở
        </div>
      </div>

      {error ? <p className="mt-5 rounded-3xl border border-brand-red/15 bg-white/50 p-4 text-sm text-brand-red">{error}</p> : null}
      {message ? <p className="mt-5 rounded-3xl border border-brand-red/15 bg-white/50 p-4 text-sm font-semibold text-brand-red">{message}</p> : null}

      <form className="content-border mt-5 grid gap-3 pt-5 md:grid-cols-[1fr_180px_auto]" onSubmit={createSubject}>
        <CourseInput label="Bộ môn mới" value={subjectName} onChange={setSubjectName} required />
        <CourseInput label="Mã bộ môn" value={subjectKey} onChange={(value) => setSubjectKey(value.toUpperCase())} required />
        <button type="submit" className="glass-button-primary self-end rounded-2xl px-4 py-3 text-sm font-semibold disabled:opacity-60" disabled={isSavingSubject}>{isSavingSubject ? "Đang tạo..." : "Thêm bộ môn"}</button>
      </form>

      <form className="content-border mt-5 pt-5" onSubmit={submitForm}>
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <h3 className="text-base font-semibold text-brand-ink">{isEditing ? "Sửa khóa học" : "Tạo khóa học"}</h3>
          {isEditing ? (
            <button
              type="button"
              className="neu-list-item inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold text-stone-600 hover:text-brand-red"
              onClick={() => setForm(emptyCourseForm)}
            >
              Tạo mới
            </button>
          ) : null}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <CourseInput label="Tên khóa học" value={form.name} onChange={(value) => setForm((current) => ({ ...current, name: value }))} required />
          <label className="block text-sm font-semibold text-stone-700">
            Bộ môn
            <select
              className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none"
              value={form.subject}
              onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))}
            >
              {activeSubjects.map((subject) => (
                <option key={subject.key} value={subject.key}>
                  {subject.name}
                </option>
              ))}
            </select>
          </label>
          <CourseInput
            label="Tổng số buổi"
            type="number"
            min="1"
            value={form.totalSessions}
            onChange={(value) => setForm((current) => ({ ...current, totalSessions: value }))}
            required
          />
          <CourseInput
            label="Học phí"
            type="number"
            min="0"
            value={form.price}
            onChange={(value) => setForm((current) => ({ ...current, price: value }))}
            required
          />
          <label className="block text-sm font-semibold text-stone-700 md:col-span-2">
            Mô tả
            <textarea
              className="neu-pressed mt-2 min-h-24 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none placeholder:text-stone-400"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            />
          </label>
          <label className="neu-list-item flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-stone-700">
            <input
              type="checkbox"
              className="h-4 w-4 accent-brand-red"
              checked={form.isActive}
              onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
            />
            Khóa học đang mở
          </label>
        </div>

        <button
          type="submit"
          className="glass-button-primary mt-5 inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSaving}
        >
          <Save className="h-4 w-4" />
          {isSaving ? "Đang lưu..." : isEditing ? "Lưu khóa học" : "Tạo khóa học"}
        </button>
      </form>

      <div className="content-border mt-6 pt-5">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <h3 className="text-base font-semibold text-brand-ink">Danh sách khóa học</h3>
          <button
            type="button"
            className="neu-list-item inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-stone-600 hover:text-brand-red"
            onClick={() => void loadCourses()}
          >
            <RefreshCcw className="h-4 w-4" />
            Tải lại
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {isLoading ? <p className="rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500">Đang tải khóa học...</p> : null}
          {!isLoading &&
            courses.map((course) => (
              <article key={course.id} className="neu-list-item rounded-2xl p-4">
                <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="neu-pressed flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl">
                      <BookOpenCheck className="h-5 w-5 text-brand-red" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-semibold text-brand-ink">{course.name}</h4>
                        <span className="rounded-full border border-brand-red/15 px-2 py-1 text-xs font-semibold text-brand-red">
                          {subjectNameByKey.get(course.subject) ?? course.subject}
                        </span>
                        <span className="rounded-full border border-brand-red/10 px-2 py-1 text-xs text-stone-500">
                          {course.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-stone-500">
                        {course.totalSessions} buổi - {currencyFormatter.format(Number(course.price))}
                      </p>
                      {course.description ? <p className="mt-1 text-xs text-stone-500">{course.description}</p> : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="neu-list-item rounded-2xl px-3 py-2 text-sm font-semibold text-stone-600 hover:text-brand-red"
                      onClick={() => editCourse(course)}
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      className="neu-list-item rounded-2xl px-3 py-2 text-sm font-semibold text-stone-600 hover:text-brand-red"
                      onClick={() => void toggleActive(course)}
                    >
                      {course.isActive ? "Ẩn" : "Bật"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          {!isLoading && courses.length === 0 ? <p className="rounded-2xl border border-brand-red/10 p-4 text-sm text-stone-500">Chưa có khóa học.</p> : null}
        </div>
      </div>
    </section>
  )
}

function CourseInput({
  label,
  value,
  onChange,
  type = "text",
  min,
  required = false
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  min?: string
  required?: boolean
}) {
  return (
    <label className="block text-sm font-semibold text-stone-700">
      {label}
      <input
        className="neu-pressed mt-2 w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none placeholder:text-stone-400"
        type={type}
        min={min}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      />
    </label>
  )
}
