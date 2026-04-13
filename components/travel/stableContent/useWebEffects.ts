import { Dispatch, SetStateAction, useEffect, useInsertionEffect, useLayoutEffect } from 'react'
import { Platform } from 'react-native'

import { buildWeservProxyUrl, extractFirstImgSrc } from '@/components/travel/stableContent/htmlTransform'

import { WEB_RICH_TEXT_CLASS, WEB_RICH_TEXT_STYLES_ID } from './webStyles'

type LightboxImage = { src: string; alt: string }

type UseStableContentWebEffectsInput = {
  prepared: string
  lightboxImage: LightboxImage | null
  setLightboxImage: Dispatch<SetStateAction<LightboxImage | null>>
  webRichTextStyles: string
  scrollToHashTarget: (hash: string) => boolean
}

export function useStableContentWebEffects({
  prepared,
  lightboxImage,
  setLightboxImage,
  webRichTextStyles,
  scrollToHashTarget,
}: UseStableContentWebEffectsInput) {
  useEffect(() => {
    if (Platform.OS !== 'web') return
    if (typeof window === 'undefined' || typeof document === 'undefined') return

    const connection = (navigator as any)?.connection
    const effectiveType = String(connection?.effectiveType || '').toLowerCase()
    const saveData = Boolean(connection?.saveData)
    const isConstrained = saveData || effectiveType.includes('2g') || effectiveType.includes('slow-2g')
    if (isConstrained) return

    const first = extractFirstImgSrc(prepared)
    if (!first) return
    const safeHref = buildWeservProxyUrl(first) || first
    try {
      const resolved = new URL(safeHref, window.location.origin)
      if (resolved.origin !== window.location.origin) return
    } catch {
      return
    }
    const linkId = `prefetch-stable-content-first-img-${encodeURIComponent(safeHref)}`
    if (document.getElementById(linkId)) return

    let link: HTMLLinkElement | null = null
    let cancelled = false

    const mount = () => {
      if (cancelled) return
      if (document.getElementById(linkId)) return
      link = document.createElement('link')
      link.rel = 'prefetch'
      link.as = 'image'
      link.href = safeHref
      link.id = linkId
      document.head.appendChild(link)
    }

    const schedule = () => {
      try {
        if ((window as any).requestIdleCallback) {
          ;(window as any).requestIdleCallback(mount, { timeout: 1000 })
        } else {
          setTimeout(mount, 1000)
        }
      } catch {
        mount()
      }
    }

    if (document.readyState === 'complete') {
      schedule()
    } else {
      window.addEventListener('load', schedule, { once: true })
    }

    return () => {
      cancelled = true
      try {
        window.removeEventListener('load', schedule as any)
      } catch {
        void 0
      }
      if (link?.parentNode) link.parentNode.removeChild(link)
    }
  }, [prepared])

  useLayoutEffect(() => {
    if (Platform.OS !== 'web') return
    const onClick = (e: any) => {
      const target = e.target as HTMLElement | null
      if (!target) return

      const ytRoot = target.closest?.('.yt-lite') as HTMLElement | null
      if (ytRoot) {
        const vid = ytRoot.getAttribute('data-yt')
        if (!vid) return
        const iframe = document.createElement('iframe')
        iframe.width = '560'
        iframe.height = '315'
        iframe.src = `https://www.youtube.com/embed/${vid}?autoplay=1&rel=0`
        iframe.title = 'YouTube video'
        iframe.allow =
          'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
        iframe.setAttribute('allowfullscreen', '')
        Object.assign(iframe.style, {
          position: 'absolute',
          inset: '0',
          width: '100%',
          height: '100%',
          border: '0',
        })
        ytRoot.replaceChildren()
        ytRoot.appendChild(iframe)
        return
      }

      const anchor = target.closest?.(`.${WEB_RICH_TEXT_CLASS} a[href^="#"]`) as HTMLAnchorElement | null
      if (!anchor) return
      const href = anchor.getAttribute('href') || ''
      if (!href.startsWith('#')) return
      const didScroll = scrollToHashTarget(href)
      if (didScroll) {
        e.preventDefault?.()
        try {
          window.history.pushState(window.history.state ?? {}, '', href)
        } catch {
          window.location.hash = href
        }
      }
    }

    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick as any)
  }, [scrollToHashTarget])

  useEffect(() => {
    if (Platform.OS !== 'web') return
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target) return
      const image = target.closest?.(`.${WEB_RICH_TEXT_CLASS} img`) as HTMLImageElement | null
      if (!image) return
      const parentLink = image.closest('a[href]') as HTMLAnchorElement | null
      const href = parentLink?.getAttribute('href') || ''
      if (href && !href.startsWith('#')) {
        return
      }
      e.preventDefault()
      const src = image.currentSrc || image.getAttribute('src') || ''
      if (!src) return
      setLightboxImage({
        src,
        alt: image.getAttribute('alt') || 'Изображение маршрута',
      })
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxImage(null)
      }
    }

    document.addEventListener('click', onClick)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('click', onClick)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [setLightboxImage])

  useEffect(() => {
    if (Platform.OS !== 'web') return
    if (typeof document === 'undefined') return
    const originalOverflow = document.body.style.overflow
    if (lightboxImage) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = originalOverflow || ''
    }
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [lightboxImage])

  useLayoutEffect(() => {
    if (Platform.OS !== 'web') return
    if (typeof window === 'undefined') return
    const hash = window.location.hash
    if (!hash) return

    let cancelled = false
    let attempts = 0
    let timeoutId: number | null = null
    const maxAttempts = 6

    const tick = () => {
      if (cancelled) return
      attempts += 1
      const done = scrollToHashTarget(hash)
      if (done || attempts >= maxAttempts) return
      timeoutId = window.setTimeout(tick, 50)
    }

    tick()

    return () => {
      cancelled = true
      if (timeoutId != null) clearTimeout(timeoutId)
    }
  }, [prepared, scrollToHashTarget])

  useInsertionEffect(() => {
    if (Platform.OS !== 'web') return
    if (typeof document === 'undefined') return
    const existing = document.getElementById(WEB_RICH_TEXT_STYLES_ID) as HTMLStyleElement | null
    if (existing) {
      existing.textContent = webRichTextStyles
      return
    }
    const style = document.createElement('style')
    style.id = WEB_RICH_TEXT_STYLES_ID
    style.textContent = webRichTextStyles
    document.head.appendChild(style)
  }, [webRichTextStyles])

  useEffect(() => {
    if (Platform.OS !== 'web') return

    let processing = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const processInstagramEmbeds = () => {
      if (processing) return
      processing = true

      try {
        const richTextContainer = document.querySelector(`.${WEB_RICH_TEXT_CLASS}`)
        if (!richTextContainer) {
          processing = false
          return
        }

        const instagramIframes = richTextContainer.querySelectorAll(
          'iframe[src*="instagram.com"]:not(.instagram-processed), iframe.ql-video[src*="instagram.com"]:not(.instagram-processed)'
        )

        instagramIframes.forEach((iframe) => {
          if (iframe.parentElement?.classList.contains('instagram-wrapper')) {
            iframe.classList.add('instagram-processed')
            return
          }

          const wrapper = document.createElement('div')
          wrapper.className = 'instagram-wrapper'

          iframe.parentNode?.insertBefore(wrapper, iframe)
          wrapper.appendChild(iframe)
          iframe.classList.add('instagram-embed', 'instagram-processed')
        })

        const instagramBlockquotes = richTextContainer.querySelectorAll(
          'blockquote.instagram-media:not(.instagram-processed)'
        )

        instagramBlockquotes.forEach((blockquote) => {
          blockquote.classList.add('instagram-wrapper', 'instagram-processed')
        })
      } catch (error) {
        if (__DEV__) {
          console.warn('[StableContent] Error processing Instagram embeds:', error)
        }
      } finally {
        processing = false
      }
    }

    const debouncedProcess = () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      timeoutId = setTimeout(() => {
        processInstagramEmbeds()
        timeoutId = null
      }, 300)
    }

    processInstagramEmbeds()

    const observer = new MutationObserver((mutations) => {
      const hasNewIframes = mutations.some((mutation) => {
        return Array.from(mutation.addedNodes).some((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as Element
            return (
              (el.tagName === 'IFRAME' &&
                (el.getAttribute('src')?.includes('instagram.com') || el.classList.contains('ql-video'))) ||
              el.querySelector?.('iframe[src*="instagram.com"]')
            )
          }
          return false
        })
      })

      if (hasNewIframes) {
        debouncedProcess()
      }
    })

    const richTextContainer = document.querySelector(`.${WEB_RICH_TEXT_CLASS}`)
    if (richTextContainer) {
      observer.observe(richTextContainer, {
        childList: true,
        subtree: true,
      })
    }

    const initialTimeoutId = setTimeout(processInstagramEmbeds, 1000)

    return () => {
      observer.disconnect()
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      clearTimeout(initialTimeoutId)
    }
  }, [prepared])
}
