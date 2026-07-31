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
    document.body.innerHTML =
      '<div id="ssg-skeleton"><div class="ssg-travel-hero">' +
      '<div class="ssg-travel-hero-blur ssg-blur-mobile"></div>' +
      '<div class="ssg-travel-hero-blur ssg-blur-desktop"></div>' +
      '<picture><img class="ssg-travel-hero-img" data-lcp src="/hero.jpg"></picture>' +
      '<div class="ssg-travel-hero-bg"></div></div></div>' +
      '<div id="mount"></div>'
    const originalHero = document.querySelector('.ssg-travel-hero') as HTMLElement
    const originalImage = document.querySelector('.ssg-travel-hero-img') as HTMLImageElement
    Object.defineProperty(originalHero, 'clientWidth', { configurable: true, value: 600 })
    Object.defineProperty(originalHero, 'clientHeight', { configurable: true, value: 300 })
    Object.defineProperty(originalImage, 'naturalWidth', { configurable: true, value: 400 })
    Object.defineProperty(originalImage, 'naturalHeight', { configurable: true, value: 400 })
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
    const adoptedBlurLayers = Array.from(
      adopted?.querySelectorAll('.ssg-travel-hero-blur') ?? [],
    ) as HTMLElement[]
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
    expect(adoptedBlurLayers).toHaveLength(2)
    expect(adoptedBlurLayers[0].style.display).toBe('block')
    expect(adoptedBlurLayers[0].style.left).toBe('0px')
    expect(adoptedBlurLayers[0].style.width).toBe('150px')
    expect(adoptedBlurLayers[0].style.height).toBe('300px')
    expect(adoptedBlurLayers[1].style.display).toBe('block')
    expect(adoptedBlurLayers[1].style.left).toBe('450px')
    expect(adoptedBlurLayers[1].style.width).toBe('150px')
    expect(adoptedBackdropOverlay.style.zIndex).toBe('0')

    document.getElementById('ssg-skeleton')?.remove()
    act(() => handoff!.release())

    expect(document.querySelector('[data-ssg-travel-hero-adopted="true"]')).toBeNull()
    expect(document.getElementById('ssg-skeleton-css')).toBeNull()
    expect((adopted as HTMLElement).getAttribute('style')).toBeNull()
    expect(adoptedPicture.getAttribute('style')).toBeNull()
    expect(adoptedImage.getAttribute('style')).toBeNull()
    expect(adoptedBlurLayers[0].getAttribute('style')).toBeNull()
    expect(adoptedBlurLayers[1].getAttribute('style')).toBeNull()
    expect(adoptedBackdropOverlay.getAttribute('style')).toBeNull()
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

  it('places portrait-slot blur segments above and below a square image', () => {
    const hero = document.createElement('div')
    const image = document.createElement('img')
    const layers = [document.createElement('div'), document.createElement('div')]
    Object.defineProperty(hero, 'clientWidth', { configurable: true, value: 300 })
    Object.defineProperty(hero, 'clientHeight', { configurable: true, value: 400 })
    Object.defineProperty(image, 'naturalWidth', { configurable: true, value: 400 })
    Object.defineProperty(image, 'naturalHeight', { configurable: true, value: 400 })

    __testables.layoutAdoptedBackdrop(hero, image, layers)

    expect(layers[0].style.top).toBe('0px')
    expect(layers[0].style.width).toBe('300px')
    expect(layers[0].style.height).toBe('50px')
    expect(layers[1].style.top).toBe('350px')
    expect(layers[1].style.width).toBe('300px')
    expect(layers[1].style.height).toBe('50px')
  })
})
