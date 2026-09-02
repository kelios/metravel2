import React from 'react'
import { render, within } from '@testing-library/react-native'
import { Platform } from 'react-native'

jest.mock('@/constants/mapSeo', () => ({
  getMapSeoTitle: () => 'Карта маршрутов и достопримечательностей Беларуси | Metravel',
  getMapSeoDescription: () => 'desc',
}))

// `MapPageHeading` reads `Platform.OS` into a module-level `IS_WEB` at import
// time and renders null off web, while jest defaults to `haste.defaultPlatform:
// 'ios'`. A static top-level import would evaluate the module before any test
// code runs, so the platform is flipped first and the module pulled in lazily —
// the same approach as `home-screen.h1.web.test.tsx`, and for the same two
// reasons documented there: jest-expo's `react-native` resolution is not
// intercepted by `jest.mock('react-native', factory)` (verified again for this
// suite: the factory never runs and `Platform.OS` stays 'ios'), and
// `jest.resetModules()` would evict the already-loaded React singleton and
// break hook dispatch.
function loadMapPageHeading() {
  (Platform as { OS: string }).OS = 'web'
  const mod = require('@/components/MapPage/MapPageHeading') as typeof import('@/components/MapPage/MapPageHeading')
  return mod.MapPageHeading
}

const MapPageHeading = loadMapPageHeading()

// This harness maps `react-native` to the NATIVE implementation (see
// `jest.config.js` moduleNameMapper), so react-native-web never runs and no RN
// primitive is translated into a DOM tag. Inspect the native props directly:
// the translation into a real `<h1>` and `data-map-page-heading` is
// react-native-web's contract and is asserted in `e2e/map-page.spec.ts`
// ('desktop: SEO title and canonical are set for /map'). What stays this suite's
// job is the input side of that contract plus the static DOM teardown it owns.
const getLevelOneHeadings = (view: ReturnType<typeof render>) =>
  view.queryAllByRole('header').filter((node) => node.props['aria-level'] === 1)

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

  it('renders level-1 heading semantics without the site-name suffix', () => {
    const view = render(<MapPageHeading anchor="panel-head" styles={styles} />)

    const headings = getLevelOneHeadings(view)
    expect(headings).toHaveLength(1)
    expect(String(headings[0].props.children)).toBe('Карта маршрутов и достопримечательностей Беларуси')
  })

  it('adopts the static heading only when it mounts, not on a timer', () => {
    mountStaticHeading()
    expect(document.querySelectorAll('h1[data-ssg-travel-h1="true"]')).toHaveLength(1)

    const view = render(<MapPageHeading anchor="map-corner" styles={styles} />)

    // The static node is gone and its replacement is already rendered — the
    // page never passes through zero headings or two.
    expect(document.querySelector('h1[data-ssg-travel-h1="true"]')).toBeNull()
    expect(getLevelOneHeadings(view)).toHaveLength(1)
    expect(String(view.getByRole('header').props.children)).toBe(
      'Карта маршрутов и достопримечательностей Беларуси',
    )
  })

  it('keeps exactly one heading when the anchor switches', () => {
    const view = render(<MapPageHeading anchor="panel-head" styles={styles} />)
    expect(getLevelOneHeadings(view)).toHaveLength(1)

    view.rerender(<MapPageHeading anchor="map-corner" styles={styles} />)

    // Sampled synchronously right after the commit, without waitFor: a second
    // heading must never be observable during the swap.
    expect(getLevelOneHeadings(view)).toHaveLength(1)

    view.rerender(<MapPageHeading anchor="panel-head" styles={styles} />)
    expect(getLevelOneHeadings(view)).toHaveLength(1)
  })

  it('does not let the map-corner capsule intercept map interaction', () => {
    const view = render(<MapPageHeading anchor="map-corner" styles={styles} />)

    const capsule = view.UNSAFE_getByProps({ pointerEvents: 'none' })
    // The capsule wraps the heading rather than sitting beside it, so the
    // `pointerEvents` opt-out covers the whole label.
    expect(within(capsule).getByRole('header').props['aria-level']).toBe(1)
  })

  it('marks both anchors with the dataSet hook react-native-web turns into data-map-page-heading', () => {
    // The resulting `data-map-page-heading` attribute is react-native-web's
    // output; this unit test guards the input prop and exact anchor value.
    const panel = render(<MapPageHeading anchor="panel-head" styles={styles} />)
    expect(panel.getByRole('header').props.dataSet).toEqual({ mapPageHeading: 'panel-head' })

    const corner = render(<MapPageHeading anchor="map-corner" styles={styles} />)
    expect(corner.UNSAFE_getByProps({ pointerEvents: 'none' }).props.dataSet).toEqual({
      mapPageHeading: 'map-corner',
    })
  })
})
