import React from 'react'
import { act, render } from '@testing-library/react'

import { useTravelSsgHeroHandoff } from '@/components/travel/details/useTravelSsgHeroHandoff.web'

describe('useTravelSsgHeroHandoff (web)', () => {
  afterEach(() => {
    document.head.innerHTML = ''
    document.body.innerHTML = ''
  })

  it('adopts the painted hero node and releases it after the SSG shell is gone', () => {
    document.head.innerHTML = '<style id="ssg-skeleton-css"></style>'
    document.body.innerHTML =
      '<div id="ssg-skeleton"><div class="ssg-travel-hero"><img data-lcp src="/hero.jpg"></div></div>' +
      '<div id="mount"></div>'
    const onAdopted = jest.fn()
    let handoff: ReturnType<typeof useTravelSsgHeroHandoff> | null = null

    function Harness() {
      handoff = useTravelSsgHeroHandoff(onAdopted)
      return handoff.active ? <div data-testid="handoff-host" ref={handoff.hostRef} /> : null
    }

    render(<Harness />, { container: document.getElementById('mount') as HTMLElement })

    const adopted = document.querySelector('[data-ssg-travel-hero-adopted="true"]')
    expect(adopted).not.toBeNull()
    expect(document.querySelector('[data-testid="handoff-host"]')?.contains(adopted)).toBe(true)
    expect(document.getElementById('ssg-skeleton')?.getAttribute('data-ssg-hero-adopted')).toBe('true')
    expect(onAdopted).toHaveBeenCalledTimes(1)

    document.getElementById('ssg-skeleton')?.remove()
    act(() => handoff!.release())

    expect(document.querySelector('[data-ssg-travel-hero-adopted="true"]')).toBeNull()
    expect(document.getElementById('ssg-skeleton-css')).toBeNull()
  })

  it('keeps the normal React hero path when there is no SSG shell', () => {
    document.body.innerHTML = '<div id="mount"></div>'
    let active = true

    function Harness() {
      active = useTravelSsgHeroHandoff(jest.fn()).active
      return null
    }

    render(<Harness />, { container: document.getElementById('mount') as HTMLElement })
    expect(active).toBe(false)
  })
})
