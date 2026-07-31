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
