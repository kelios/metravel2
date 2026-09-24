const { normalizeHeadCharset } = require('@/scripts/lib/htmlCharset')

// #2088: Expo Router's static export inserts React Helmet's per-page tags
// (`data-rh="true"`: title, description, og:*, twitter:*) ahead of the
// <head> children declared in app/+html.tsx. On a page with a long
// (often Cyrillic, so multi-byte) description this pushes the real
// <meta charset> past the 1024-byte window the browser scans for encoding.
describe('normalizeHeadCharset', () => {
  const cyrillicFiller = 'Очень длинное описание страницы для проверки позиции кодировки. '.repeat(20)

  const buildHelmetHeavyHtml = () => `<!DOCTYPE html>
<html lang="ru">
<head>
<title data-rh="true">Пользовательское соглашение | Metravel</title>
<meta data-rh="true" name="description" content="${cyrillicFiller}"/>
<meta data-rh="true" property="og:title" content="Пользовательское соглашение"/>
<meta data-rh="true" property="og:description" content="${cyrillicFiller}"/>
<meta data-rh="true" property="og:image" content="https://metravel.by/og-default.png"/>
<meta data-rh="true" name="twitter:description" content="${cyrillicFiller}"/>
	      <meta charSet="utf-8" />
	      <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
      <meta name="viewport" content="width=device-width,initial-scale=1"/>
</head>
<body><div id="root"></div></body>
</html>`

  it('reproduces the bug on the fixture: charset starts past byte 1024 before the fix', () => {
    const html = buildHelmetHeavyHtml()
    const charsetByteOffset = Buffer.byteLength(html.slice(0, html.search(/charset/i)), 'utf8')
    expect(charsetByteOffset).toBeGreaterThan(1024)
  })

  it('moves <meta charset> to be the first child of <head>, preserving its value', () => {
    const html = buildHelmetHeavyHtml()
    const fixed = normalizeHeadCharset(html)

    const headIdx = fixed.indexOf('<head>')
    const firstMetaAfterHead = fixed.slice(headIdx + '<head>'.length).match(/<[^>]+>/)?.[0]
    expect(firstMetaAfterHead).toBe('<meta charset="utf-8"/>')

    const charsetByteOffset = Buffer.byteLength(fixed.slice(0, fixed.search(/charset/i)), 'utf8')
    expect(charsetByteOffset).toBeLessThan(1024)

    // Helmet tags and the rest of <head> are untouched, just reordered around them.
    expect(fixed).toContain('<title data-rh="true">Пользовательское соглашение | Metravel</title>')
    expect(fixed).toContain('<meta httpEquiv="X-UA-Compatible" content="IE=edge" />')
  })

  it('removes a duplicate charset meta further down instead of leaving two', () => {
    const html = `<html><head><meta charset="utf-8"/><title data-rh="true">x</title><meta charset="utf-8"/></head><body></body></html>`
    const fixed = normalizeHeadCharset(html)
    expect(fixed.match(/charset/gi)).toHaveLength(1)
    expect(fixed).toBe('<html><head><meta charset="utf-8"/><title data-rh="true">x</title></head><body></body></html>')
  })

  it('is a no-op when charset is already first (idempotent across repeated runs)', () => {
    const html = '<html><head><meta charset="utf-8"/><title>x</title></head><body></body></html>'
    expect(normalizeHeadCharset(html)).toBe(html)
    expect(normalizeHeadCharset(normalizeHeadCharset(html))).toBe(html)
  })

  it('leaves html without a <head> or without any charset meta untouched', () => {
    expect(normalizeHeadCharset('<body>no head here</body>')).toBe('<body>no head here</body>')
    const noCharset = '<html><head><title>x</title></head><body></body></html>'
    expect(normalizeHeadCharset(noCharset)).toBe(noCharset)
  })
})
