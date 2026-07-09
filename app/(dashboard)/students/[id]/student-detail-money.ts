function formatCurrencyLabel(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 0,
    style: "currency",
    currency: "VND"
  }).format(Number.isFinite(value) ? value : 0)
}

export function parseMoneyInput(value: string) {
  const parsed = Number(value.replace(/[^\d]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

export function formatMoneyInput(value: string | number) {
  const digits = String(value).replace(/[^\d]/g, "")
  return digits ? new Intl.NumberFormat("vi-VN").format(Number(digits)) : ""
}

export function parseDiscountInput(value: string, grossAmount: number) {
  const raw = value.trim()
  if (!raw) return { discountAmount: 0, discountPercent: 0, totalDiscount: 0, label: "Không giảm" }

  if (raw.includes("%")) {
    const percent = Number(raw.replace("%", "").replace(",", ".").replace(/[^\d.-]/g, "").trim())
    const discountPercent = Number.isFinite(percent) ? Math.min(Math.max(percent, 0), 100) : 0
    const totalDiscount = grossAmount * discountPercent / 100
    return { discountAmount: 0, discountPercent, totalDiscount, label: `Giảm ${discountPercent}% = ${formatCurrencyLabel(totalDiscount)}` }
  }

  const numericValue = parseMoneyInput(raw)
  if (numericValue <= 100) {
    const totalDiscount = grossAmount * numericValue / 100
    return { discountAmount: 0, discountPercent: numericValue, totalDiscount, label: `Giảm ${numericValue}% = ${formatCurrencyLabel(totalDiscount)}` }
  }

  const discountAmount = parseMoneyInput(raw)
  return { discountAmount, discountPercent: 0, totalDiscount: discountAmount, label: `Giảm ${formatCurrencyLabel(discountAmount)}` }
}

export function parseDiscountInputs(values: string[], grossAmount: number) {
  const parsedItems = values.map((value) => parseDiscountInput(value, grossAmount))
  const discountAmount = parsedItems.reduce((total, item) => total + item.discountAmount, 0)
  const discountPercent = Math.min(100, parsedItems.reduce((total, item) => total + item.discountPercent, 0))
  const percentDiscount = grossAmount * discountPercent / 100
  const totalDiscount = discountAmount + percentDiscount
  const labelParts = []

  if (discountPercent > 0) labelParts.push(`${discountPercent}%`)
  if (discountAmount > 0) labelParts.push(`${formatMoneyInput(Math.round(discountAmount))}đ`)

  return {
    discountAmount,
    discountPercent,
    totalDiscount,
    label: labelParts.length ? `Giảm ${labelParts.join(" + ")} = ${formatCurrencyLabel(totalDiscount)}` : "Không giảm"
  }
}

export function formatDiscountInput(value: string) {
  const raw = value.trim()
  if (!raw) return ""
  const numericValue = parseMoneyInput(raw)

  if (raw.includes("%") || numericValue <= 100) {
    return `${Math.min(Math.max(numericValue, 0), 100)}%`
  }

  return `${formatMoneyInput(numericValue)}đ`
}

export function moneySuggestions(value: string) {
  const digits = value.replace(/[^\d]/g, "")
  if (!digits || digits.length > 3) return []

  const base = Number(digits)
  if (!Number.isFinite(base) || base <= 0) return []

  return [base * 10000, base * 100000]
}
