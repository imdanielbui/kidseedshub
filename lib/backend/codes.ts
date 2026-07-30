import type { Prisma } from "@prisma/client"

type Tx = Prisma.TransactionClient

export async function nextReceiptCode(tx: Tx, date = new Date()) {
  return nextYearlyCode({
    prefix: "PT",
    year: date.getFullYear(),
    latestCode: (
      await tx.receipt.findFirst({
        where: {
          code: { startsWith: `PT-${date.getFullYear()}-` }
        },
        orderBy: { code: "desc" },
        select: { code: true }
      })
    )?.code
  })
}

export async function nextOtherIncomeReceiptCode(tx: Tx, date = new Date()) {
  return nextYearlyCode({
    prefix: "PTK",
    year: date.getFullYear(),
    latestCode: (
      await tx.otherIncomeReceipt.findFirst({
        where: {
          code: { startsWith: `PTK-${date.getFullYear()}-` }
        },
        orderBy: { code: "desc" },
        select: { code: true }
      })
    )?.code
  })
}

export async function nextExpenseCode(tx: Tx, date = new Date()) {
  return nextYearlyCode({
    prefix: "PC",
    year: date.getFullYear(),
    latestCode: (
      await tx.expense.findFirst({
        where: {
          code: { startsWith: `PC-${date.getFullYear()}-` }
        },
        orderBy: { code: "desc" },
        select: { code: true }
      })
    )?.code
  })
}

export async function nextStudentCode(tx: Tx, date = new Date()) {
  const shortYear = String(date.getFullYear()).slice(-2)
  const prefix = `KS${shortYear}`
  const latestCode = (
    await tx.student.findFirst({
      where: {
        code: { startsWith: `${prefix}-` }
      },
      orderBy: { code: "desc" },
      select: { code: true }
    })
  )?.code
  const current = latestCode?.match(/\d+$/)?.[0]
  const next = current ? Number(current) + 1 : 1

  return `${prefix}-${String(next).padStart(3, "0")}`
}

function nextYearlyCode({ prefix, year, latestCode, width = 3 }: { prefix: string; year: number; latestCode?: string; width?: number }) {
  const current = latestCode?.match(/\d+$/)?.[0]
  const next = current ? Number(current) + 1 : 1

  return `${prefix}-${year}-${String(next).padStart(width, "0")}`
}
