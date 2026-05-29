import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { fail, ok } from "@/lib/api-response"
import type { ClassStudentItem } from "@/lib/contracts/courses"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { classStudentsUpdateSchema } from "@/lib/validations/course"

type RouteContext = {
  params: Promise<{ id: string }>
}

const classStudentInclude = Prisma.validator<Prisma.ClassStudentInclude>()({
  student: { include: { parent: { include: { user: true } } } }
})

type ClassStudentRecord = Prisma.ClassStudentGetPayload<{ include: typeof classStudentInclude }>

function toClassStudentItem(classStudent: ClassStudentRecord): ClassStudentItem {
  return {
    id: classStudent.id,
    studentId: classStudent.studentId,
    studentName: classStudent.student.name,
    parentName: classStudent.student.parent.user.name,
    parentPhone: classStudent.student.parent.user.phone,
    isActive: classStudent.isActive
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "courses:manage")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền cập nhật học sinh trong lớp." }, { status: 403 })
  }

  const body = await request.json()
  const parsed = classStudentsUpdateSchema.safeParse(body)

  if (!parsed.success) {
    return fail({ code: "INVALID_BODY", message: "Danh sách học sinh không hợp lệ." }, { status: 400 })
  }

  const { id } = await context.params
  const studentIds = [...new Set(parsed.data.studentIds)]

  try {
    const students = await prisma.$transaction(async (tx) => {
      await tx.class.findUniqueOrThrow({ where: { id } })

      await tx.classStudent.updateMany({
        where: {
          classId: id,
          studentId: { notIn: studentIds }
        },
        data: { isActive: false }
      })

      for (const studentId of studentIds) {
        await tx.classStudent.upsert({
          where: {
            classId_studentId: {
              classId: id,
              studentId
            }
          },
          update: { isActive: true },
          create: {
            classId: id,
            studentId,
            isActive: true
          }
        })
      }

      return tx.classStudent.findMany({
        where: { classId: id, isActive: true },
        include: classStudentInclude,
        orderBy: { joinedAt: "asc" }
      })
    })

    return ok(students.map(toClassStudentItem))
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return fail({ code: "CLASS_NOT_FOUND", message: "Không tìm thấy lớp học." }, { status: 404 })
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return fail({ code: "STUDENT_NOT_FOUND", message: "Có học sinh không tồn tại." }, { status: 400 })
    }

    throw error
  }
}
