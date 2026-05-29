import ExcelJS from "exceljs"
import { auth } from "@/lib/auth"
import { fail } from "@/lib/api-response"
import { expenseCategoryLabels, paymentMethodLabels } from "@/lib/contracts/finance"
import { studentStatusLabels } from "@/lib/contracts/students"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

function styleHeader(worksheet: ExcelJS.Worksheet) {
  const header = worksheet.getRow(1)
  header.font = { bold: true, color: { argb: "FFFFFFFF" } }
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFA52427" }
  }
  header.alignment = { vertical: "middle" }
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(value)
}

export async function GET() {
  const session = await auth()

  if (!session) {
    return fail({ code: "UNAUTHORIZED", message: "Bạn cần đăng nhập." }, { status: 401 })
  }

  if (!can(session.user.role, "reports:view_all")) {
    return fail({ code: "FORBIDDEN", message: "Bạn không có quyền export dữ liệu." }, { status: 403 })
  }

  const [students, receipts, expenses] = await prisma.$transaction([
    prisma.student.findMany({
      include: {
        parent: { include: { user: true } },
        assignedTeacher: true,
        enrollments: { include: { course: true } }
      },
      orderBy: { updatedAt: "desc" }
    }),
    prisma.receipt.findMany({
      include: {
        createdBy: true,
        enrollment: {
          include: {
            student: { include: { parent: { include: { user: true } } } },
            course: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.expense.findMany({
      include: { createdBy: true },
      orderBy: { date: "desc" }
    })
  ])

  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Kid Seeds Hub"
  workbook.created = new Date()

  const studentsSheet = workbook.addWorksheet("Students")
  studentsSheet.columns = [
    { header: "Student ID", key: "id", width: 28 },
    { header: "Student Code", key: "code", width: 16 },
    { header: "Student Name", key: "name", width: 24 },
    { header: "Status", key: "status", width: 16 },
    { header: "Parent Name", key: "parentName", width: 24 },
    { header: "Parent Phone", key: "parentPhone", width: 18 },
    { header: "Parent Email", key: "parentEmail", width: 28 },
    { header: "Lead Source", key: "leadSource", width: 18 },
    { header: "Assigned Teacher", key: "teacher", width: 22 },
    { header: "Active Courses", key: "courses", width: 36 },
    { header: "Sessions Bought", key: "sessionsBought", width: 16 },
    { header: "Sessions Used", key: "sessionsUsed", width: 14 },
    { header: "Sessions Remaining", key: "sessionsRemaining", width: 18 },
    { header: "Health Note", key: "healthNote", width: 32 }
  ]
  students.forEach((student) => {
    const activeEnrollments = student.enrollments.filter((enrollment) => enrollment.isActive)
    const sessionsBought = activeEnrollments.reduce((total, enrollment) => total + enrollment.sessionsBought, 0)
    const sessionsUsed = activeEnrollments.reduce((total, enrollment) => total + enrollment.sessionsUsed, 0)

    studentsSheet.addRow({
      id: student.id,
      code: student.code,
      name: student.name,
      status: studentStatusLabels[student.status],
      parentName: student.parent.user.name,
      parentPhone: student.parent.user.phone,
      parentEmail: student.parent.user.email ?? "",
      leadSource: student.leadSource ?? "",
      teacher: student.assignedTeacher?.name ?? "",
      courses: activeEnrollments.map((enrollment) => enrollment.course.name).join(", "),
      sessionsBought,
      sessionsUsed,
      sessionsRemaining: Math.max(0, sessionsBought - sessionsUsed),
      healthNote: student.healthNote ?? ""
    })
  })
  styleHeader(studentsSheet)

  const receiptsSheet = workbook.addWorksheet("Receipts")
  receiptsSheet.columns = [
    { header: "Receipt Code", key: "code", width: 18 },
    { header: "Date", key: "date", width: 14 },
    { header: "Student Code", key: "studentCode", width: 16 },
    { header: "Student Name", key: "studentName", width: 24 },
    { header: "Parent Name", key: "parentName", width: 24 },
    { header: "Parent Phone", key: "parentPhone", width: 18 },
    { header: "Course", key: "course", width: 28 },
    { header: "Amount", key: "amount", width: 16 },
    { header: "Sessions", key: "sessions", width: 12 },
    { header: "Method", key: "method", width: 18 },
    { header: "Created By", key: "createdBy", width: 22 },
    { header: "Note", key: "note", width: 32 }
  ]
  receipts.forEach((receipt) => {
    receiptsSheet.addRow({
      code: receipt.code,
      date: formatDate(receipt.createdAt),
      studentCode: receipt.enrollment.student.code,
      studentName: receipt.enrollment.student.name,
      parentName: receipt.enrollment.student.parent.user.name,
      parentPhone: receipt.enrollment.student.parent.user.phone,
      course: receipt.enrollment.course.name,
      amount: Number(receipt.amount.toString()),
      sessions: receipt.sessions,
      method: paymentMethodLabels[receipt.method],
      createdBy: receipt.createdBy.name,
      note: receipt.note ?? ""
    })
  })
  receiptsSheet.getColumn("amount").numFmt = "#,##0"
  styleHeader(receiptsSheet)

  const expensesSheet = workbook.addWorksheet("Expenses")
  expensesSheet.columns = [
    { header: "Expense Code", key: "code", width: 18 },
    { header: "Date", key: "date", width: 14 },
    { header: "Category", key: "category", width: 18 },
    { header: "Amount", key: "amount", width: 16 },
    { header: "Description", key: "description", width: 36 },
    { header: "Created By", key: "createdBy", width: 22 },
    { header: "Invoice URL", key: "invoiceUrl", width: 36 }
  ]
  expenses.forEach((expense) => {
    expensesSheet.addRow({
      code: expense.code,
      date: formatDate(expense.date),
      category: expenseCategoryLabels[expense.category],
      amount: Number(expense.amount.toString()),
      description: expense.description,
      createdBy: expense.createdBy.name,
      invoiceUrl: expense.invoiceUrl ?? ""
    })
  })
  expensesSheet.getColumn("amount").numFmt = "#,##0"
  styleHeader(expensesSheet)

  const buffer = await workbook.xlsx.writeBuffer()
  const fileName = `kidseedshub-students-finance-${new Date().toISOString().slice(0, 10)}.xlsx`

  return new Response(buffer, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${fileName}"`
    }
  })
}
