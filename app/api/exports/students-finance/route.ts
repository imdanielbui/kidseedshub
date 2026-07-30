import ExcelJS from "exceljs"
import { join } from "node:path"
import { auth } from "@/lib/auth"
import { fail } from "@/lib/api-response"
import { expenseCategoryLabels, otherIncomeCategoryLabels, paymentMethodLabels } from "@/lib/contracts/finance"
import { studentStatusLabels } from "@/lib/contracts/students"
import { can } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

function styleHeader(worksheet: ExcelJS.Worksheet, rowNumber = 1) {
  const header = worksheet.getRow(rowNumber)
  header.font = { bold: true, color: { argb: "FFFFFFFF" } }
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFA52427" }
  }
  header.alignment = { vertical: "middle" }
}

function addWorksheetBranding(worksheet: ExcelJS.Worksheet, title: string, logoImageId: number) {
  worksheet.spliceRows(1, 0, [], [], [])
  worksheet.mergeCells("A1:C3")
  worksheet.addImage(logoImageId, {
    tl: { col: 0.15, row: 0.15 },
    ext: { width: 170, height: 91 }
  })
  worksheet.mergeCells("D1:H1")
  worksheet.mergeCells("D2:H2")
  worksheet.mergeCells("D3:H3")
  worksheet.getCell("D1").value = "Kid Seeds Hub"
  worksheet.getCell("D2").value = title
  worksheet.getCell("D3").value = "Trung tâm Hạt Giống Nhỏ"
  worksheet.getCell("D1").font = { bold: true, size: 18, color: { argb: "FFA52427" } }
  worksheet.getCell("D2").font = { bold: true, size: 13, color: { argb: "FF1C1917" } }
  worksheet.getCell("D3").font = { italic: true, size: 11, color: { argb: "FF78716C" } }
  worksheet.getRow(1).height = 28
  worksheet.getRow(2).height = 22
  worksheet.getRow(3).height = 20
  worksheet.views = [{ state: "frozen", ySplit: 4 }]
  styleHeader(worksheet, 4)
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

  const [students, receipts, otherIncomeReceipts, expenses] = await prisma.$transaction([
    prisma.student.findMany({
      include: {
        parent: { include: { user: true } },
        assignedTeacher: true,
        enrollments: { include: { course: true } },
        classStudents: { include: { class: true } }
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
	        },
	        lines: { orderBy: { createdAt: "asc" } },
	        extraLines: { orderBy: { createdAt: "asc" } }
	      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.otherIncomeReceipt.findMany({
      include: { createdBy: true },
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
  const logoImageId = workbook.addImage({
    filename: join(process.cwd(), "public/brand/kid-seeds-hub-logo-print.png"),
    extension: "png"
  })

  const studentsSheet = workbook.addWorksheet("Students")
  studentsSheet.columns = [
    { header: "Student ID", key: "id", width: 28 },
    { header: "Student Code", key: "code", width: 16 },
    { header: "Student Name", key: "name", width: 24 },
    { header: "Data Source", key: "dataSource", width: 16 },
    { header: "Status", key: "status", width: 16 },
    { header: "Parent Name", key: "parentName", width: 24 },
    { header: "Parent Phone", key: "parentPhone", width: 18 },
    { header: "Parent Email", key: "parentEmail", width: 28 },
    { header: "Address", key: "address", width: 32 },
    { header: "Lead Source", key: "leadSource", width: 18 },
    { header: "Assigned Teacher", key: "teacher", width: 22 },
    { header: "Class Codes", key: "classCodes", width: 36 },
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
      dataSource: student.code.startsWith("HV-") ? "Real import" : "Demo/seed",
      status: studentStatusLabels[student.status],
      parentName: student.parent.user.name,
      parentPhone: student.parent.user.phone,
      parentEmail: student.parent.user.email ?? "",
      address: student.address ?? "",
      leadSource: student.leadSource ?? "",
      teacher: student.assignedTeacher?.name ?? "",
      classCodes: student.classStudents.map((classStudent) => classStudent.class.code ?? classStudent.class.name).join(", "),
      courses: activeEnrollments.map((enrollment) => enrollment.course.name).join(", "),
      sessionsBought,
      sessionsUsed,
      sessionsRemaining: Math.max(0, sessionsBought - sessionsUsed),
      healthNote: student.healthNote ?? ""
    })
  })
  addWorksheetBranding(studentsSheet, "Students Finance Export - Học viên", logoImageId)

  const receiptsSheet = workbook.addWorksheet("Receipts")
  receiptsSheet.columns = [
    { header: "Receipt Code", key: "code", width: 18 },
    { header: "Date", key: "date", width: 14 },
    { header: "Student Code", key: "studentCode", width: 16 },
    { header: "Student Name", key: "studentName", width: 24 },
    { header: "Parent Name", key: "parentName", width: 24 },
	    { header: "Parent Phone", key: "parentPhone", width: 18 },
	    { header: "Course", key: "course", width: 28 },
	    { header: "Billing Period", key: "billingPeriod", width: 22 },
	    { header: "Amount", key: "amount", width: 16 },
	    { header: "Line Amount", key: "lineAmount", width: 16 },
	    { header: "Wallet Credit", key: "walletCredit", width: 16 },
	    { header: "Sessions", key: "sessions", width: 12 },
	    { header: "Extra Lines", key: "extraLines", width: 36 },
	    { header: "Method", key: "method", width: 18 },
	    { header: "Created By", key: "createdBy", width: 22 },
	    { header: "Note", key: "note", width: 32 }
	  ]
	  receipts.forEach((receipt) => {
	    const extraLineSummary = receipt.extraLines.map((line) => `${line.type}: ${line.description} - ${line.amount.toString()}`).join("; ")
	    const lines = receipt.lines.length ? receipt.lines : [{
	      courseName: receipt.enrollment.course.name,
	      billingLabel: null,
	      amount: receipt.amount,
	      billableSessions: receipt.sessions
	    }]

	    lines.forEach((line) => {
	      receiptsSheet.addRow({
	        code: receipt.code,
	        date: formatDate(receipt.createdAt),
	        studentCode: receipt.enrollment.student.code,
	        studentName: receipt.enrollment.student.name,
	        parentName: receipt.enrollment.student.parent.user.name,
	        parentPhone: receipt.enrollment.student.parent.user.phone,
	        course: line.courseName,
	        billingPeriod: line.billingLabel ?? "",
	        amount: Number(receipt.amount.toString()),
	        lineAmount: Number(line.amount.toString()),
	        walletCredit: Number(receipt.walletCreditAmount.toString()),
	        sessions: line.billableSessions,
	        extraLines: extraLineSummary,
	        method: paymentMethodLabels[receipt.method],
	        createdBy: receipt.createdBy.name,
	        note: receipt.note ?? ""
	      })
	    })
	  })
	  receiptsSheet.getColumn("amount").numFmt = "#,##0"
	  receiptsSheet.getColumn("lineAmount").numFmt = "#,##0"
	  receiptsSheet.getColumn("walletCredit").numFmt = "#,##0"
  addWorksheetBranding(receiptsSheet, "Students Finance Export - Phiếu thu", logoImageId)

  const otherIncomeSheet = workbook.addWorksheet("Other Income")
  otherIncomeSheet.columns = [
    { header: "Receipt Code", key: "code", width: 18 },
    { header: "Date", key: "date", width: 14 },
    { header: "Category", key: "category", width: 24 },
    { header: "Payer", key: "payer", width: 24 },
    { header: "Payer Phone", key: "payerPhone", width: 18 },
    { header: "Description", key: "description", width: 36 },
    { header: "Amount", key: "amount", width: 16 },
    { header: "Method", key: "method", width: 18 },
    { header: "Created By", key: "createdBy", width: 22 },
    { header: "Note", key: "note", width: 32 }
  ]
  otherIncomeReceipts.forEach((receipt) => {
    otherIncomeSheet.addRow({
      code: receipt.code,
      date: formatDate(receipt.createdAt),
      category: otherIncomeCategoryLabels[receipt.category],
      payer: receipt.payerName,
      payerPhone: receipt.payerPhone ?? "",
      description: receipt.description,
      amount: Number(receipt.amount.toString()),
      method: paymentMethodLabels[receipt.method],
      createdBy: receipt.createdBy.name,
      note: receipt.note ?? ""
    })
  })
  otherIncomeSheet.getColumn("amount").numFmt = "#,##0"
  addWorksheetBranding(otherIncomeSheet, "Students Finance Export - Phiếu thu khác", logoImageId)

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
  addWorksheetBranding(expensesSheet, "Students Finance Export - Phiếu chi", logoImageId)

  const buffer = await workbook.xlsx.writeBuffer()
  const fileName = `kidseedshub-students-finance-${new Date().toISOString().slice(0, 10)}.xlsx`

  return new Response(buffer, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${fileName}"`
    }
  })
}
