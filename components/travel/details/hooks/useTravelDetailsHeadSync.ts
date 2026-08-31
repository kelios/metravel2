import { useEffect } from 'react'
import { Platform } from 'react-native'

import { ensureSingleTitleTag } from '@/utils/seo'
import { DEFAULT_LOCALE, i18n } from '@/i18n'

type UseTravelDetailsHeadSyncArgs = {
  canonicalUrl?: string
  isFocused: boolean
  readyDesc: string | null
  readyImage: string
  readyTitle: string | null
  syncNavigationTitle: (title: string) => void
}

export function useTravelDetailsHeadSync({
  canonicalUrl,
  isFocused,
  readyDesc,
  readyImage,
  readyTitle,
  syncNavigationTitle,
}: UseTravelDetailsHeadSyncArgs) {
  useEffect(() => {
    if (!readyTitle || readyTitle === 'Metravel') return undefined
    if (!isFocused) return undefined

    syncNavigationTitle(readyTitle)

    if (Platform.OS !== 'web' || typeof document === 'undefined') return undefined

    const enforceHtmlLang = () => {
      const documentLocale = i18n.resolvedLanguage || DEFAULT_LOCALE
      if (document.documentElement.getAttribute('lang') !== documentLocale) {
        document.documentElement.setAttribute('lang', documentLocale)
      }
    }

    const patchMeta = (sel: string, attr: string, val: string) => {
      // Runtime metadata is owned by <head>; deliberately ignore invalid
      // lookalikes in <body>. Whole-document scans traversed the 50-KB hydrated
      // article repeatedly and cost 22.6 ms in the #1643 mobile profile.
      const all = document.head.querySelectorAll(sel)
      for (let i = 1; i < all.length; i += 1) all[i].remove()
      let el = all[0] ?? null
      if (!el) {
        el = document.createElement('meta')
        const m = sel.match(/\[(\w+)="([^"]+)"]/)
        if (m) el.setAttribute(m[1], m[2])
        el.setAttribute('data-rh', 'true')
        document.head.appendChild(el)
      }
      if (el.getAttribute(attr) !== val) el.setAttribute(attr, val)
    }

    const patchCanonical = (href: string) => {
      const sel = 'link[rel="canonical"]'
      const all = document.head.querySelectorAll(sel)
      for (let i = 1; i < all.length; i += 1) all[i].remove()
      let el = all[0] as HTMLLinkElement | undefined
      if (!el) {
        el = document.createElement('link')
        el.setAttribute('rel', 'canonical')
        el.setAttribute('data-rh', 'true')
        document.head.appendChild(el)
      }
      if (el.getAttribute('href') !== href) el.setAttribute('href', href)
    }

    const dedupeTravelJsonLd = () => {
      // #1622: the SSG build also embeds a bootstrap Article payload marked
      // `data-seo-jsonld="travel-article"` (no `id`) so crawlers see valid
      // structured data before any JS runs. That marker is a different
      // selector from the managed `#travel-article-jsonld` tag Helmet mounts,
      // so the two lived side by side after hydration — one static Article,
      // one runtime Article. Querying both selectors together lets a single
      // dedupe pass own every Article copy regardless of which one wrote it.
      const scripts = Array.from(
        document.head.querySelectorAll<HTMLScriptElement>(
          [
            'script#travel-article-jsonld[type="application/ld+json"]',
            'script[data-seo-jsonld="travel-article"][type="application/ld+json"]',
          ].join(', '),
        ),
      )
      if (scripts.length <= 1) return

      // The early travel preload publishes a lightweight JSON-LD tag before
      // hydration. Once Helmet mounts the richer graph, keep its managed tag
      // and remove every other Article copy — static or preload — so the
      // document has one owner and one id.
      const managedScript = scripts.find((script) => script.getAttribute('data-rh') === 'true')
      const scriptToKeep = managedScript ?? scripts[scripts.length - 1]
      scripts.forEach((script) => {
        if (script !== scriptToKeep) script.remove()
      })
    }

    const applyAll = () => {
      enforceHtmlLang()
      ensureSingleTitleTag(readyTitle)
      patchMeta('meta[property="og:title"]', 'content', readyTitle)
      patchMeta('meta[name="twitter:title"]', 'content', readyTitle)
      if (readyDesc) {
        patchMeta('meta[name="description"]', 'content', readyDesc)
        patchMeta('meta[property="og:description"]', 'content', readyDesc)
        patchMeta('meta[name="twitter:description"]', 'content', readyDesc)
      }
      if (readyImage) {
        patchMeta('meta[property="og:image"]', 'content', readyImage)
        patchMeta('meta[name="twitter:image"]', 'content', readyImage)
      }
      if (canonicalUrl) {
        patchCanonical(canonicalUrl)
      } else {
        // #1438: canonical теперь может отсутствовать вовсе — у статьи нет
        // пригодного слага, а числовую форму адреса публиковать нельзя (#1512).
        // Без этой ветки на SPA-переходе в голове оставался бы тег предыдущей
        // статьи, то есть страница объявляла бы своим чужой адрес — хуже, чем
        // не объявлять никакого.
        document.head.querySelectorAll('link[rel="canonical"]').forEach((node) => node.remove())
      }
      dedupeTravelJsonLd()
    }

    applyAll()
    const observer = new MutationObserver(applyAll)
    observer.observe(document.head, { childList: true })
    const timeout = window.setTimeout(() => observer.disconnect(), 5000)

    return () => {
      window.clearTimeout(timeout)
      observer.disconnect()
    }
  }, [canonicalUrl, isFocused, readyDesc, readyImage, readyTitle, syncNavigationTitle])
}
