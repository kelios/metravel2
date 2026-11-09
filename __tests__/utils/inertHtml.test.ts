/**
 * @jest-environment jsdom
 */

jest.mock('react-native', () => ({ Platform: { OS: 'web' }, Dimensions: { get: () => ({ width: 0 }) } }))

import { prepareStableContentHtml } from '@/components/travel/stableContent/htmlTransform'
import { rewriteStartTags, tokenizeHtml } from '@/utils/htmlTokens'
import { toInertHtml } from '@/utils/inertHtml'
import { guardServerSafeHtml } from '@/utils/serverSafeHtml'

const parse = (html: string) => {
  const host = document.createElement('div')
  host.innerHTML = html
  return host
}

const executableAttributes = (html: string) =>
  Array.from(parse(html).querySelectorAll('*')).flatMap((el) =>
    Array.from(el.attributes)
      .filter((attr) => attr.name.toLowerCase().startsWith('on'))
      .map((attr) => `${el.tagName}[${attr.name}]`))

describe('htmlTokens (#3202)', () => {
  it('reads attributes by the tag grammar: quotes hide `src=`, `>` and `/onerror`', () => {
    const [tag] = tokenizeHtml('<img alt="x src=" class="a b/onerror=alert(1) c" src="https://x/a.jpg">')
    expect(tag).toMatchObject({
      kind: 'start',
      name: 'img',
      attrs: [
        { name: 'alt', value: 'x src=' },
        { name: 'class', value: 'a b/onerror=alert(1) c' },
        { name: 'src', value: 'https://x/a.jpg' },
      ],
    })
    const [p] = tokenizeHtml('<p title="a>b"/onclick=x data-x=y>')
    expect(p).toMatchObject({ name: 'p', attrs: [{ name: 'title', value: 'a>b' }, { name: 'onclick', value: 'x' }, { name: 'data-x', value: 'y' }] })
  })

  it('treats raw-text element content as text and keeps the first duplicate attribute', () => {
    const tokens = tokenizeHtml('<iframe src="a" src="b"><img src=x onerror=1></iframe><p>')
    expect(tokens.map((t) => t.kind)).toEqual(['start', 'rawtext', 'end', 'start'])
    expect(tokens[0]).toMatchObject({ attrs: [{ name: 'src', value: 'a' }] })
  })

  it('rewrites only the requested tags and copies everything else verbatim', () => {
    const html = '<p class=x>t &nbsp; <b>b</b></p><img alt="x src=" src="a.jpg">'
    const out = rewriteStartTags(html, ['img'], ({ attrs }) => {
      attrs.find((attr) => attr.name === 'src')!.value = 'b.jpg'
    })
    expect(out).toBe('<p class=x>t &nbsp; <b>b</b></p><img alt="x src=" src="b.jpg">')
  })
})

describe('toInertHtml (#3202)', () => {
  it('keeps legitimate server safe_html byte-for-byte', () => {
    const html =
      '<h2 id="part1">Заголовок</h2><p class="lead">Текст&nbsp;и &amp; <a href="https://metravel.by/a?x=1&amp;y=2" target="_blank" rel="noopener">ссылка</a></p>' +
      '<figure><img src="https://metravel.by/gallery/1.jpg" alt="" width="800" height="450"><figcaption>Подпись</figcaption></figure>' +
      '<details><summary>Когда ехать?</summary><p>Весной.</p></details><section class="seo-faq"><ul><li>a</li></ul></section>' +
      '<iframe src="https://www.youtube.com/embed/abc123" allowfullscreen></iframe><img src="data:image/png;base64,AA" alt="i">'
    expect(toInertHtml(html)).toBe(html)
    expect(guardServerSafeHtml(html)).toBe(html)
  })

  it('quotes and escapes every value, drops comments, executable attributes and URLs', () => {
    expect(toInertHtml("<p title='a\"b' data-x=c<d /onclick=1>x < y</p><!-- c -->")).toBe(
      '<p title="a&quot;b" data-x="c&lt;d">x &lt; y</p>',
    )
    expect(toInertHtml('<a href="java&#x09;script:alert(1)">a</a><a href="&#106;avascript&colon;x">b</a>')).toBe('<a>a</a><a>b</a>')
    expect(toInertHtml('<img srcset="/a.jpg 1x, javascript:x 2x" src="/a.jpg">')).toBe('<img srcset="/a.jpg 1x" src="/a.jpg">')
    expect(toInertHtml('<iframe src="https://www.youtube.com/embed/x" srcdoc="<script>x</script>">t</iframe>')).toBe(
      '<iframe src="https://www.youtube.com/embed/x"></iframe>',
    )
  })

  it('drops dangerous elements together with their content', () => {
    expect(toInertHtml(
      '<script>a()</script><style>p{}</style><svg><p>s</p></svg><template><p>t</p></template>' +
      '<iframe src="https://evil.example/"></iframe><object data="x"><p>o</p></object><p>ok</p>',
    )).toBe('<p>ok</p>')
    // Браузер со скриптами закрывает noscript на первом `</noscript`; хвост выводится
    // как обычная разметка — уже без исполняемых атрибутов.
    expect(toInertHtml('<noscript><p title="</noscript><img src=x onerror=1>"></p></noscript><p>ok</p>'))
      .toBe('<img src="x">"&gt;</p><p>ok</p>')
  })

  it('makes parser differentials inert (iframe content, comments)', () => {
    for (const html of [
      '<iframe src="https://www.youtube.com/embed/x"><a title="</iframe><img src=x onerror=alert(1)>"></a></iframe>',
      '<!-- <a title=" --><img src=x onerror=alert(1)>">',
      '<p title="x><img src=x onerror=alert(1)>">t</p>',
    ]) {
      expect(executableAttributes(toInertHtml(html))).toEqual([])
    }
  })

  it('#3262: no DOM clobbering of app globals; heading and legacy anchors survive', () => {
    const out = toInertHtml(
      '<h2 id="marshrut-dnya">Маршрут</h2><a name="old-anchor">a</a>' +
        '<img src="https://x/a.jpg" name="__metravelMetrikaInited"><form name="Quill"></form>' +
        '<iframe src="https://www.youtube.com/embed/x" name="ReactNativeWebView"></iframe>' +
        '<p id="__metravelBookPreviewWindow">p</p><p id="__proto__">q</p>',
    )
    const host = document.createElement('div')
    host.innerHTML = out
    document.body.appendChild(host)
    try {
      expect(host.querySelector('#marshrut-dnya')?.textContent).toBe('Маршрут')
      expect(host.querySelector('a[name="old-anchor"]')).not.toBeNull()
      expect(host.querySelectorAll('[name]:not(a)')).toHaveLength(0)
      expect(host.querySelectorAll('[id^="__"]')).toHaveLength(0)
      const globals = window as unknown as Record<string, unknown>
      expect(globals.__metravelMetrikaInited).toBeUndefined()
      expect(globals.__metravelBookPreviewWindow).toBeUndefined()
      expect((document as unknown as Record<string, unknown>).Quill).toBeUndefined()
    } finally {
      host.remove()
    }
  })
})

describe('prepareStableContentHtml without the sink barrier (#3202, point C)', () => {
  it.each([true, false])('card payloads do not gain attributes (serverSanitized=%s)', (serverSanitized) => {
    for (const html of [
      '<img alt="x src=" class="a b/onerror=alert(document.domain) c" src="https://x.invalid/a.jpg">',
      '<img class="x src=" alt=" src=x onerror=alert(1) y=">',
    ]) {
      expect(executableAttributes(prepareStableContentHtml(html, { serverSanitized }))).toEqual([])
    }
  })

  it('measures the barrier on a large article (informational, no timing assertion)', () => {
    const paragraph = '<p>Текст статьи с <a href="https://metravel.by/x?a=1&amp;b=2">ссылкой</a> и&nbsp;пробелами. '.repeat(6) + '</p>'
    const image = (i: number) =>
      `<p><img src="https://metravel.by/travel-description-image/${i}/conversions/a.webp" alt="Фото ${i}" width="1200" height="800"></p>`
    let html = ''
    for (let i = 0; html.length < 300_000; i += 1) html += paragraph + (i < 100 ? image(i) : '')
    const prepared = prepareStableContentHtml(html, { serverSanitized: true })
    toInertHtml(prepared)
    const runs = 5
    const started = performance.now()
    for (let i = 0; i < runs; i += 1) toInertHtml(prepared)
    const perRun = (performance.now() - started) / runs
    process.stdout.write(`toInertHtml: ${(prepared.length / 1024).toFixed(0)} KB, ${(prepared.match(/<img/g) ?? []).length} img, ${perRun.toFixed(1)} ms/run\n`)
    expect(toInertHtml(prepared).length).toBeGreaterThan(0)
  })
})
