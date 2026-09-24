import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(__dirname, '../..')
const SCAN = ['app', 'components', 'screens']
const SOURCE = new Set(['.ts', '.tsx', '.js', '.jsx'])

const filesOf = (dir: string): string[] => {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '__tests__') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...filesOf(full))
    else if (SOURCE.has(entry.slice(entry.lastIndexOf('.')))) out.push(full)
  }
  return out
}

describe('StatusBar literal barStyle (#2095)', () => {
  it('allows a literal barStyle only in the root layout', () => {
    const hits: string[] = []
    for (const dir of SCAN) {
      for (const file of filesOf(join(ROOT, dir))) {
        const rel = relative(ROOT, file)
        if (rel === 'app/_layout.tsx') continue
        const text = readFileSync(file, 'utf8')
        if (/<StatusBar[\s\S]{0,200}barStyle\s*=\s*["']/.test(text)) hits.push(rel)
      }
    }
    expect(hits).toEqual([])
  })
})
