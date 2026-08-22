import fs from 'fs'
import path from 'path'

function loadPreviewBootstrapScript(): string {
  const source = fs.readFileSync(path.resolve(process.cwd(), 'app/+html.tsx'), 'utf8')
  const marker = 'const getAuthorTravelPreviewBootstrapScript = () => String.raw`'
  const start = source.indexOf(marker)
  expect(start).toBeGreaterThan(-1)
  const bodyStart = start + marker.length
  const end = source.indexOf('`', bodyStart)
  expect(end).toBeGreaterThan(bodyStart)
  return source.slice(bodyStart, end)
}

function runOn(pathname: string, search: string): string | null {
  let replacedWith: string | null = null
  const win: any = {
    location: { pathname, search },
    history: {
      replaceState: (_state: unknown, _title: string, target: string) => {
        replacedWith = target
      },
    },
  }

  new Function('window', 'URLSearchParams', loadPreviewBootstrapScript())(win, URLSearchParams)
  return replacedWith
}

describe('+html author travel preview bootstrap', () => {
  it('boots a saved draft detail by numeric id without a document navigation', () => {
    expect(runOn('/travel/new', '?previewTravel=7100')).toBe('/travels/7100')
    expect(runOn('/travel/new', '?previewTravel=42')).toBe('/travels/42')
  })

  it.each([
    '?previewTravel=',
    '?previewTravel=0',
    '?previewTravel=-1',
    '?previewTravel=slug',
    '?previewTravel=1%2F2',
  ])('ignores an invalid bridge value: %s', (search) => {
    expect(runOn('/travel/new', search)).toBeNull()
  })

  it('does not rewrite other document routes', () => {
    expect(runOn('/', '?previewTravel=7100')).toBeNull()
    expect(runOn('/travel/7100', '?previewTravel=7100')).toBeNull()
    expect(runOn('/travels/7100', '?previewTravel=7100')).toBeNull()
  })
})
