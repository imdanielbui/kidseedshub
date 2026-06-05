export type LeadSourceRecord = {
  leadSource: string | null
}

export function normalizeLeadSourceOptions(records: LeadSourceRecord[]) {
  const sourcesByKey = new Map<string, string>()

  for (const record of records) {
    const source = record.leadSource?.trim()

    if (!source) continue

    const key = source.toLocaleLowerCase("vi-VN")

    if (!sourcesByKey.has(key)) {
      sourcesByKey.set(key, source)
    }
  }

  return Array.from(sourcesByKey.values()).sort((first, second) => first.localeCompare(second, "vi-VN"))
}
