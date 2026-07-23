import { fail, ok } from "@/lib/api-response"
import { requireRoutePermission } from "@/lib/backend/api-route"
import { getClassTimeline } from "@/lib/modules/classes/class-timeline"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const authorization = await requireRoutePermission({
    permissions: ["students:view_all", "students:view_class"],
    forbiddenMessage: "Bạn không có quyền xem tiến độ lớp học."
  })
  if (authorization instanceof Response) return authorization

  const { id } = await context.params
  const timeline = await getClassTimeline({
    classId: id,
    viewerId: authorization.user.id,
    role: authorization.user.role
  })

  if (!timeline) {
    return fail({ code: "CLASS_NOT_FOUND", message: "Không tìm thấy lớp học hoặc bạn không có quyền xem lớp này." }, { status: 404 })
  }

  return ok(timeline)
}
