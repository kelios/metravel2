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

  // Instagram facade → ленивое монтирование настоящего iframe при подходе к вьюпорту.
  // Посты вне экрана (и весь Lighthouse-прогон без скролла) не тянут ~900KB рантайма.
  useEffect(() => {
    if (Platform.OS !== 'web') return
    if (typeof window === 'undefined' || typeof document === 'undefined') return

    const userAgent = String(window.navigator?.userAgent || '')
    const isiOSWebKit =
      /\b(iPhone|iPad|iPod)\b/i.test(userAgent) && /\bAppleWebKit\b/i.test(userAgent)
    // iOS Safari/WKWebView often traps Instagram iframe taps; keep the first-party
    // facade link there so posts open normally and the article text stays responsive.
    if (isiOSWebKit) return

    const isAllowedEmbedSrc = (src: string) => {
      try {
        const url = new URL(src)
        const host = url.hostname.toLowerCase()
        // data-ig-embed приходит из пользовательского HTML — без проверки хоста
        // это обход iframe-allowlist'а sanitizeRichText (произвольный iframe).
        return url.protocol === 'https:' && (host === 'instagram.com' || host === 'www.instagram.com')
      } catch {
        return false
      }
    }

    // Окно (windowing): держим «живыми» не больше CAP эмбедов одновременно. Статья из 39
    // Instagram-постов = 39 кросс-ориджин iframe'ов, если смонтировать все — в медленной
    // сети/регионе страница висит минуту. Поэтому самый дальний от вьюпорта эмбед при
    // выходе за окно сворачиваем обратно в лёгкий facade (он перемонтируется при возврате).
    const CAP = 5
    const mounted: HTMLElement[] = []
    // wrapper → исходный facade-узел (переиспользуем, не пересоздаём из HTML).
    const facadeOf = new Map<HTMLElement, HTMLElement>()

    const distanceFromViewport = (el: HTMLElement, viewportH: number) => {
      const rect = el.getBoundingClientRect()
      const center = rect.top + rect.height / 2
      if (center < 0) return -center
      if (center > viewportH) return center - viewportH
      return 0
    }

    const recycle = (wrapper: HTMLElement) => {
      const idx = mounted.indexOf(wrapper)
      if (idx >= 0) mounted.splice(idx, 1)
      const facade = facadeOf.get(wrapper)
      facadeOf.delete(wrapper)
      if (!facade) {
        wrapper.remove()
        return
      }
      delete facade.dataset.igMounted
      wrapper.replaceWith(facade)
      io?.observe(facade)
    }

    // После каждого монтирования: если живых > CAP — сворачиваем самые дальние от
    // вьюпорта (их перемонтирование при обратном скролле дешевле постоянной нагрузки).
    const enforceCap = () => {
      if (mounted.length <= CAP) return
      const viewportH = window.innerHeight || document.documentElement.clientHeight || 800
      while (mounted.length > CAP) {
        let worst: HTMLElement | null = null
        let worstD = -1
        for (const w of mounted) {
          const d = distanceFromViewport(w, viewportH)
          if (d > worstD) {
            worstD = d
            worst = w
          }
        }
        if (!worst) break
        recycle(worst)
      }
    }

    const mountEmbed = (facade: HTMLElement) => {
      if (facade.dataset.igMounted === '1') return
      const src = facade.getAttribute('data-ig-embed')
      if (!src || !isAllowedEmbedSrc(src)) return
      facade.dataset.igMounted = '1'
      io?.unobserve(facade)

      const wrapper = document.createElement('div')
      wrapper.className = 'instagram-wrapper'

      const iframe = document.createElement('iframe')
      iframe.src = src
      iframe.className = 'instagram-embed instagram-processed'
      iframe.loading = 'lazy'
      iframe.title = 'Instagram post'
      iframe.setAttribute(
        'allow',
        'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
      )
      iframe.setAttribute('allowfullscreen', '')

      wrapper.appendChild(iframe)
      // replaceWith, а не вложение в facade: wrapper повторяет габариты facade
      // (430px, рамка, те же margin), поэтому своп не сдвигает layout. Facade-узел
      // сохраняем — при recycle вернём его на место (с тем же data-ig-embed).
      facadeOf.set(wrapper, facade)
      facade.replaceWith(wrapper)
      mounted.push(wrapper)
      enforceCap()
    }

    const collectFacades = () =>
      Array.from(
        document.querySelectorAll<HTMLElement>(
          `.${WEB_RICH_TEXT_CLASS} .ig-lite:not([data-ig-mounted="1"])`
        )
      )

    const MARGIN = 600

    let io: IntersectionObserver | null = null
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            // mountEmbed сам делает unobserve, чтобы не держать ссылку на
            // detached-node после replaceWith (в т.ч. на пути прямого scan).
            if (entry.isIntersecting) mountEmbed(entry.target as HTMLElement)
          })
        },
        { rootMargin: `${MARGIN}px 0px` }
      )
    }

    // Facade уже в зоне видимости (±MARGIN) монтируем сразу по rect — это надёжнее,
    // чем ждать первого колбэка IO, который в части движков не стреляет для
    // элементов, попавших во вьюпорт ещё до observe.
    const scan = () => {
      const viewportH = window.innerHeight || document.documentElement.clientHeight || 0
      collectFacades().forEach((facade) => {
        const rect = facade.getBoundingClientRect()
        if (rect.top < viewportH + MARGIN && rect.bottom > -MARGIN) {
          mountEmbed(facade)
        } else if (io) {
          io.observe(facade)
        } else {
          mountEmbed(facade)
        }
      })
    }

    // scan() с forced layout не гонять на каждую мутацию (наши же mount/recycle их
    // порождают) — коалесцируем в один прогон на кадр.
    let scanScheduled = false
    const scheduleScan = () => {
      if (scanScheduled) return
      scanScheduled = true
      window.requestAnimationFrame(() => {
        scanScheduled = false
        scan()
      })
    }

    // Observer только на rich-text контейнер: подписка на document.body гоняла бы
    // scan() (с forced layout) на каждую мутацию DOM во всём приложении.
    let mutationObserver: MutationObserver | null = null
    const attachObserver = () => {
      if (mutationObserver) return
      const richTextContainer = document.querySelector(`.${WEB_RICH_TEXT_CLASS}`)
      if (!richTextContainer) return
      mutationObserver = new MutationObserver(() => scheduleScan())
      mutationObserver.observe(richTextContainer, { childList: true, subtree: true })
    }

    scan()
    attachObserver()
    const rafId = window.requestAnimationFrame(() => {
      attachObserver()
      scan()
    })
    const initialTimeoutId = setTimeout(() => {
      attachObserver()
      scan()
    }, 1000)

    return () => {
      window.cancelAnimationFrame(rafId)
      io?.disconnect()
      mutationObserver?.disconnect()
      clearTimeout(initialTimeoutId)
      mounted.length = 0
      facadeOf.clear()
    }
  }, [prepared])
}
