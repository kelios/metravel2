import { useCallback, useLayoutEffect, useRef, useState } from 'react'

import { getBackdropSegments, getContainedMediaBox } from '@/components/ui/webBlurBackdropLayout'

const SSG_HERO_SELECTOR = '#ssg-skeleton .ssg-travel-hero'
const ADOPTED_HERO_SELECTOR = '[data-ssg-travel-hero-adopted="true"]'
const PLACEHOLDER_CLASS = 'ssg-travel-hero-placeholder'
const SSG_BLUR_SELECTOR = '.ssg-travel-hero-blur'

const hasSsgTravelHero = () =>
  typeof document !== 'undefined' && !!document.querySelector(SSG_HERO_SELECTOR)

const removeOrphanedSsgCss = () => {
  if (document.getElementById('ssg-skeleton')) return
  if (document.querySelector(ADOPTED_HERO_SELECTOR)) return
  document.getElementById('ssg-skeleton-css')?.remove()
}

const restoreInlineStyle = (element: HTMLElement | null, previousStyle: string | null) => {
  if (!element) return
  if (previousStyle == null) {
    element.removeAttribute('style')
    return
  }
  element.setAttribute('style', previousStyle)
}

const layoutAdoptedBackdrop = (
  hero: HTMLElement,
  image: HTMLImageElement | null,
  blurLayers: HTMLElement[],
) => {
  if (!image || blurLayers.length < 2) return

  const naturalWidth = Number(image.naturalWidth)
  const naturalHeight = Number(image.naturalHeight)
  const containerWidth = hero.clientWidth
  const containerHeight = hero.clientHeight
  if (
    !Number.isFinite(naturalWidth) ||
    !Number.isFinite(naturalHeight) ||
    naturalWidth <= 0 ||
    naturalHeight <= 0 ||
    !Number.isFinite(containerWidth) ||
    !Number.isFinite(containerHeight) ||
    containerWidth <= 0 ||
    containerHeight <= 0
  ) {
    return
  }

  const contentBox = getContainedMediaBox({
    containerWidth,
    containerHeight,
    contentAspectRatio: naturalWidth / naturalHeight,
  })
  const segments = getBackdropSegments({ containerWidth, containerHeight, contentBox })

  // Crop the same tiny LQIP independently inside each letterbox field. A single
  // full-size backdrop exposes only the source edges behind a contain image and
  // can look like a flat gray fill; the interactive slider uses this segmented
  // layout for the same reason. The segments remain smaller than the sharp image,
  // so they cannot replace it as the page's LCP candidate.
  blurLayers.forEach((layer, index) => {
    const segment = segments[index]
    if (!segment) {
      layer.style.display = 'none'
      return
    }

    Object.assign(layer.style, {
      display: 'block',
      inset: 'auto',
      left: `${segment.left}px`,
      top: `${segment.top}px`,
      width: `${segment.width}px`,
      height: `${segment.height}px`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      opacity: '0.95',
      contain: 'paint',
    })
  })
}

/**
 * Moves the already-painted SSG hero into React's hero slot.
 *
 * Keeping the original image DOM node prevents hydration from recording the
 * same pixels as a second, late LCP candidate. The interactive slider is
 * mounted underneath immediately and takes ownership on first user input.
 */
export function useTravelSsgHeroHandoff(
  onAdopted: () => void,
) {
  const hostRef = useRef<HTMLElement | null>(null)
  const onAdoptedRef = useRef(onAdopted)
  const [active, setActive] = useState(hasSsgTravelHero)

  onAdoptedRef.current = onAdopted

  const release = useCallback(() => {
    setActive(false)
  }, [])

  useLayoutEffect(() => {
    if (!active) {
      removeOrphanedSsgCss()
      return
    }

    const host = hostRef.current
    const hero = document.querySelector<HTMLElement>(SSG_HERO_SELECTOR)
    const skeleton = document.getElementById('ssg-skeleton')

    if (!host || !hero || !skeleton || !hero.parentNode) {
      setActive(false)
      return
    }

    const placeholder = document.createElement('div')
    placeholder.className = `ssg-travel-hero ${PLACEHOLDER_CLASS}`
    placeholder.setAttribute('aria-hidden', 'true')

    const picture = hero.querySelector<HTMLElement>('picture')
    const image = hero.querySelector<HTMLImageElement>('.ssg-travel-hero-img')
    const blurLayers = Array.from(hero.querySelectorAll<HTMLElement>(SSG_BLUR_SELECTOR)).slice(0, 2)
    const backdropOverlay = hero.querySelector<HTMLElement>('.ssg-travel-hero-bg')
    const previousPictureStyle = picture?.getAttribute('style') ?? null
    const previousImageStyle = image?.getAttribute('style') ?? null
    const previousHeroStyle = hero.getAttribute('style')
    const previousBlurStyles = blurLayers.map((layer) => layer.getAttribute('style'))
    const previousBackdropOverlayStyle = backdropOverlay?.getAttribute('style') ?? null

    // `<picture>` is inline by default. Once the SSG hero is adopted into the
    // taller React slot, its intrinsic box otherwise keeps the foreground at a
    // smaller square and leaves a large blur-only strip below it. Stretch the
    // existing, already-painted node to the slot; no replacement image request
    // is introduced and the original LCP element remains the foreground owner.
    // The adopted hero is absolutely positioned but has no z-index of its own.
    // Without a stacking context its z=0 backdrop children can be painted below
    // the hero's opaque background, leaving apparently empty letterbox fields.
    hero.style.isolation = 'isolate'
    if (picture) {
      Object.assign(picture.style, {
        position: 'absolute',
        inset: '0',
        width: '100%',
        height: '100%',
        display: 'block',
        zIndex: '1',
      })
    }
    if (image) {
      Object.assign(image.style, {
        position: 'absolute',
        inset: '0',
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        objectPosition: 'center',
        backgroundColor: 'transparent',
        display: 'block',
      })
    }
    if (backdropOverlay) backdropOverlay.style.zIndex = '0'

    skeleton.setAttribute('data-ssg-hero-adopted', 'true')
    hero.setAttribute('data-ssg-travel-hero-adopted', 'true')
    hero.parentNode.replaceChild(placeholder, hero)
    host.appendChild(hero)
    const updateBackdropLayout = () => layoutAdoptedBackdrop(hero, image, blurLayers)
    updateBackdropLayout()
    image?.addEventListener('load', updateBackdropLayout)
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(updateBackdropLayout)
    resizeObserver?.observe(hero)
    onAdoptedRef.current()

    return () => {
      resizeObserver?.disconnect()
      image?.removeEventListener('load', updateBackdropLayout)
      skeleton.removeAttribute('data-ssg-hero-adopted')
      if (skeleton.isConnected && placeholder.parentNode) {
        placeholder.parentNode.replaceChild(hero, placeholder)
      } else {
        if (hero.parentNode === host) hero.remove()
        placeholder.remove()
      }
      hero.removeAttribute('data-ssg-travel-hero-adopted')
      restoreInlineStyle(hero, previousHeroStyle)
      restoreInlineStyle(picture, previousPictureStyle)
      restoreInlineStyle(image, previousImageStyle)
      blurLayers.forEach((layer, index) => restoreInlineStyle(layer, previousBlurStyles[index] ?? null))
      restoreInlineStyle(backdropOverlay, previousBackdropOverlayStyle)
      removeOrphanedSsgCss()
    }
  }, [active])

  return { active, hostRef, release }
}

export const __testables = {
  ADOPTED_HERO_SELECTOR,
  PLACEHOLDER_CLASS,
  SSG_HERO_SELECTOR,
  layoutAdoptedBackdrop,
  hasSsgTravelHero,
}
