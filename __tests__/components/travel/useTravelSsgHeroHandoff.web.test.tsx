import React from 'react'
import { act, render } from '@testing-library/react'

import {
  __testables,
  useTravelSsgHeroHandoff,
} from '@/components/travel/details/useTravelSsgHeroHandoff.web'

describe('useTravelSsgHeroHandoff (web)', () => {
  afterEach(() => {
    document.head.innerHTML = ''
    document.body.innerHTML = ''
  })

  it('adopts the painted hero node and releases it after the SSG shell is gone', () => {
    document.head.innerHTML = '<style id="ssg-skeleton-css"></style>'
    // #1208: SSG-hero больше не содержит blur-слоёв — поля заливает
    // `dominant_color` прямо на контейнере, растр остаётся ровно один.
    document.body.innerHTML =
      '<div id="ssg-skeleton"><div class="ssg-travel-hero" style="background-color:#123456">' +
      '<picture><img class="ssg-travel-hero-img" data-lcp src="/hero.jpg"></picture>' +
      '<div class="ssg-travel-hero-bg"></div></div></div>' +
      '<div id="mount"></div>'
    const onAdopted = jest.fn()
    let handoff: ReturnType<typeof useTravelSsgHeroHandoff> | null = null

    function Harness() {
      handoff = useTravelSsgHeroHandoff(onAdopted)
      return handoff.active ? <div data-testid="handoff-host" ref={handoff.hostRef} /> : null
    }

    render(<Harness />, { container: document.getElementById('mount') as HTMLElement })

    const adopted = document.querySelector('[data-ssg-travel-hero-adopted="true"]')
    const adoptedPicture = adopted?.querySelector('picture') as HTMLElement
    const adoptedImage = adopted?.querySelector('.ssg-travel-hero-img') as HTMLElement
    const adoptedBackdropOverlay = adopted?.querySelector('.ssg-travel-hero-bg') as HTMLElement
    expect(adopted).not.toBeNull()
    expect(document.querySelector('[data-testid="handoff-host"]')?.contains(adopted)).toBe(true)
    expect(document.getElementById('ssg-skeleton')?.getAttribute('data-ssg-hero-adopted')).toBe('true')
    expect(document.querySelector('#ssg-skeleton .ssg-travel-hero-placeholder')).not.toBeNull()
    expect(onAdopted).toHaveBeenCalledTimes(1)
    expect((adopted as HTMLElement).style.isolation).toBe('isolate')
    expect(adoptedPicture.style.position).toBe('absolute')
    expect(adoptedPicture.style.inset).toBe('0')
    expect(adoptedPicture.style.width).toBe('100%')
    expect(adoptedPicture.style.height).toBe('100%')
    expect(adoptedImage.style.position).toBe('absolute')
    expect(adoptedImage.style.inset).toBe('0')
    expect(adoptedImage.style.objectFit).toBe('contain')
    expect(adoptedImage.style.backgroundColor).toBe('transparent')
    expect(adopted?.querySelectorAll('.ssg-travel-hero-blur')).toHaveLength(0)
    expect(adopted?.querySelectorAll('img')).toHaveLength(1)
    expect(adoptedBackdropOverlay.style.zIndex).toBe('0')

    document.getElementById('ssg-skeleton')?.remove()
    act(() => handoff!.release())

    expect(document.querySelector('[data-ssg-travel-hero-adopted="true"]')).toBeNull()
    expect(document.getElementById('ssg-skeleton-css')).toBeNull()
    expect(adoptedPicture.getAttribute('style')).toBeNull()
    expect(adoptedImage.getAttribute('style')).toBeNull()
    expect(adoptedBackdropOverlay.getAttribute('style')).toBeNull()
    // Заливка полей — инлайновый background-color самого hero из SSG: адопция
    // добавляет к нему свои стили, а откат обязан вернуть ровно исходную заливку.
    expect((adopted as HTMLElement).getAttribute('style')).toBe('background-color:#123456')
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
