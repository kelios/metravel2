// __tests__/trips/tripDateGovernance.test.ts
// Regression control для #1313: дата поездки интерпретируется ровно в одном месте.
//
// Дефект был не в конкретной строке, а в том, что три модуля независимо разбирали
// одно значение и при несовпадении возвращали вход как есть. Этот тест падает,
// когда в домене trips появляется второй разборщик — и называет файл и строку.
//
// Что именно запрещено вне `utils/tripDateTime.ts`:
//   1) регулярка с капчурящими группами по датам — это извлечение частей, разбор;
//   2) `new Date(...)` от поля старта/конца поездки;
//   3) ручное срезание даты из ISO (`split('T')`, `slice(0, 10)`).
// Анкерная проверка формы пользовательского ввода `/^\d{4}-\d{2}-\d{2}$/` без групп
// разбором не является и остаётся в формах.

import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..')
const OWNER = 'utils/tripDateTime.ts'

const SCANNED_DIRS = ['components/trips', 'app/(tabs)/trips']
const SCANNED_FILES = [
  'api/plannedTripsNormalizers.ts',
  'api/plannedTripsRequests.ts',
  'api/publicTrips.ts',
  'utils/tripPlanLinks.ts',
]

const TRIP_DATE_FIELD = /\b(startDate|endDate|start_date|end_date|start_at|end_at|startTime)\b/

const FORBIDDEN: Array<{ id: string; test: (line: string) => boolean }> = [
  {
    id: 'capturing date regex (a second parser)',
    test: (line) => /\(\\d\{4\}\)|\(\\d\{2\}\)/.test(line),
  },
  {
    id: 'Date built from a trip date field',
    test: (line) => /new Date\(/.test(line) && TRIP_DATE_FIELD.test(line),
  },
  {
    id: 'manual ISO slicing of a trip date',
    test: (line) => /\.split\(['"]T['"]\)|\.slice\(0,\s*10\)/.test(line),
  },
]

const collect = (relativeDir: string): string[] => {
  const absolute = join(ROOT, relativeDir)
  const entries = readdirSync(absolute, { withFileTypes: true })
  return entries.flatMap((entry) => {
    const relative = `${relativeDir}/${entry.name}`
    if (entry.isDirectory()) return collect(relative)
    return /\.tsx?$/.test(entry.name) ? [relative] : []
  })
}

describe('trips date interpretation stays in one module', () => {
  const files = [...SCANNED_DIRS.flatMap(collect), ...SCANNED_FILES]

  it('scans a non-empty trips surface', () => {
    expect(files.length).toBeGreaterThan(20)
    expect(statSync(join(ROOT, OWNER)).isFile()).toBe(true)
  })

  it('has no second trips date parser outside the owning module', () => {
    const violations: string[] = []

    for (const file of files) {
      const lines = readFileSync(join(ROOT, file), 'utf8').split('\n')
      lines.forEach((line, index) => {
        if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) return
        for (const rule of FORBIDDEN) {
          if (rule.test(line)) {
            violations.push(`${file}:${index + 1} — ${rule.id}\n    ${line.trim()}`)
          }
        }
      })
    }

    expect(violations.join('\n')).toBe('')
  })

  it('keeps the owning module able to interpret both accepted shapes', async () => {
    // Поведенческая проверка, а не привязка к тексту регулярки: переписать
    // разбор на именованные группы можно, потерять контракт — нет.
    const { parseTripDateTime } = await import('@/utils/tripDateTime')
    expect(parseTripDateTime('2026-10-12')).toMatchObject({ date: '2026-10-12', hasTime: false })
    expect(parseTripDateTime('2026-10-12T09:00:00Z')).toMatchObject({ hasTime: true })
  })
})
