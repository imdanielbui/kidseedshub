import type { ClassProgressSummary } from "@/lib/contracts/class-progress"

export const pipelineStages = [
  {
    key: "LEAD",
    title: "Lead",
    hint: "Phụ huynh mới để lại thông tin"
  },
  {
    key: "TRIAL",
    title: "Học thử",
    hint: "Đã hẹn hoặc đã tham gia học thử"
  },
  {
    key: "EVALUATION",
    title: "Đánh giá",
    hint: "Đang tư vấn kết quả và lộ trình"
  },
  {
    key: "CONVERTED",
    title: "Đã chốt",
    hint: "Đã đóng học phí hoặc chờ xếp lớp"
  },
  {
    key: "RETENTION",
    title: "Retention",
    hint: "Theo dõi tái đăng ký"
  },
  {
    key: "NURTURE",
    title: "Nurture",
    hint: "Lead lạnh cần chăm sóc lại sau"
  }
] as const

export type PipelineStageKey = (typeof pipelineStages)[number]["key"]

export type PipelineCard = {
  id: string
  code: string
  stage: PipelineStageKey
  parentName: string
  parentEmail?: string
  studentName: string
  phone: string
  gender: "MALE" | "FEMALE" | "OTHER" | "UNKNOWN"
  leadSource?: string
  saleOwnerId?: string
  saleOwnerName?: string
  createdByName?: string
  classNames: string[]
  classProgress: ClassProgressSummary[]
  isStale: boolean
  staleReason?: string
  stageChangedAt: string
  createdAt: string
  updatedAt: string
  daysInStage: number
}

export type PipelineStageCounts = Record<PipelineStageKey, number>

export type PipelineResponse = {
  items: PipelineCard[]
  total: number
  page: number
  limit: number
  stageCounts: PipelineStageCounts
  staleCounts: PipelineStageCounts
}

export type PipelineOption = {
  id: string
  name: string
}

export type PipelineOptions = {
  sales: PipelineOption[]
  classes: PipelineOption[]
  leadSources?: string[]
}

export const contactResultLabels = {
  INTERESTED: "Quan tâm",
  NEED_TIME: "Cần thêm thời gian",
  REJECTED: "Từ chối",
  CONVERTED: "Đã chốt",
  NO_ANSWER: "Không nghe máy"
} as const

export type ContactResultKey = keyof typeof contactResultLabels

export const taskStatusLabels = {
  PENDING: "Đang chờ",
  DONE: "Hoàn thành",
  OVERDUE: "Quá hạn"
} as const

export type TaskStatusKey = keyof typeof taskStatusLabels
