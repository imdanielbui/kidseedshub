"use client"

import { Printer } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from "recharts"
import { BrandLogo } from "@/components/shared/brand-logo"
import type { ApiResponse } from "@/lib/api-response"
import { progressLevelDescriptions, progressLevelLabels, subjectLabels, type FinalReportDetail, type ProgressLevelKey } from "@/lib/contracts/assessment"

function formatDate(value?: string) {
  if (!value) return "-"

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(value))
}

function formatScore(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

export function FinalAssessmentPrintClient({ assessmentId }: { assessmentId: string }) {
  const [report, setReport] = useState<FinalReportDetail | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    let isMounted = true

    async function loadReport() {
      try {
        const response = await fetch(`/api/final-assessments/${assessmentId}`, { cache: "no-store" })
        const payload = (await response.json()) as ApiResponse<FinalReportDetail>

        if (!isMounted) return

        if (!response.ok || !payload.success || !payload.data) {
          setError(payload.error?.message ?? "Không tải được báo cáo cuối khóa.")
          return
        }

        setReport(payload.data)
      } catch {
        if (isMounted) setError("Không tải được báo cáo cuối khóa.")
      }
    }

    void loadReport()

    return () => {
      isMounted = false
    }
  }, [assessmentId])

  const rubricTotals = useMemo(() => {
    if (!report) return { skills: 0, outcomes: 0 }

    return report.rubric.domains.reduce(
      (total, domain) => ({
        skills: total.skills + domain.skills.length,
        outcomes: total.outcomes + domain.skills.reduce((sum, skill) => sum + skill.outcomes.length, 0)
      }),
      { skills: 0, outcomes: 0 }
    )
  }, [report])
  const roboticsChartData = useMemo(
    () => report?.roboticsSkillSummaries?.map((skill) => ({ skill: skill.label, score: skill.averageScore, fullMark: 5 })) ?? [],
    [report]
  )
  const roboticsAverage = useMemo(() => {
    const scores = report?.roboticsSkillSummaries?.map((skill) => skill.averageScore).filter((score) => score > 0) ?? []

    if (!scores.length) return 0

    return Math.round((scores.reduce((total, score) => total + score, 0) / scores.length) * 10) / 10
  }, [report])

  if (error) {
    return <main className="receipt-print-page"><p className="receipt-error">{error}</p></main>
  }

  if (!report) {
    return <main className="receipt-print-page"><p className="receipt-error">Đang tải báo cáo cuối khóa...</p></main>
  }

  return (
    <main className="receipt-print-page">
      <div className="receipt-actions no-print">
        <button type="button" onClick={() => window.print()} className="glass-button-primary inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold">
          <Printer className="h-4 w-4" />
          In / Lưu PDF
        </button>
      </div>

      <section className="receipt-sheet">
        <header className="receipt-header">
          <div className="receipt-logo">
            <BrandLogo print imageClassName="receipt-brand-logo" />
          </div>
          <div>
            <p className="receipt-kicker">Kid Seeds Hub</p>
            <h1>Báo cáo cuối khóa</h1>
            <p className="receipt-muted">Khơi mở tiềm năng trẻ</p>
          </div>
        </header>

        <div className="receipt-grid">
          <div>
            <p className="receipt-label">Học viên</p>
            <p className="receipt-value">{report.studentName}</p>
          </div>
          <div>
            <p className="receipt-label">Phụ huynh</p>
            <p className="receipt-value">{report.parentName} - {report.parentPhone}</p>
          </div>
          <div>
            <p className="receipt-label">Khóa học</p>
            <p className="receipt-value">{report.courseName}</p>
          </div>
          <div>
            <p className="receipt-label">Lớp</p>
            <p className="receipt-value">{report.className ?? "-"}</p>
          </div>
          <div>
            <p className="receipt-label">Bộ môn</p>
            <p className="receipt-value">{subjectLabels[report.subject]}</p>
          </div>
          <div>
            <p className="receipt-label">Giáo viên</p>
            <p className="receipt-value">{report.teacherName}</p>
          </div>
          <div>
            <p className="receipt-label">Tuần hoàn tất</p>
            <p className="receipt-value">{report.completedWeeks}/{report.requiredWeeks}</p>
          </div>
          <div>
            <p className="receipt-label">{report.status === "PUBLISHED" ? "Ngày gửi phụ huynh" : "Ngày lập báo cáo"}</p>
            <p className="receipt-value">{formatDate(report.publishedAt ?? report.createdAt)}</p>
          </div>
        </div>

        <section className="receipt-section">
          <h2>Tổng quan kỹ năng</h2>
          <div className="receipt-grid">
            <div>
              <p className="receipt-label">Rubric</p>
              <p className="receipt-value">{report.rubric.version}</p>
            </div>
            <div>
              <p className="receipt-label">Nhóm kỹ năng</p>
              <p className="receipt-value">{report.rubric.domains.length}</p>
            </div>
            <div>
              <p className="receipt-label">Kỹ năng</p>
              <p className="receipt-value">{rubricTotals.skills}</p>
            </div>
            <div>
              <p className="receipt-label">Tiêu chí</p>
              <p className="receipt-value">{rubricTotals.outcomes}</p>
            </div>
          </div>
        </section>

        {report.subject === "FUN" ? (
          <section className="receipt-section">
            <h2>Portfolio FUN theo 5 domain</h2>
            <table className="receipt-table">
              <thead>
                <tr>
                  <th>Domain</th>
                  <th>Điểm /5</th>
                  <th>Milestone đã quan sát</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {report.domainSummaries.map((domain) => (
                  <tr key={domain.domainKey}>
                    <td>{domain.label}</td>
                    <td>{formatScore(domain.scoreOutOfFive)}/5</td>
                    <td>{domain.checkedItems}/{domain.totalItems}</td>
                    <td>{domain.status === "COMPLETE" ? "Hoàn tất" : domain.status === "IN_PROGRESS" ? "Đang quan sát" : "Chưa quan sát"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        {report.subject === "ROBOTICS" ? (
          <section className="receipt-section">
            <h2>Robotics - radar 8 kỹ năng</h2>
            <div className="receipt-grid">
              <div>
                <p className="receipt-label">Điểm trung bình</p>
                <p className="receipt-value">{formatScore(roboticsAverage)}/5</p>
              </div>
              <div>
                <p className="receipt-label">Nhóm tuổi</p>
                <p className="receipt-value">{report.ageGroup ?? "7-10"}{report.ageGroupIsDefault ? " mặc định" : ""}</p>
              </div>
            </div>
            <div className="receipt-chart">
              <ResponsiveContainer width="100%" height={260}>
                <RadarChart data={roboticsChartData} outerRadius="72%">
                  <PolarGrid stroke="#e7d8d2" />
                  <PolarAngleAxis dataKey="skill" tick={{ fontSize: 10, fill: "#57534e" }} />
                  <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fontSize: 10, fill: "#78716c" }} />
                  <Radar dataKey="score" stroke="#a52427" fill="#a52427" fillOpacity={0.24} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <table className="receipt-table">
              <thead>
                <tr>
                  <th>Kỹ năng</th>
                  <th>Điểm TB</th>
                  <th>Nhận xét tự động</th>
                </tr>
              </thead>
              <tbody>
                {report.roboticsSkillSummaries?.map((skill) => (
                  <tr key={skill.skillKey}>
                    <td>
                      <strong>{skill.label}</strong>
                      {skill.description ? <span className="receipt-muted block">{skill.description}</span> : null}
                    </td>
                    <td>{formatScore(skill.averageScore)}/5</td>
                    <td>{skill.comment}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        <section className="receipt-section">
          <h2>Tiến độ đánh giá tuần</h2>
          <table className="receipt-table">
            <thead>
              <tr>
                <th>Tuần</th>
                <th>Tiêu chí đạt</th>
                <th>Nhận xét</th>
              </tr>
            </thead>
            <tbody>
              {report.weeklySummaries.map((weekly) => (
                <tr key={weekly.weekNumber}>
                  <td>Tuần {weekly.weekNumber}</td>
                  <td>{weekly.checkedItems}/{weekly.totalItems}</td>
                  <td>{weekly.comment ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="receipt-section">
          <h2>Nhận xét cuối khóa</h2>
          <div className="receipt-note-grid">
            <ReportBlock title="Điểm mạnh" value={report.strengths} />
            <ReportBlock title="Cần cải thiện" value={report.improvements} />
            <ReportBlock title="Tổng kết giáo viên" value={report.teacherSummary} />
            <ReportBlock title="Gợi ý tiếp theo" value={report.nextSteps ?? "-"} />
          </div>
        </section>

        <section className="receipt-section">
          <h2>{report.subject === "ROBOTICS" ? "Cách đọc kết quả" : "Mức tiến độ"}</h2>
          {report.subject === "ROBOTICS" ? (
            <p className="receipt-muted">Kết quả phản ánh quá trình quan sát và thực hành của bé trong khóa học, không dùng để xếp hạng học viên.</p>
          ) : null}
          <div className="receipt-note-grid">
            {report.subject === "ROBOTICS"
              ? [
                  { title: "1-2 sao - Đang làm quen", value: "Bé cần thêm thời gian thực hành và hướng dẫn phù hợp." },
                  { title: "3 sao - Đang củng cố", value: "Bé đã thực hiện được khi có gợi ý phù hợp." },
                  { title: "4 sao - Đạt kỳ vọng", value: "Bé thực hiện tốt trong các hoạt động của khóa." },
                  { title: "5 sao - Vững vàng", value: "Bé tự tin vận dụng và sẵn sàng thử thách nâng cao." }
                ].map((level) => <ReportBlock key={level.title} {...level} />)
              : Object.entries(progressLevelLabels).map(([key, label]) => (
                  <ReportBlock key={key} title={label} value={progressLevelDescriptions[key as ProgressLevelKey]} />
                ))}
          </div>
        </section>

        <footer className="receipt-signatures">
          <div>
            <p>Giáo viên phụ trách</p>
            <span>{report.teacherName}</span>
          </div>
          <div>
            <p>Xác nhận của trung tâm</p>
            <span>Kid Seeds Hub - Trung tâm Hạt Giống Nhỏ</span>
          </div>
        </footer>
      </section>
    </main>
  )
}

function ReportBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="receipt-note">
      <p className="receipt-label">{title}</p>
      <p className="receipt-value">{value}</p>
    </div>
  )
}
