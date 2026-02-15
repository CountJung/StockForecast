const RANGE_DAYS: Record<string, number | null> = {
  '1m': 31,
  '3m': 93,
  '6m': 186,
  '1y': 366,
  '2y': 365 * 2 + 1,
  '5y': 365 * 5 + 1,
  max: null
}

export function isValidRange(value: string): value is keyof typeof RANGE_DAYS {
  return Object.prototype.hasOwnProperty.call(RANGE_DAYS, value)
}

export function cutoffDate(range: keyof typeof RANGE_DAYS): Date | null {
  const days = RANGE_DAYS[range]
  if (days === null) {
    return null
  }

  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  return date
}
