import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/backend/activity"
import { staffProfileInclude, toStaffProfileItem } from "@/lib/backend/staff-profile"
import { prisma } from "@/lib/prisma"
import { staffProfileUpsertSchema } from "@/lib/validations/staff-profile"

const staffRoles = ["ADMIN", "SALE", "TEACHER"] as const

function canManageStaffProfiles(role: string) {
  return role === "ADMIN"
}

function parseDateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`)
}

export async function GET() {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!canManageStaffProfiles(session.user.role)) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền xem hồ sơ lương nhân sự." }, { status: 403 })
  }

  const profiles = await prisma.staffProfile.findMany({
    include: staffProfileInclude,
    orderBy: [{ payrollActive: "desc" }, { updatedAt: "desc" }]
  })

  return ok(profiles.map(toStaffProfileItem))
}

export async function POST(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!canManageStaffProfiles(session.user.role)) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền cập nhật hồ sơ lương nhân sự." }, { status: 403 })
  }

  const body = await request.json()
  const parsed = staffProfileUpsertSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Thông tin hồ sơ nhân sự không hợp lệ." }, { status: 400 })
  }

  const staff = await prisma.user.findFirst({
    where: {
      id: parsed.data.userId,
      role: { in: [...staffRoles] },
      isActive: true
    },
    select: { id: true, name: true }
  })

  if (!staff) {
    return fail({ code: "STAFF_NOT_FOUND", message: "Không tìm thấy nhân sự đang hoạt động." }, { status: 404 })
  }

  const monthlySalary = parsed.data.employmentType === "FULL_TIME" ? new Prisma.Decimal(parsed.data.monthlySalary || "0") : null
  const hourlyRate = parsed.data.employmentType === "PART_TIME" ? new Prisma.Decimal(parsed.data.hourlyRate || "0") : null

  const profile = await prisma.$transaction(async (tx) => {
    const saved = await tx.staffProfile.upsert({
      where: { userId: parsed.data.userId },
      create: {
        userId: parsed.data.userId,
        employmentType: parsed.data.employmentType,
        startDate: parseDateOnly(parsed.data.startDate),
        monthlySalary,
        hourlyRate,
        payrollActive: parsed.data.payrollActive ?? true
      },
      update: {
        employmentType: parsed.data.employmentType,
        startDate: parseDateOnly(parsed.data.startDate),
        monthlySalary,
        hourlyRate,
        payrollActive: parsed.data.payrollActive ?? true
      },
      include: staffProfileInclude
    })

    await createAuditLog(tx, {
      actorId: session.user.id,
      action: "staff_profile.upsert",
      entityType: "StaffProfile",
      entityId: saved.id,
      summary: `Cập nhật hồ sơ nhân sự ${staff.name}`,
      metadata: {
        staffId: staff.id,
        employmentType: parsed.data.employmentType,
        payrollActive: parsed.data.payrollActive ?? true
      }
    })

    return saved
  })

  return ok(toStaffProfileItem(profile))
}
