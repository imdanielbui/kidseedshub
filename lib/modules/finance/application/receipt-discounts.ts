import { Prisma } from "@prisma/client"

function parseDiscountInput(input: string | undefined) {
  const raw = input?.trim() ?? ""
  if (!raw) {
    return {
      discountAmount: new Prisma.Decimal(0),
      discountPercent: new Prisma.Decimal(0)
    }
  }

  if (raw.includes("%")) {
    const percent = Number(raw.replace("%", "").replace(",", ".").replace(/[^\d.-]/g, "").trim())
    return {
      discountAmount: new Prisma.Decimal(0),
      discountPercent: new Prisma.Decimal(Number.isFinite(percent) ? Math.min(Math.max(percent, 0), 100) : 0)
    }
  }

  const amount = Number(raw.replace(/[^\d]/g, ""))
  if (Number.isFinite(amount) && amount <= 100) {
    return {
      discountAmount: new Prisma.Decimal(0),
      discountPercent: new Prisma.Decimal(Math.max(amount, 0))
    }
  }

  return {
    discountAmount: new Prisma.Decimal(Number.isFinite(amount) ? Math.max(amount, 0) : 0),
    discountPercent: new Prisma.Decimal(0)
  }
}

export function combineDiscountInputs(inputs: Array<string | undefined>) {
  return inputs.reduce(
    (total, input) => {
      const parsed = parseDiscountInput(input)
      const nextPercent = total.discountPercent.plus(parsed.discountPercent)
      return {
        discountAmount: total.discountAmount.plus(parsed.discountAmount),
        discountPercent: nextPercent.greaterThan(100) ? new Prisma.Decimal(100) : nextPercent
      }
    },
    {
      discountAmount: new Prisma.Decimal(0),
      discountPercent: new Prisma.Decimal(0)
    }
  )
}
