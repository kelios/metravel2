import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SCAN_DIRS = ['app', 'screens', 'components']
const ALLOWED_FILES = new Set(['app/+html.tsx'])
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx'])
const IGNORED_DIR_NAMES = new Set(['node_modules', '__tests__', 'dist', '.git'])

const SCRIPT_DANGEROUS_HTML = /<script\b[\s\S]{0,500}?dangerouslySetInnerHTML/

const HEAD_CONTEXT = /expo-router\/head|additionalTags|<Head\b|LazyInstantSEO|InstantSEO/

export const findDangerousHelmetScripts = (content: string): number[] => {
  const lines: number[] = []
  const source = String(content || '')
  if (!HEAD_CONTEXT.test(source) && !SCRIPT_DANGEROUS_HTML.test(source)) return lines
  SCRIPT_DANGEROUS_HTML.lastIndex = 0
  let match: RegExpExecArray | null
  const regex = new RegExp(SCRIPT_DANGEROUS_HTML.source, 'g')
  while ((match = regex.exec(source))) {
    const before = source.slice(0, match.index)
    lines.push(before.split('\n').length)
  }
  return lines
}

const collectSourceFiles = (dir: string, acc: string[] = []): string[] => {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name)
    const relative = path.relative(ROOT, absolute).replace(/\\/g, '/')
    if (entry.isDirectory()) {
      if (IGNORED_DIR_NAMES.has(entry.name) || entry.name.startsWith('.')) continue
      collectSourceFiles(absolute, acc)
      continue
    }
    if (!entry.isFile()) continue
    if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) continue
    if (ALLOWED_FILES.has(relative)) continue
    acc.push(relative)
  }
  return acc
}

describe('JSON-LD Helmet script guard (#1967)', () => {
  it('flags dangerouslySetInnerHTML on script inside Head/additionalTags', () => {
    const bad = `
      import Head from 'expo-router/head'
      export default function Page() {
        return (
          <Head>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: '{}' }} />
          </Head>
        )
      }
    `
    expect(findDangerousHelmetScripts(bad)).toEqual([6])

    const good = `
      import Head from 'expo-router/head'
      return <Head>{jsonLdScript(data)}</Head>
    `
    expect(findDangerousHelmetScripts(good)).toEqual([])
  })

  it('fails the repo if a Head/additionalTags script still uses dangerouslySetInnerHTML', () => {
    const violations: Array<{ file: string; line: number }> = []
    for (const dir of SCAN_DIRS) {
      const abs = path.join(ROOT, dir)
      if (!fs.existsSync(abs)) continue
      for (const file of collectSourceFiles(abs)) {
        const content = fs.readFileSync(path.join(ROOT, file), 'utf8')
        if (!HEAD_CONTEXT.test(content)) continue
        for (const line of findDangerousHelmetScripts(content)) {
          violations.push({ file, line })
        }
      }
    }

    expect(violations).toEqual([])
  })
})
