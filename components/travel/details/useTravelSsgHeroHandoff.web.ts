import { useCallback, useLayoutEffect, useRef, useState } from 'react'

const SSG_HERO_SELECTOR = '#ssg-skeleton .ssg-travel-hero'
const ADOPTED_HERO_SELECTOR = '[data-ssg-travel-hero-adopted="true"]'
const PLACEHOLDER_CLASS = 'ssg-travel-hero-placeholder'

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
    const image = hero.querySelector<HTMLElement>('.ssg-travel-hero-img')
    const previousPictureStyle = picture?.getAttribute('style') ?? null
    const previousImageStyle = image?.getAttribute('style') ?? null

    // `<picture>` is inline by default. Once the SSG hero is adopted into the
    // taller React slot, its intrinsic box otherwise keeps the foreground at a
    // smaller square and leaves a large blur-only strip below it. Stretch the
    // existing, already-painted node to the slot; no replacement image request
    // is introduced and the original LCP element remains the foreground owner.
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
        display: 'block',
      })
    }

    skeleton.setAttribute('data-ssg-hero-adopted', 'true')
    hero.setAttribute('data-ssg-travel-hero-adopted', 'true')
    hero.parentNode.replaceChild(placeholder, hero)
    host.appendChild(hero)
    onAdoptedRef.current()

    return () => {
      skeleton.removeAttribute('data-ssg-hero-adopted')
      if (skeleton.isConnected && placeholder.parentNode) {
        placeholder.parentNode.replaceChild(hero, placeholder)
      } else {
        if (hero.parentNode === host) hero.remove()
        placeholder.remove()
      }
      hero.removeAttribute('data-ssg-travel-hero-adopted')
      restoreInlineStyle(picture, previousPictureStyle)
      restoreInlineStyle(image, previousImageStyle)
      removeOrphanedSsgCss()
    }
  }, [active])

  return { active, hostRef, release }
}

export const __testables = {
  ADOPTED_HERO_SELECTOR,
  PLACEHOLDER_CLASS,
  SSG_HERO_SELECTOR,
  hasSsgTravelHero,
}
