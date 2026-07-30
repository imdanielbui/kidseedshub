"use client"

import { GripVertical, Plus, Save, Send, Trash2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import type { ApiResponse } from "@/lib/api-response"
import {
  rubricConfigStatusLabels,
  type AssessmentRubricConfigItem,
  type AssessmentRubricDomain,
  type SubjectKey
} from "@/lib/contracts/assessment"
import type { SubjectListItem } from "@/lib/contracts/subjects"

function slugify(value: string) {
  const base = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")

  return base || `item_${Date.now()}`
}

function cloneDomains(domains: AssessmentRubricDomain[]) {
  return domains.map((domain) => ({
    ...domain,
    skills: domain.skills.map((skill) => ({ ...skill, outcomes: [...skill.outcomes] }))
  }))
}

export function RubricSettings() {
  const [rubrics, setRubrics] = useState<AssessmentRubricConfigItem[]>([])
  const [subjects, setSubjects] = useState<SubjectListItem[]>([])
  const [subject, setSubject] = useState<SubjectKey>("FUN")
  const [selectedId, setSelectedId] = useState("")
  const [domains, setDomains] = useState<AssessmentRubricDomain[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [dragDomainIndex, setDragDomainIndex] = useState<number | null>(null)

  const subjectRubrics = useMemo(() => rubrics.filter((rubric) => rubric.subject === subject), [rubrics, subject])
  const selectedRubric = subjectRubrics.find((rubric) => rubric.id === selectedId) ?? subjectRubrics.find((rubric) => rubric.status === "ACTIVE") ?? subjectRubrics[0]
  const isDraft = selectedRubric?.status === "DRAFT"

  async function loadRubrics() {
    setIsLoading(true)
    setError("")

    const response = await fetch("/api/assessment-rubrics?all=true", { cache: "no-store" })
    const payload = (await response.json()) as ApiResponse<AssessmentRubricConfigItem[]>

    if (!response.ok || !payload.success || !payload.data) {
      setError(payload.error?.message ?? "Không tải được bộ kỹ năng.")
      setRubrics([])
      setIsLoading(false)
      return
    }

    const nextRubrics = payload.data
    const nextSubjectRubrics = nextRubrics.filter((rubric) => rubric.subject === subject)
    const active = nextSubjectRubrics.find((rubric) => rubric.status === "ACTIVE") ?? nextSubjectRubrics[0]

    setRubrics(nextRubrics)
    setSelectedId(active?.id ?? "")
    setDomains(active ? cloneDomains(active.domains) : [])
    setIsLoading(false)
  }

  useEffect(() => {
    let isMounted = true

    async function loadInitialRubrics() {
      const [rubricResponse, subjectResponse] = await Promise.all([
        fetch("/api/assessment-rubrics?all=true", { cache: "no-store" }),
        fetch("/api/subjects", { cache: "no-store" })
      ])
      const payload = (await rubricResponse.json()) as ApiResponse<AssessmentRubricConfigItem[]>
      const subjectPayload = (await subjectResponse.json()) as ApiResponse<SubjectListItem[]>

      if (!isMounted) return

      if (!rubricResponse.ok || !payload.success || !payload.data || !subjectResponse.ok || !subjectPayload.success || !subjectPayload.data) {
        setError(payload.error?.message ?? subjectPayload.error?.message ?? "Không tải được bộ kỹ năng.")
        setRubrics([])
        setIsLoading(false)
        return
      }

      const nextRubrics = payload.data
      setSubjects(subjectPayload.data)
      const nextSubjectRubrics = nextRubrics.filter((rubric) => rubric.subject === "FUN")
      const active = nextSubjectRubrics.find((rubric) => rubric.status === "ACTIVE") ?? nextSubjectRubrics[0]

      setRubrics(nextRubrics)
      setSelectedId(active?.id ?? "")
      setDomains(active ? cloneDomains(active.domains) : [])
      setIsLoading(false)
    }

    void loadInitialRubrics()

    return () => {
      isMounted = false
    }
  }, [])

  function selectSubject(nextSubject: SubjectKey) {
    const nextSubjectRubrics = rubrics.filter((rubric) => rubric.subject === nextSubject)
    const active = nextSubjectRubrics.find((rubric) => rubric.status === "ACTIVE") ?? nextSubjectRubrics[0]

    setSubject(nextSubject)
    setSelectedId(active?.id ?? "")
    setDomains(active ? cloneDomains(active.domains) : [])
  }

  function selectRubric(id: string) {
    const rubric = subjectRubrics.find((item) => item.id === id)
    setSelectedId(id)
    setDomains(rubric ? cloneDomains(rubric.domains) : [])
  }

  function updateDomain(index: number, label: string) {
    setDomains((current) => current.map((domain, domainIndex) => (domainIndex === index ? { ...domain, label, key: slugify(label) } : domain)))
  }

  function updateSkill(domainIndex: number, skillIndex: number, label: string) {
    setDomains((current) =>
      current.map((domain, index) =>
        index === domainIndex
          ? {
              ...domain,
              skills: domain.skills.map((skill, currentSkillIndex) => (currentSkillIndex === skillIndex ? { ...skill, label, key: slugify(label) } : skill))
            }
          : domain
      )
    )
  }

  function updateOutcome(domainIndex: number, skillIndex: number, outcomeIndex: number, value: string) {
    setDomains((current) =>
      current.map((domain, index) =>
        index === domainIndex
          ? {
              ...domain,
              skills: domain.skills.map((skill, currentSkillIndex) =>
                currentSkillIndex === skillIndex
                  ? {
                      ...skill,
                      outcomes: skill.outcomes.map((outcome, currentOutcomeIndex) => (currentOutcomeIndex === outcomeIndex ? value : outcome))
                    }
                  : skill
              )
            }
          : domain
      )
    )
  }

  function addDomain() {
    setDomains((current) => [
      ...current,
      {
        key: `domain_${Date.now()}`,
        label: "Nhóm kỹ năng mới",
        skills: [{ key: `skill_${Date.now()}`, label: "Kỹ năng mới", outcomes: ["Tiêu chí mới"] }]
      }
    ])
  }

  function addSkill(domainIndex: number) {
    setDomains((current) =>
      current.map((domain, index) =>
        index === domainIndex
          ? {
              ...domain,
              skills: [...domain.skills, { key: `skill_${Date.now()}`, label: "Kỹ năng mới", outcomes: ["Tiêu chí mới"] }]
            }
          : domain
      )
    )
  }

  function addOutcome(domainIndex: number, skillIndex: number) {
    setDomains((current) =>
      current.map((domain, index) =>
        index === domainIndex
          ? {
              ...domain,
              skills: domain.skills.map((skill, currentSkillIndex) => (currentSkillIndex === skillIndex ? { ...skill, outcomes: [...skill.outcomes, "Tiêu chí mới"] } : skill))
            }
          : domain
      )
    )
  }

  function removeDomain(domainIndex: number) {
    setDomains((current) => current.filter((_, index) => index !== domainIndex))
  }

  function removeSkill(domainIndex: number, skillIndex: number) {
    setDomains((current) =>
      current.map((domain, index) =>
        index === domainIndex ? { ...domain, skills: domain.skills.filter((_, currentSkillIndex) => currentSkillIndex !== skillIndex) } : domain
      )
    )
  }

  function removeOutcome(domainIndex: number, skillIndex: number, outcomeIndex: number) {
    setDomains((current) =>
      current.map((domain, index) =>
        index === domainIndex
          ? {
              ...domain,
              skills: domain.skills.map((skill, currentSkillIndex) =>
                currentSkillIndex === skillIndex ? { ...skill, outcomes: skill.outcomes.filter((_, currentOutcomeIndex) => currentOutcomeIndex !== outcomeIndex) } : skill
              )
            }
          : domain
      )
    )
  }

  function dropDomain(targetIndex: number) {
    if (dragDomainIndex === null || dragDomainIndex === targetIndex) return

    setDomains((current) => {
      const next = [...current]
      const [dragged] = next.splice(dragDomainIndex, 1)
      next.splice(targetIndex, 0, dragged)
      return next
    })
    setDragDomainIndex(null)
  }

  async function saveDraft() {
    setError("")
    setMessage("")
    setIsSaving(true)

    const response = await fetch(isDraft && selectedRubric?.id ? `/api/assessment-rubrics/${selectedRubric.id}` : "/api/assessment-rubrics", {
      method: isDraft ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(isDraft ? { domains } : { subject, domains })
    })
    const payload = (await response.json()) as ApiResponse<AssessmentRubricConfigItem>

    setIsSaving(false)

    if (!response.ok || !payload.success || !payload.data) {
      setError(payload.error?.message ?? "Không lưu được bản nháp kỹ năng.")
      return
    }

    setMessage(isDraft ? "Đã lưu bản nháp kỹ năng." : "Đã tạo bản nháp mới từ rubric đang chọn.")
    await loadRubrics()
    setSelectedId(payload.data.id ?? "")
    setDomains(cloneDomains(payload.data.domains))
  }

  async function publishDraft() {
    if (!selectedRubric?.id || !isDraft) return

    setError("")
    setMessage("")
    setIsSaving(true)

    const response = await fetch(`/api/assessment-rubrics/${selectedRubric.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ domains, action: "publish" })
    })
    const payload = (await response.json()) as ApiResponse<AssessmentRubricConfigItem>

    setIsSaving(false)

    if (!response.ok || !payload.success || !payload.data) {
      setError(payload.error?.message ?? "Không publish được bộ kỹ năng.")
      return
    }

    setMessage("Đã publish bộ kỹ năng. Lớp mới sẽ dùng version này.")
    await loadRubrics()
  }

  return (
    <section className="neu-card rounded-3xl p-6">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-red">Assessment rubric</p>
          <h2 className="mt-2 text-lg font-semibold text-brand-red">Kỹ năng đánh giá</h2>
          <p className="mt-1 text-sm text-stone-500">Quản lý nhóm kỹ năng, kỹ năng và tiêu chí checklist theo từng bộ môn.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {subjects.filter((item) => item.isActive).map((item) => (
            <button
              key={item.key}
              type="button"
              className={`glass-button-secondary px-4 py-2 text-sm font-semibold ${subject === item.key ? "text-brand-red" : ""}`}
              onClick={() => selectSubject(item.key)}
            >
              {item.name}
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="mt-5 rounded-3xl border border-brand-red/15 bg-white/50 p-4 text-sm text-brand-red">{error}</p> : null}
      {message ? <p className="mt-5 rounded-3xl border border-brand-red/15 bg-white/50 p-4 text-sm font-semibold text-brand-red">{message}</p> : null}

      <div className="content-border mt-5 grid gap-4 pt-5 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-2">
          {isLoading ? <p className="text-sm text-stone-500">Đang tải bộ kỹ năng...</p> : null}
          {subjectRubrics.map((rubric) => (
            <button
              key={rubric.id ?? rubric.version}
              type="button"
              className={`neu-list-item w-full rounded-2xl p-3 text-left text-sm ${selectedRubric?.id === rubric.id ? "text-brand-red" : "text-stone-600"}`}
              onClick={() => selectRubric(rubric.id ?? "")}
            >
              <span className="block font-semibold">{rubric.version}</span>
              <span className="mt-1 block text-xs">{rubricConfigStatusLabels[rubric.status]} - {rubric.domains.length} nhóm</span>
            </button>
          ))}
          {subjectRubrics.length === 0 ? <p className="rounded-2xl border border-brand-red/10 p-3 text-sm text-stone-500">Chưa có rubric cho bộ môn này.</p> : null}
        </aside>

        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-brand-ink">
                {selectedRubric ? `${selectedRubric.version} - ${rubricConfigStatusLabels[selectedRubric.status]}` : "Bộ kỹ năng mới"}
              </p>
              <p className="mt-1 text-xs text-stone-500">Rubric đang dùng sẽ không bị sửa trực tiếp; lưu thay đổi sẽ tạo bản nháp nếu cần.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="glass-button-secondary inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold" onClick={addDomain}>
                <Plus className="h-4 w-4" />
                Nhóm
              </button>
              <button type="button" className="glass-button-secondary inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold" disabled={isSaving} onClick={() => void saveDraft()}>
                <Save className="h-4 w-4" />
                Lưu nháp
              </button>
              <button type="button" className="glass-button-primary inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold" disabled={!isDraft || isSaving} onClick={() => void publishDraft()}>
                <Send className="h-4 w-4" />
                Publish
              </button>
            </div>
          </div>

          {domains.map((domain, domainIndex) => (
            <article
              key={`${domain.key}-${domainIndex}`}
              className="rounded-2xl border border-brand-red/10 bg-white/35 p-3"
              draggable
              onDragStart={() => setDragDomainIndex(domainIndex)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => dropDomain(domainIndex)}
            >
              <div className="grid gap-2 md:grid-cols-[24px_1fr_auto] md:items-center">
                <GripVertical className="mt-3 h-4 w-4 cursor-grab text-stone-400 md:mt-0" />
                <input
                  className="neu-pressed rounded-2xl bg-transparent px-4 py-3 text-sm font-semibold text-brand-ink outline-none"
                  value={domain.label}
                  onChange={(event) => updateDomain(domainIndex, event.target.value)}
                />
                <button type="button" className="rounded-2xl border border-brand-red/10 p-3 text-brand-red" onClick={() => removeDomain(domainIndex)}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 space-y-3 pl-0 md:pl-8">
                {domain.skills.map((skill, skillIndex) => (
                  <div key={`${skill.key}-${skillIndex}`} className="rounded-2xl border border-brand-red/10 p-3">
                    <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                      <input
                        className="neu-pressed rounded-2xl bg-transparent px-4 py-3 text-sm text-brand-ink outline-none"
                        value={skill.label}
                        onChange={(event) => updateSkill(domainIndex, skillIndex, event.target.value)}
                      />
                      <button type="button" className="rounded-2xl border border-brand-red/10 p-3 text-brand-red" onClick={() => removeSkill(domainIndex, skillIndex)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      {skill.outcomes.map((outcome, outcomeIndex) => (
                        <div key={`${skill.key}-${outcomeIndex}`} className="grid grid-cols-[1fr_auto] gap-2">
                          <input
                            className="neu-pressed rounded-2xl bg-transparent px-3 py-2 text-xs text-brand-ink outline-none"
                            value={outcome}
                            onChange={(event) => updateOutcome(domainIndex, skillIndex, outcomeIndex, event.target.value)}
                          />
                          <button type="button" className="rounded-2xl border border-brand-red/10 p-2 text-brand-red" onClick={() => removeOutcome(domainIndex, skillIndex, outcomeIndex)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button type="button" className="mt-3 rounded-2xl border border-brand-red/10 px-3 py-2 text-xs font-semibold text-brand-red" onClick={() => addOutcome(domainIndex, skillIndex)}>
                      Thêm tiêu chí
                    </button>
                  </div>
                ))}
                <button type="button" className="rounded-2xl border border-brand-red/10 px-3 py-2 text-xs font-semibold text-brand-red" onClick={() => addSkill(domainIndex)}>
                  Thêm kỹ năng
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
