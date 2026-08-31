import React from 'react'
import { render } from '@testing-library/react'

import { MapPageHeading } from '@/components/MapPage/MapPageHeading'

jest.mock('@/constants/mapSeo', () => ({
  getMapSeoTitle: () => 'Карта маршрутов и достопримечательностей Беларуси | Metravel',
  getMapSeoDescription: () => 'desc',
}))

const styles = {
  pageHeadingInPanel: { fontSize: 17, textAlign: 'left' as const },
  pageHeadingCapsule: { position: 'absolute' as const, top: 67, left: 8 },
  pageHeadingCapsuleText: { fontSize: 15, textAlign: 'left' as const },
}

const mountStaticHeading = () => {
  const heading = document.createElement('h1')
  heading.setAttribute('data-ssg-travel-h1', 'true')
  heading.textContent = 'Карта маршрутов и достопримечательностей Беларуси | Metravel'
  document.body.appendChild(heading)
  return heading
}

describe('MapPageHeading (#1640)', () => {
  afterEach(() => {
    document
      .querySelectorAll('h1[data-ssg-travel-h1="true"]')
      .forEach((heading) => heading.remove())
  })

  it('renders a real level-1 heading without the site-name suffix', () => {
    const view = render(<MapPageHeading anchor="panel-head" styles={styles} />)

    const heading = view.getByRole('heading', { level: 1 })
    expect(heading.tagName).toBe('H1')
    expect(heading.textContent).toBe('Карта маршрутов и достопримечательностей Беларуси')
  })

  it('adopts the static heading only when it mounts, not on a timer', () => {
    mountStaticHeading()
    expect(document.querySelectorAll('h1')).toHaveLength(1)

    const view = render(<MapPageHeading anchor="map-corner" styles={styles} />)

    // The static node is gone and its replacement is already in the document —
    // the count never passes through 0 or 2.
    expect(document.querySelector('h1[data-ssg-travel-h1="true"]')).toBeNull()
    expect(document.querySelectorAll('h1')).toHaveLength(1)
    expect(view.getByRole('heading', { level: 1 }).textContent).toBe(
      'Карта маршрутов и достопримечательностей Беларуси',
    )
  })

  it('keeps exactly one heading when the anchor switches', () => {
    const view = render(<MapPageHeading anchor="panel-head" styles={styles} />)
    expect(document.querySelectorAll('h1')).toHaveLength(1)

    view.rerender(<MapPageHeading anchor="map-corner" styles={styles} />)

    // Sampled synchronously right after the commit, without waitFor: a second
    // heading must never be observable during the swap.
    expect(document.querySelectorAll('h1')).toHaveLength(1)

    view.rerender(<MapPageHeading anchor="panel-head" styles={styles} />)
    expect(document.querySelectorAll('h1')).toHaveLength(1)
  })

  it('does not let the map-corner capsule intercept map interaction', () => {
    const view = render(<MapPageHeading anchor="map-corner" styles={styles} />)

    const capsule = view.container.querySelector('[data-map-page-heading="map-corner"]')
    expect(capsule).not.toBeNull()
    expect((capsule as HTMLElement).style.pointerEvents).toBe('none')
  })
})
