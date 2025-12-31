/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'

expect.extend(toHaveNoViolations)

describe('TravelDetails accessibility (web)', () => {
  jest.setTimeout(15000)

  it('OptimizedLCPHero has no obvious a11y violations', async () => {
    jest.useRealTimers()
    const RN = require('react-native')
    RN.Platform.OS = 'web'
    RN.Platform.select = (obj: any) => obj.web ?? obj.default

    const { OptimizedLCPHero } = require('@/components/travel/details/TravelDetailsHero')

    const { container } = render(
      <OptimizedLCPHero
        img={{
          url: 'https://cdn.example.com/hero.jpg',
          width: 1200,
          height: 800,
          updated_at: '2025-01-01',
          id: 1,
        }}
        alt="Hero image"
        isMobile={false}
      />
    )

    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
