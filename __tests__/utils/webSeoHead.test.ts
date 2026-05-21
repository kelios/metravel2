/**
 * @jest-environment jsdom
 */

import { ensureSingleTitleTag } from '@/utils/seo'

describe('ensureSingleTitleTag', () => {
  beforeEach(() => {
    document.head.innerHTML = ''
    document.body.innerHTML = ''
    document.title = ''
  })

  it('creates a title element when the head does not have one', () => {
    const titleElement = ensureSingleTitleTag('Travel page | Metravel')

    expect(titleElement).not.toBeNull()
    expect(document.title).toBe('Travel page | Metravel')
    expect(document.head.querySelectorAll('title')).toHaveLength(1)
    expect(document.head.querySelector('title')?.textContent).toBe('Travel page | Metravel')
  })

  it('deduplicates multiple title elements and keeps the requested title', () => {
    document.head.innerHTML = [
      '<title>Old title</title>',
      '<meta name="description" content="desc">',
      '<title data-rh="true">Another title</title>',
    ].join('')

    const titleElement = ensureSingleTitleTag('Travel SEO title | Metravel')

    expect(titleElement).not.toBeNull()
    expect(document.title).toBe('Travel SEO title | Metravel')
    expect(document.head.querySelectorAll('title')).toHaveLength(1)
    expect(document.head.querySelector('title')?.textContent).toBe('Travel SEO title | Metravel')
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('desc')
  })
})


