import { useEffect } from 'react'
import { Platform } from 'react-native'

type UseTravelDetailsHeadSyncArgs = {
  canonicalUrl?: string
  isFocused: boolean
  readyDesc: string
  readyImage: string
  readyTitle: string
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
      if (document.documentElement.getAttribute('lang') !== 'ru') {
        document.documentElement.setAttribute('lang', 'ru')
      }
    }

    const patchMeta = (sel: string, attr: string, val: string) => {
      const all = document.querySelectorAll(sel)
      for (let i = 1; i < all.length; i += 1) all[i].remove()
      let el = all[0] ?? null
      if (!el) {
        el = document.createElement('meta')
        const m = sel.match(/\[(\w+)="([^"]+)"\]/)
        if (m) el.setAttribute(m[1], m[2])
        el.setAttribute('data-rh', 'true')
        document.head.appendChild(el)
      }
      if (el.getAttribute(attr) !== val) el.setAttribute(attr, val)
      const deduped = document.querySelectorAll(sel)
      for (let i = 1; i < deduped.length; i += 1) deduped[i].remove()
    }

    const patchCanonical = (href: string) => {
      const sel = 'link[rel="canonical"]'
      const all = document.querySelectorAll(sel)
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

    let isApplying = false

    const applyAll = () => {
      if (isApplying) return
      isApplying = true
      enforceHtmlLang()
      document.title = readyTitle
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
      }
      isApplying = false
    }

    const t1 = setTimeout(applyAll, 50)
    const t2 = setTimeout(applyAll, 300)
    const t3 = setTimeout(applyAll, 800)
    applyAll()

    const titleEl = document.querySelector('title')
    let titleObs: MutationObserver | null = null
    if (titleEl) {
      titleObs = new MutationObserver(() => {
        if (document.title !== readyTitle) {
          document.title = readyTitle
        }
      })
      titleObs.observe(titleEl, { childList: true, characterData: true, subtree: true })
    }

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      titleObs?.disconnect()
    }
  }, [canonicalUrl, isFocused, readyDesc, readyImage, readyTitle, syncNavigationTitle])
}
