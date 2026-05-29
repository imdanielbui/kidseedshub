export function parseMonth(month: string) {
  const [year, monthIndex] = month.split("-").map(Number)
  const start = new Date(Date.UTC(year, monthIndex - 1, 1))
  const end = new Date(Date.UTC(year, monthIndex, 1))

  return { start, end }
}

export function todayRange(baseDate = new Date()) {
  const start = new Date(baseDate)
  start.setHours(0, 0, 0, 0)

  const end = new Date(baseDate)
  end.setHours(23, 59, 59, 999)

  return { start, end }
}
