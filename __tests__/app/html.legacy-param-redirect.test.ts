import fs from 'fs'
import path from 'path'

// Извлекает реальный IIFE редиректа из app/+html.tsx, чтобы тест гонял
// отгружаемый код, а не его копию.
function loadRedirectScript(): string {
  const source = fs.readFileSync(path.resolve(process.cwd(), 'app/+html.tsx'), 'utf8')
  const marker = 'const getLegacyParamRedirectScript = () => String.raw`'
  const start = source.indexOf(marker)
  expect(start).toBeGreaterThan(-1)
  const bodyStart = start + marker.length
  const end = source.indexOf('`', bodyStart) // IIFE не содержит обратных кавычек
  expect(end).toBeGreaterThan(bodyStart)
  return source.slice(bodyStart, end)
}

function runOn(pathname: string, search: string): string | null {
  let replacedWith: string | null = null
  const win: any = {
    location: {
      pathname,
      search,
      replace: (target: string) => {
        replacedWith = target
      },
    },
  }
  new Function('window', 'URLSearchParams', loadRedirectScript())(win, URLSearchParams)
  return replacedWith
}

describe('+html legacy ?param= redirect', () => {
  it('still forwards a real slug to the travel page', () => {
    expect(runOn('/', '?param=grodno')).toBe('/travels/grodno')
    expect(runOn('/index', '?param=77')).toBe('/travels/77')
  })

  // #1185: прод показывал 5 переходов на /travels/null и 3 на /travels/mock.
  // Литерал пустоты — не slug, и уводить с главной на 404 из-за него нельзя.
  it.each(['null', 'undefined', 'NaN', 'none', 'false', '0', 'NULL', 'Undefined'])(
    'stays on the home page for the empty-literal %p',
    (value) => {
      expect(runOn('/', `?param=${value}`)).toBeNull()
    },
  )

  // #1438: этот IIFE уходит в HTML каждой страницы как есть, вместе с
  // комментариями. Пока в нём стояли примеры `/travels/null` и
  // `/travels/undefined`, любой скрапер, вытаскивающий адреса регуляркой из
  // сырого HTML, находил на здоровой статье ссылку в 404.
  it('never ships a literal travel path with an empty-literal segment', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'app/+html.tsx'), 'utf8')
    // Только inline-скрипты: обычные комментарии модуля бандлер вырезает, а
    // содержимое `String.raw` уходит в разметку дословно.
    const inlineScripts = [...source.matchAll(/String\.raw`([\s\S]*?)`/g)].map((m) => m[1])
    expect(inlineScripts.length).toBeGreaterThan(0)

    for (const script of inlineScripts) {
      expect(script).not.toMatch(/\/travels\/(null|undefined|nan|none|false)\b/i)
    }
  })

  it('ignores malformed values and other routes, as before', () => {
    expect(runOn('/', '?param=a/b')).toBeNull()
    expect(runOn('/', '?param=')).toBeNull()
    expect(runOn('/', '')).toBeNull()
    expect(runOn('/travels/grodno', '?param=grodno')).toBeNull()
  })
})
