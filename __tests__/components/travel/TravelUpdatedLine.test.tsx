import React from 'react'
import { render } from '@testing-library/react-native'

import { readTravelContentUpdatedAt } from '@/utils/travelContentUpdatedAt'

// #3237: «Обновлено» показывает только честную дату правки содержания —
// `content_updated_at` из API статьи (контракт #3240), не технический `updated_at`.
const TECHNICAL = { updated_at: '2026-09-23T07:54:00Z', date_update: '2026-09-23' }

describe('readTravelContentUpdatedAt', () => {
  it.each([
    ['present', { ...TECHNICAL, content_updated_at: '2026-10-05T09:00:00Z' }, '2026-10-05T09:00:00.000Z'],
    ['null', { ...TECHNICAL, content_updated_at: null }, null],
    ['absent', TECHNICAL, null],
    ['invalid', { content_updated_at: 'вчера' }, null],
  ])('content_updated_at %s', (_label, travel, expected) => {
    expect(readTravelContentUpdatedAt(travel)).toBe(expected)
  })
})

describe('TravelUpdatedLine', () => {
  it.each([
    ['null', { ...TECHNICAL, content_updated_at: null }],
    ['absent', TECHNICAL],
  ])('renders nothing when content_updated_at is %s', async (_label, travel) => {
    const TravelUpdatedLine = require('@/components/travel/details/TravelUpdatedLine').default
    const root = await render(<TravelUpdatedLine travel={travel} />)
    expect(root.queryByTestId('travel-updated-line')).toBeNull()
  })
})

describe('TravelUpdatedLine in the web server HTML', () => {
  let html = ''
  beforeAll(() => {
    jest.resetModules()
    jest.doMock('react-native', () => jest.requireActual('react-native-web'))
    const { createElement } = require('react')
    const { renderToStaticMarkup } = require('react-dom/server.node')
    const TravelUpdatedLine = require('@/components/travel/details/TravelUpdatedLine').default
    html = renderToStaticMarkup(createElement(TravelUpdatedLine, {
      travel: { ...TECHNICAL, content_updated_at: '2026-10-05T00:00:00Z' },
    }))
  })

  it('renders the label and a <time dateTime> when content_updated_at is present', () => {
    const host = document.createElement('div')
    host.innerHTML = html
    const time = host.querySelector('time')
    expect(time?.getAttribute('datetime')).toBe('2026-10-05T00:00:00.000Z')
    expect(time?.textContent).toMatch(/2026/)
    expect(host.textContent).toMatch(/^Обновлено /)
  })
})
