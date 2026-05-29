export type ZaloTemplateKey = "TUITION_LOW_SESSIONS" | "TRIAL_FOLLOW_UP" | "RENEWAL_CONFIRMATION"

export type ZaloTemplate = {
  id: ZaloTemplateKey
  name: string
  category: "TUITION" | "CRM" | "RENEWAL"
  body: string
}

export const zaloTemplates: ZaloTemplate[] = [
  {
    id: "TUITION_LOW_SESSIONS",
    name: "Nhắc học phí khi sắp hết buổi",
    category: "TUITION",
    body:
      "Kid Seeds Hub xin chào {parentName}. Bé {studentName} còn {sessionsRemaining} buổi trong khóa {courseName}. Trung tâm nhắc phụ huynh gia hạn để lịch học không bị gián đoạn ạ."
  },
  {
    id: "TRIAL_FOLLOW_UP",
    name: "Follow-up sau học thử",
    category: "CRM",
    body:
      "Kid Seeds Hub xin chào {parentName}. Trung tâm gửi nhận xét nhanh sau buổi học thử của bé {studentName}. Nếu phụ huynh cần tư vấn lộ trình tiếp theo, Sale sẽ hỗ trợ ngay ạ."
  },
  {
    id: "RENEWAL_CONFIRMATION",
    name: "Xác nhận gia hạn khóa học",
    category: "RENEWAL",
    body:
      "Kid Seeds Hub đã ghi nhận gia hạn khóa {courseName} cho bé {studentName}. Cảm ơn phụ huynh {parentName} đã đồng hành cùng trung tâm."
  }
]

export function renderZaloTemplate(template: ZaloTemplate, values: Record<string, string | number>) {
  return template.body.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`))
}
