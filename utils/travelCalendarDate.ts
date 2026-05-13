const MONTHS_BY_NAME: Record<string, number> = {
  january: 1,
  jan: 1,
  январь: 1,
  января: 1,
  february: 2,
  feb: 2,
  февраль: 2,
  февраля: 2,
  march: 3,
  mar: 3,
  март: 3,
  марта: 3,
  april: 4,
  apr: 4,
  апрель: 4,
  апреля: 4,
  may: 5,
  май: 5,
  мая: 5,
  june: 6,
  jun: 6,
  июнь: 6,
  июня: 6,
  july: 7,
  jul: 7,
  июль: 7,
  июля: 7,
  august: 8,
  aug: 8,
  август: 8,
  августа: 8,
  september: 9,
  sep: 9,
  сентябрь: 9,
  сентября: 9,
  october: 10,
  oct: 10,
  октябрь: 10,
  октября: 10,
  november: 11,
  nov: 11,
  ноябрь: 11,
  ноября: 11,
  december: 12,
  dec: 12,
  декабрь: 12,
  декабря: 12,
}

const normalizeYear = (value: unknown): number | null => {
  const year = typeof value === 'number' ? value : Number(String(value ?? '').trim())
  if (!Number.isInteger(year) || year < 1900 || year > 2200) return null
  return year
}

const getSeedIndex = (seed: unknown, length: number): number => {
  if (length <= 0) return 0
  const raw = String(seed ?? '')
  if (!raw) return 0
  let hash = 0
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 31 + raw.charCodeAt(i)) >>> 0
  }
  return hash % length
}

const rotateDays = (days: number[], seed: unknown): number[] => {
  if (days.length <= 1) return days
  const startIndex = getSeedIndex(seed, days.length)
  return [...days.slice(startIndex), ...days.slice(0, startIndex)]
}

const getCandidateDays = (year: number, month: number, seed: unknown): number[] => {
  const daysInMonth = new Date(year, month, 0).getDate()
  const weekendDays: number[] = []
  const otherDays: number[] = []

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dayOfWeek = new Date(year, month - 1, day).getDay()
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      weekendDays.push(day)
    } else {
      otherDays.push(day)
    }
  }

  return [...rotateDays(weekendDays, seed), ...rotateDays(otherDays, seed)]
}

const formatIsoDate = (year: number, month: number, day: number): string =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

export const resolveTravelMonthNumber = (value: unknown): number | null => {
  const rawValue = Array.isArray(value) ? value[0] : value
  if (rawValue == null) return null

  if (typeof rawValue === 'object') {
    const record = rawValue as Record<string, unknown>
    return resolveTravelMonthNumber(record.id ?? record.value ?? record.name ?? record.title)
  }

  const raw = String(rawValue).trim()
  if (!raw) return null

  const numeric = Number(raw)
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 12) {
    return numeric
  }

  const normalized = raw
    .toLowerCase()
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ')

  return MONTHS_BY_NAME[normalized] ?? null
}

export const buildTravelMonthFallbackDate = ({
  year,
  month,
  monthName,
  seed,
  occupiedDates,
}: {
  year?: unknown
  month?: unknown
  monthName?: unknown
  seed?: unknown
  occupiedDates?: Set<string> | string[]
}): string | undefined => {
  const normalizedYear = normalizeYear(year)
  const normalizedMonth = resolveTravelMonthNumber(month ?? monthName)
  if (!normalizedYear || !normalizedMonth) return undefined

  const candidates = getCandidateDays(normalizedYear, normalizedMonth, seed)
  const occupied = occupiedDates instanceof Set
    ? occupiedDates
    : new Set(Array.isArray(occupiedDates) ? occupiedDates : [])

  for (let offset = 0; offset < candidates.length; offset += 1) {
    const day = candidates[offset]
    const date = formatIsoDate(normalizedYear, normalizedMonth, day)
    if (!occupied.has(date)) return date
  }

  return formatIsoDate(normalizedYear, normalizedMonth, candidates[0] ?? 1)
}
