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

    expect(result).not.toContain('onerror=')
    // any surviving quote in the value must be entity-encoded, never a raw breakout
    expect(result).not.toMatch(/src="[^"]*"\s*onerror/i)
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
