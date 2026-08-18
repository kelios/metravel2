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
  // Все файлы, чьи строки уходят в разметку шелла через
  // `dangerouslySetInnerHTML`. Проверяем их целиком, а не только блоки
  // `String.raw`: инлайн-скрипты собираются и обычными template literal'ами
  // (`+html.tsx`, LCP decode helper), и соседними модулями-билдерами.
  const INLINE_SCRIPT_SOURCES = [
    'app/+html.tsx',
    'utils/htmlShell.ts',
    'utils/mapHeadBootstrap.ts',
    'utils/analyticsInlineScript.ts',
  ]

  it.each(INLINE_SCRIPT_SOURCES)(
    '%s never spells out a travel path with an empty-literal segment',
    (relativePath) => {
      const source = fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')

      // Правило намеренно строгое: содержимое этих файлов приезжает в HTML
      // каждой страницы вместе с комментариями, а скраперы вытаскивают адреса
      // регуляркой из сырого HTML и уходят по ним в 404. Описывай проблему
      // словами, не примером адреса.
      expect(source).not.toMatch(/\/travels\/(null|undefined|nan|none|false|0)\b/i)
    },
  )

  it('ignores malformed values and other routes, as before', () => {
    expect(runOn('/', '?param=a/b')).toBeNull()
    expect(runOn('/', '?param=')).toBeNull()
    expect(runOn('/', '')).toBeNull()
    expect(runOn('/travels/grodno', '?param=grodno')).toBeNull()
  })
})
