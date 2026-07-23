export function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(value))
}

export function formatAge(birthDateValue?: string, referenceDate = new Date()) {
  if (!birthDateValue) return "Chưa có ngày sinh"

  const birthDate = new Date(`${birthDateValue.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(birthDate.getTime()) || birthDate > referenceDate) return "Ngày sinh không hợp lệ"

  let totalMonths = (referenceDate.getFullYear() - birthDate.getFullYear()) * 12 + referenceDate.getMonth() - birthDate.getMonth()
  if (referenceDate.getDate() < birthDate.getDate()) totalMonths -= 1

  const years = Math.floor(totalMonths / 12)
  const months = totalMonths % 12

  return years > 0 ? `${years} tuổi ${months} tháng` : `${months} tháng`
}

export function formatWeekday(weekday: number) {
  return weekday === 0 ? "Chủ nhật" : `Thứ ${weekday + 1}`
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 0,
    style: "currency",
    currency: "VND"
  }).format(Number.isFinite(value) ? value : 0)
}
