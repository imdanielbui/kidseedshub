import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { normalizeLeadSourceOptions } from "@/lib/backend/lead-sources"
import type { PipelineOptions } from "@/lib/contracts/crm"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "pipeline:manage")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền xem tuỳ chọn pipeline." }, { status: 403 })
  }

  const [sales, classes, leadSourceRows] = await prisma.$transaction([
    prisma.user.findMany({
      where: { role: { in: ["ADMIN", "SALE"] }, isActive: true },
      select: { id: true, name: true },
      orderBy: [{ role: "desc" }, { name: "asc" }]
    }),
    prisma.class.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: [{ weekday: "asc" }, { startTime: "asc" }, { name: "asc" }]
    }),
    prisma.student.findMany({
      where: { leadSource: { not: null } },
      select: { leadSource: true },
      orderBy: { leadSource: "asc" }
    })
  ])

  const options: PipelineOptions = {
    sales,
    classes,
    leadSources: normalizeLeadSourceOptions(leadSourceRows)
  }

  return ok(options)
}
