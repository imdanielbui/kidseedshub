import bcrypt from "bcryptjs"
import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import { nextStudentCode } from "@/lib/backend/codes"
import { shouldActivateParentAccount } from "@/lib/backend/parent-account"
import { createParentInitialPassword } from "@/lib/backend/parent-password"
import type { StudentListItem } from "@/lib/contracts/students"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { studentCreateSchema, studentListQuerySchema } from "@/lib/validations/student"

const studentListInclude = Prisma.validator<Prisma.StudentInclude>()({
  parent: { include: { user: true } },
  assignedTeacher: true,
  saleOwner: true,
  createdBy: true,
  enrollments: { include: { course: true } }
})

type StudentListRecord = Prisma.StudentGetPayload<{ include: typeof studentListInclude }>

function toStudentListItem(student: StudentListRecord): StudentListItem {
  const courses = student.enrollments.map((enrollment) => ({
    enrollmentId: enrollment.id,
    courseId: enrollment.courseId,
    courseName: enrollment.course.name,
    courseSubject: enrollment.course.subject,
    courseTotalSessions: enrollment.course.totalSessions,
    coursePrice: enrollment.course.price.toString(),
    sessionsBought: enrollment.sessionsBought,
    sessionsUsed: enrollment.sessionsUsed,
    sessionsRemaining: Math.max(0, enrollment.sessionsBought - enrollment.sessionsUsed),
    startDate: enrollment.startDate?.toISOString(),
    endDate: enrollment.endDate?.toISOString(),
    joinSessionNumber: enrollment.joinSessionNumber ?? undefined,
    totalCourseSessionsAtJoin: enrollment.totalCourseSessionsAtJoin ?? undefined,
    freeTrialSessions: enrollment.freeTrialSessions,
    paidSessionsBeforeReceipt: enrollment.paidSessionsBeforeReceipt,
    isActive: enrollment.isActive
  }))

  return {
    id: student.id,
    code: student.code,
    name: student.name,
    status: student.status,
    gender: student.gender,
    address: student.address ?? undefined,
    parentName: student.parent.user.name,
    parentPhone: student.parent.user.phone,
    leadSource: student.leadSource ?? undefined,
    healthNote: student.healthNote ?? undefined,
    assignedTeacherName: student.assignedTeacher?.name,
    saleOwnerName: student.saleOwner?.name,
    createdByName: student.createdBy?.name,
    sessionsRemaining: courses
      .filter((course) => course.isActive)
      .reduce((total, course) => total + course.sessionsRemaining, 0),
    courses,
    createdAt: student.createdAt.toISOString(),
    updatedAt: student.updatedAt.toISOString()
  }
}

export async function GET(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "students:view_all") && !can(session.user.role, "students:view_class")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền xem học viên." }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const parsed = studentListQuerySchema.safeParse(Object.fromEntries(searchParams))

  if (!parsed.success) {
    return fail({ code: "INVALID_QUERY", message: "Bộ lọc học viên không hợp lệ." }, { status: 400 })
  }

  const { status, classId, q, page, limit, sort, direction } = parsed.data
  const where: Prisma.StudentWhereInput = {
    ...(status ? { status } : {}),
    ...(classId ? { classStudents: { some: { classId, isActive: true } } } : {}),
    ...(q
      ? {
          OR: [
            { code: { contains: q, mode: "insensitive" as const } },
            { name: { contains: q, mode: "insensitive" as const } },
            { parent: { user: { name: { contains: q, mode: "insensitive" as const } } } },
            { parent: { user: { phone: { contains: q } } } }
          ]
        }
      : {}),
    ...(session.user.role === "TEACHER" ? { assignedTeacherId: session.user.id } : {})
  }
  const orderBy: Prisma.StudentOrderByWithRelationInput =
    sort === "parentName"
      ? { parent: { user: { name: direction } } }
      : sort === "sessionsRemaining"
        ? { updatedAt: direction }
        : { [sort]: direction }

  const [students, total] = await prisma.$transaction([
    prisma.student.findMany({
      where,
      include: studentListInclude,
      orderBy,
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.student.count({ where })
  ])

  return ok(students.map(toStudentListItem), {
    headers: {
      "x-total-count": String(total)
    }
  })
}

export async function POST(request: Request) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "students:create")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền tạo học viên." }, { status: 403 })
  }

  const body = await request.json()
  const parsed = studentCreateSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Thông tin học viên không hợp lệ." }, { status: 400 })
  }

  const data = parsed.data
  const parentPassword = createParentInitialPassword(data.parent.phone)
  const parentPasswordHash = await bcrypt.hash(parentPassword.plainText, 10)
  const shouldActivateAccount = shouldActivateParentAccount(data.status)

  const student = await prisma.$transaction(async (tx) => {
    const parentUser = await tx.user.upsert({
      where: { phone: data.parent.phone },
      update: {
        name: data.parent.name,
        email: data.parent.email,
        ...(shouldActivateAccount ? { role: "PARENT" as const, isActive: true } : {})
      },
      create: {
        name: data.parent.name,
        phone: data.parent.phone,
        email: data.parent.email,
        password: parentPasswordHash,
        role: "PARENT",
        isActive: shouldActivateAccount
      }
    })

    const parent = await tx.parent.upsert({
      where: { userId: parentUser.id },
      update: {},
      create: { userId: parentUser.id }
    })

    return tx.student.create({
      data: {
        code: await nextStudentCode(tx),
        name: data.name,
        birthDate: data.birthDate ? new Date(data.birthDate) : undefined,
        address: data.address,
        status: data.status,
        stageChangedAt: new Date(),
        gender: data.gender,
        leadSource: data.leadSource,
        leadNote: data.leadNote,
        healthNote: data.healthNote,
        saleOwnerId: data.saleOwnerId ?? (session.user.role === "SALE" ? session.user.id : undefined),
        createdById: session.user.id,
        assignedTeacherId: data.assignedTeacherId,
        parentId: parent.id,
        classStudents: data.classId
          ? {
              create: {
                classId: data.classId
              }
            }
          : undefined
      },
      include: {
        ...studentListInclude
      }
    })
  })

  return ok(toStudentListItem(student), { status: 201 })
}
