jest.mock('react-native', () => ({
  Platform: {
    OS: 'web',
  },
}))

import { prepareStableContentHtml } from '@/components/travel/stableContent/htmlTransform'

describe('prepareStableContentHtml XSS hardening', () => {
  it('escapes a double-quote breakout attempt in img src', () => {
    const result = prepareStableContentHtml(
      '<p><img src="https://example.com/a.jpg&quot; onerror=&quot;alert(1)" alt="x"></p>',
    )

    // Проверяемое свойство — невозможность выйти из значения `src` и открыть новый
    // атрибут; сам текст `onerror=` внутри percent-encoded URL безопасен и браузером
    // трактуется как часть пути.
    //
    // #1163: раньше здесь стояло `not.toContain('onerror=')`, и это проходило по
    // случайности: внешний URL заворачивался в `images.weserv.nl` через
    // `encodeURIComponent`, который кодировал в том числе `=`. Сторонний ресайзер
    // убран, и проверка приведена к тому, что действительно является защитой:
    // кавычка кодируется (`%22`), а `escapeHtmlAttr` не даёт ей стать разделителем.
    const src = result.match(/<img\b[^>]*\bsrc="([^"]*)"/i)?.[1] ?? ''
    expect(src).not.toContain('"')
    expect(src).toContain('%22')
    expect(result).not.toMatch(/src="[^"]*"\s*onerror/i)
    expect(result.toLowerCase()).not.toMatch(/"\s+onerror=/)
  })

  it('does not let a crafted src break out into a raw event-handler attribute', () => {
    const result = prepareStableContentHtml(
      '<p><img src=\'x" onload="alert(document.cookie)\' alt="y"></p>',
    )

    // The crafted quote/space must be encoded (entity or percent), never a raw breakout
    // that would start a new `onload=` attribute outside the quoted src value.
    expect(result.toLowerCase()).not.toMatch(/"\s+onload=/)
  })

  it('escapes a backdrop src so it cannot break out of the style attribute', () => {
    const result = prepareStableContentHtml(
      '<p><img src="https://example.com/b.jpg) ;} </style><script>alert(1)</script>" alt="z"></p>',
    )

    expect(result).not.toContain('<script>')
    expect(result).not.toContain('</style>')
  })

  it('keeps legitimate image rendering intact', () => {
    const result = prepareStableContentHtml(
      '<p><img src="https://example.com/photo.jpg" alt="Beautiful place"></p>',
    )

    expect(result).toContain('<img')
    expect(result).toContain('alt="Beautiful place"')
    expect(result).toContain('loading="lazy"')
  })
})
