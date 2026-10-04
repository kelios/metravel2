import { readdirSync, readFileSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'

import { isPhoneLayout } from '@/utils/phoneLayout'

describe('isPhoneLayout (#2141)', () => {
  it('treats small phones with a known width as phones', () => {
    expect(isPhoneLayout({ width: 320, isPhone: false, isLargePhone: false })).toBe(true)
    expect(isPhoneLayout({ width: 359, isPhone: false, isLargePhone: false })).toBe(true)
  })

  it('keeps the regular phone classes', () => {
    expect(isPhoneLayout({ width: 390, isPhone: true, isLargePhone: false })).toBe(true)
    expect(isPhoneLayout({ width: 600, isPhone: false, isLargePhone: true })).toBe(true)
  })

  it('keeps the zero-width pre-hydration frame non-phone, like the old idiom', () => {
    expect(isPhoneLayout({ width: 0, isPhone: false, isLargePhone: false })).toBe(false)
  })

  it('answers like the old idiom for mocks without width', () => {
    expect(isPhoneLayout({ isPhone: true })).toBe(true)
    expect(isPhoneLayout({ isPhone: false, isLargePhone: false })).toBe(false)
  })

  it('is false from tablet up', () => {
    expect(isPhoneLayout({ width: 768, isPhone: false, isLargePhone: false })).toBe(false)
    expect(isPhoneLayout({ width: 1280, isPhone: false, isLargePhone: false })).toBe(false)
  })
})

// Идиома `isPhone || isLargePhone` теряет класс < 360 (`isSmallPhone`): на 320
// компонент рисует desktop-вид. Телефонная развилка — только через `isPhoneLayout`.
const ROOT = process.cwd()
const SOURCE_DIRS = ['app', 'components', 'context', 'hooks', 'screens', 'utils']
// `isSmallPhone || isPhone || isLargePhone` класс < 360 не теряет — не идиома.
const PHONE_IDIOM = /(?<!isSmallPhone\s*\|\|\s*)\bisPhone\s*\|\|\s*isLargePhone\b|\bisLargePhone\s*\|\|\s*isPhone\b/
const ALLOWED: Record<string, string> = {
  'utils/phoneLayout.ts': 'канонический владелец предиката',
  'components/layout/ResponsiveContainer.tsx': 'класс < 360 разобран собственной веткой isSmallPhone выше',
}

const collectSourceFiles = (directory: string): string[] => {
  let entries
  try {
    entries = readdirSync(resolve(ROOT, directory), { withFileTypes: true })
  } catch {
    return []
  }
  return entries.flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : collectSourceFiles(path)
    return ['.ts', '.tsx'].includes(extname(entry.name)) ? [relative(ROOT, resolve(ROOT, path))] : []
  })
}

describe('phone layout idiom guard (#2141)', () => {
  it('no source file branches on `isPhone || isLargePhone`', () => {
    const offenders = SOURCE_DIRS.flatMap(collectSourceFiles).filter((file) => {
      if (ALLOWED[file]) return false
      const source = readFileSync(resolve(ROOT, file), 'utf8')
      return source.split('\n').some((line) => {
        const code = line.trim()
        return !code.startsWith('//') && !code.startsWith('*') && PHONE_IDIOM.test(code)
      })
    })
    expect(offenders).toEqual([])
  })
})
