// #3202: постоянный контроль рубежа. Случайные строки из HTML-значимых кусков проходят
// toInertHtml и полный путь статьи; результат разбирается настоящим парсером (jsdom/parse5).
// Генератор детерминированный: падение воспроизводится по номеру случая.

import { toInertHtml } from '@/utils/inertHtml'
import { prepareStableContentHtml } from '@/components/travel/stableContent/htmlTransform'

// Детерминированный генератор (mulberry32).
const rng = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const FRAGMENTS = [
  '<', '>', '</', '/>', '"', "'", '=', ' ', '\t', '\n', '/', '&', ';', '`', '\u0000', '\\',
  '<img', '<p', '<a', '<figure', '<iframe', '<script', '<style', '<svg', '<math', '<noscript', '<textarea',
  '<title', '<template', '<xmp', '<plaintext', '<table', '<select', '<form', '<details', '<video', '<source',
  '</iframe>', '</script>', '</style>', '</svg>', '</p>', '</a>', '</figure>', '</textarea>', '</title>',
  '</noscript>', '</template>', '</math>', '</xmp>', '</table>', '</select>',
  '<!--', '-->', '--!>', '<!', '<?', '<![CDATA[', ']]>',
  ' src=', ' href=', ' alt=', ' class=', ' title=', ' style=', ' srcset=', ' width=', ' id=', ' data-x=',
  ' onerror=alert(1)', ' onload=alert(1)', ' ONCLICK=alert(1)', '/onerror=alert(1)', ' onmouseover="alert(1)"',
  ' srcdoc="<img src=x onerror=alert(1)>"', ' formaction=javascript:alert(1)',
  'javascript:alert(1)', 'java&#115;cript:alert(1)', 'jav&#x09;ascript:alert(1)', 'javascript&colon;alert(1)',
  'data:text/html,<script>alert(1)</script>', 'https://x.invalid/a.jpg', 'https://www.youtube.com/embed/x',
  'x', 'abc', '800', '&quot;', '&lt;', '&gt;', '&amp;', '&#34;', '&#x3c;', '&nbsp;', 'src="', 'class="', 'style="',
]
const BAD_TAGS = new Set(['SCRIPT', 'STYLE', 'OBJECT', 'EMBED', 'BASE', 'LINK', 'META', 'SVG', 'MATH', 'TEXTAREA', 'TITLE', 'NOSCRIPT', 'TEMPLATE', 'XMP', 'PLAINTEXT', 'NOEMBED', 'NOFRAMES', 'FRAME', 'FRAMESET'])
const URL_ATTRS = ['href', 'src', 'action', 'formaction', 'poster', 'xlink:href', 'data', 'background']

// Браузер перед разбором схемы отбрасывает ведущие пробелы и управляющие символы,
// а табы и переводы строк — в любом месте URL.
const urlForSchemeCheck = (value: string): string => {
  const compact = value.split('').filter((ch) => ch !== '\t' && ch !== '\n' && ch !== '\r').join('')
  let start = 0
  while (start < compact.length && compact.charCodeAt(start) <= 0x20) start += 1
  return compact.slice(start)
}

const violations = (html: string): string[] => {
  const host = document.createElement('div')
  host.innerHTML = html
  const out: string[] = []
  for (const el of Array.from(host.querySelectorAll('*'))) {
    const tag = el.tagName.toUpperCase()
    if (BAD_TAGS.has(tag)) out.push(`tag:${tag}`)
    if (tag === 'IFRAME' && !/^https?:\/\/(www\.)?(youtube(-nocookie)?\.com|youtu\.be|player\.vimeo\.com|instagram\.com|google\.com)\//i.test(el.getAttribute('src') || '')) out.push('iframe:' + el.getAttribute('src'))
    if (tag === 'IFRAME' && (el.textContent || '') !== '') out.push('iframe-content')
    for (const a of Array.from(el.attributes)) {
      if (/^on/i.test(a.name) || a.name.toLowerCase() === 'srcdoc') out.push(`attr:${tag}[${a.name}]`)
      if (URL_ATTRS.includes(a.name.toLowerCase()) && /^(javascript|vbscript):/i.test(urlForSchemeCheck(a.value))) out.push(`url:${tag}[${a.name}=${a.value.slice(0, 40)}]`)
      if (URL_ATTRS.includes(a.name.toLowerCase()) && /^\s*data:(?!image\/)/i.test(a.value)) out.push(`dataurl:${tag}[${a.name}]`)
    }
  }
  return out
}

const gen = (r: () => number) => {
  const n = 1 + Math.floor(r() * 28)
  let s = ''
  for (let i = 0; i < n; i++) s += FRAGMENTS[Math.floor(r() * FRAGMENTS.length)]
  return s
}

test('toInertHtml: случайный перебор против parse5 (jsdom)', () => {
  const r = rng(20261109)
  const N = 8000
  const bad: string[] = []
  let nonIdempotent = 0
  for (let i = 0; i < N && bad.length < 5; i++) {
    const input = gen(r)
    const out = toInertHtml(input)
    const v = violations(out)
    if (v.length) bad.push(`${JSON.stringify(input)} => ${JSON.stringify(out)} :: ${v.join(',')}`)
    if (i < 2000 && toInertHtml(out) !== out) nonIdempotent++
  }
  expect(bad).toEqual([])
  expect(nonIdempotent).toBe(0)
})

test('полный путь prepareStableContentHtml → toInertHtml: случайный перебор', () => {
  const r = rng(3202)
  const N = 500
  const bad: string[] = []
  let threw = 0
  for (let i = 0; i < N && bad.length < 5; i++) {
    const input = gen(r)
    for (const serverSanitized of [true, false]) {
      let out = ''
      try { out = toInertHtml(String(prepareStableContentHtml(input, { serverSanitized } as any))) } catch { threw++; continue }
      const v = violations(out)
      if (v.length) bad.push(`[server=${serverSanitized}] ${JSON.stringify(input)} => ${JSON.stringify(out)} :: ${v.join(',')}`)
    }
  }
  expect(bad).toEqual([])
  expect(threw).toBe(0)
})
