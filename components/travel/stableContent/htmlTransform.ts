import { Platform } from 'react-native'

import { normalizeArticleEditorHtmlForInput } from '@/components/article/articleEditorConfig'
import { replaceInstagramEmbedsWithCards } from '@/utils/instagramRichText'
import { sanitizeRichText } from '@/utils/sanitizeRichText'
import { applySmartImageLayout } from '@/utils/richTextImageLayout'
import { guardServerSafeHtml } from '@/utils/serverSafeHtml'

const OPTIMIZATION_PARAMS = ['w', 'h', 'q', 'f', 'fit', 'auto', 'output', 'blur', 'dpr']

export const hasIframe = (html: string) => /<iframe[\s/>]/i.test(html)

export const isYouTubeEmbedUrl = (src: string) => /youtube\.com|youtu\.be/i.test(src)

export const isInstagramEmbedUrl = (src: string) => /instagram\.com/i.test(src)

export const extractFirstImgSrc = (html: string): string | null => {
  const match = html.match(/<img\b[^>]*\bsrc="([^"]+)"/i)
  return match?.[1] ?? null
}

const stripOptimizationParams = (urlStr: string): string => {
  try {
    const url = new URL(urlStr, 'https://metravel.by')
    let changed = false
    for (const param of OPTIMIZATION_PARAMS) {
      if (url.searchParams.has(param)) {
        url.searchParams.delete(param)
        changed = true
      }
    }
    if (!changed) return urlStr
    const clean = url.toString()
    return clean.endsWith('?') ? clean.slice(0, -1) : clean
  } catch {
    return urlStr
  }
}

const isPrivateOrLocalHost = (host: string): boolean => {
  const value = String(host || '').trim().toLowerCase()
  if (!value) return false
  if (value === 'localhost' || value === '127.0.0.1') return true
  if (/^10\./.test(value)) return true
  if (/^192\.168\./.test(value)) return true
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(value)) return true
  return false
}

const normalizeMetravelOwnImageUrl = (urlStr: string): string => {
  try {
    const parsed = new URL(urlStr, 'https://metravel.by')
    const host = parsed.hostname.toLowerCase()
    if (host !== 'metravel.by' && host !== 'cdn.metravel.by' && host !== 'api.metravel.by') {
      return urlStr
    }
    if (parsed.protocol === 'http:') {
      parsed.protocol = 'https:'
      return parsed.toString()
    }
    return urlStr
  } catch {
    return urlStr
  }
}

export const buildWeservProxyUrl = (src: string) => {
  try {
    const trimmed = String(src || '').trim()
    if (!trimmed) return null
    if (trimmed.startsWith('data:')) return trimmed

    const normalized = trimmed.replace(/&amp;/g, '&')
    const isMobileViewport =
      Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      (window.innerWidth || 0) <= 768
    const targetW = isMobileViewport ? 600 : 800

    if (/^https?:\/\/images\.weserv\.nl\//i.test(normalized)) {
      try {
        const url = new URL(normalized)
        const innerUrl = url.searchParams.get('url')
        if (innerUrl) {
          const cleanInner = stripOptimizationParams(
            innerUrl.startsWith('//')
              ? `https:${innerUrl}`
              : innerUrl.includes('://')
                ? innerUrl
                : `https://${innerUrl}`
          ).replace(/^https?:\/\//i, '')
          url.searchParams.set('url', cleanInner)
        }
        url.searchParams.set('w', String(targetW))
        url.searchParams.set('q', '60')
        if (!url.searchParams.has('output')) url.searchParams.set('output', 'webp')
        return url.toString()
      } catch {
        return normalized
      }
    }

    let parsedUrl: URL | null = null
    try {
      parsedUrl = new URL(normalized, 'https://metravel.by')
    } catch {
      parsedUrl = null
    }

    if (parsedUrl) {
      const host = parsedUrl.hostname.toLowerCase()
      if (isPrivateOrLocalHost(host)) {
        return normalized
      }
      if (host === 'metravel.by' || host === 'cdn.metravel.by' || host === 'api.metravel.by') {
        return normalizeMetravelOwnImageUrl(stripOptimizationParams(normalized))
      }
    }

    const cleaned = stripOptimizationParams(normalized)
    const withoutScheme = cleaned.replace(/^https?:\/\//i, '')
    return `https://images.weserv.nl/?url=${encodeURIComponent(withoutScheme)}&w=${targetW}&q=60&output=webp&fit=inside`
  } catch {
    return null
  }
}

// Первопартийные metravel-картинки описания сервер режет по «лестнице» ширин 320/480/640/720
// (те же ступени, что у hero/gallery). Раньше normalizeImgTags отдавал оригинал (params
// стриплись) — description-картинки грузились по 200-360KiB. Строим srcset по лестнице, чтобы
// браузер тянул под свой вьюпорт (#815).
const RESPONSIVE_WIDTHS = [320, 480, 640, 720]
const RESPONSIVE_SIZES = '(max-width: 768px) 100vw, 720px'
const RESPONSIVE_QUALITY = 72

// Body-article images beyond this lead count are network-gated on web: native
// loading="lazy" widens its fetch-ahead distance on slow connections (Chrome
// preloads farther when the link is slow), so ~20 body images all start at once
// and starve the same-origin hero-swipe request under a narrow mobile pipe. We
// hold their real src in data-lazy-* and let useWebEffects swap it in via an IO
// with a tight rootMargin + a concurrency cap. The first EAGER_LEAD keep a real
// src for LCP/above-the-fold and SSG crawlers.
const EAGER_LEAD_IMAGE_COUNT = 2
// 1×1 transparent GIF: reserves nothing itself; the box height comes from the
// width/height attrs + inline aspect-ratio, so gating adds no layout shift.
const LAZY_IMAGE_PLACEHOLDER =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

const addTokenToImgClass = (tag: string, className: string): string => {
  if (/\bclass="/i.test(tag)) {
    return tag.replace(/\bclass="([^"]*)"/i, (_m, current: string) => `class="${`${current} ${className}`.trim()}"`)
  }
  return tag.replace(/<img\b/i, `<img class="${className}"`)
}

// Defer the real download: move src -> data-lazy-src (and srcset -> data-lazy-srcset),
// paint the transparent placeholder, tag with .rich-lazy-img for the IO gate.
const deferBodyImageDownload = (tag: string): string => {
  const src = tag.match(/\bsrc="([^"]*)"/i)?.[1] ?? ''
  if (!src || src.startsWith('data:')) return tag
  let next = tag.replace(
    /\bsrc="[^"]*"/i,
    `src="${LAZY_IMAGE_PLACEHOLDER}" data-lazy-src="${src}"`
  )
  next = next.replace(/\bsrcset="([^"]*)"/i, (_m, value: string) => `data-lazy-srcset="${value}"`)
  return addTokenToImgClass(next, 'rich-lazy-img')
}

const isFirstPartyMetravelHost = (host: string): boolean => {
  const value = String(host || '').toLowerCase()
  return value === 'metravel.by' || value === 'cdn.metravel.by' || value === 'api.metravel.by'
}

const buildMetravelSizedUrl = (base: URL, width: number): string => {
  const url = new URL(base.toString())
  url.searchParams.set('w', String(width))
  url.searchParams.set('q', String(RESPONSIVE_QUALITY))
  url.searchParams.set('fit', 'contain')
  return url.toString()
}

type ResponsiveImage = { src: string; srcSet: string; sizes: string }

const buildMetravelResponsiveImage = (src: string): ResponsiveImage | null => {
  try {
    const trimmed = String(src || '').trim()
    if (!trimmed || trimmed.startsWith('data:')) return null
    const parsed = new URL(trimmed.replace(/&amp;/g, '&'), 'https://metravel.by')
    if (!isFirstPartyMetravelHost(parsed.hostname)) return null
    if (parsed.protocol === 'http:') parsed.protocol = 'https:'
    // сбрасываем ранее заданные размеры, сохраняя cache-buster `v`
    for (const param of OPTIMIZATION_PARAMS) parsed.searchParams.delete(param)
    const srcSet = RESPONSIVE_WIDTHS.map((w) => `${buildMetravelSizedUrl(parsed, w)} ${w}w`).join(', ')
    return { src: buildMetravelSizedUrl(parsed, 720), srcSet, sizes: RESPONSIVE_SIZES }
  } catch {
    return null
  }
}

const stripDangerousTags = (html: string) =>
  html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')

const appendClass = (attrs: string, className: string) => {
  if (!attrs) return ` class="${className}"`
  if (/\bclass="/i.test(attrs)) {
    return attrs.replace(/class="([^"]*)"/i, (_, current) => `class="${`${current} ${className}`.trim()}"`)
  }
  return `${attrs} class="${className}"`
}

const appendInlineStyle = (attrs: string, declaration: string) => {
  if (!attrs) return ` style="${declaration}"`
  const styleMatch = attrs.match(/\bstyle="([^"]*)"/i)
  if (!styleMatch) {
    return `${attrs} style="${declaration}"`
  }
  const current = styleMatch[1] || ''
  if (current.includes(declaration)) {
    return attrs
  }
  const nextStyle = current.trim().replace(/;$/, '')
  const merged = nextStyle ? `${nextStyle};${declaration}` : declaration
  return attrs.replace(styleMatch[0], `style="${merged}"`)
}

const escapeHtmlAttr = (value: string) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const buildRichImageBackdropDeclaration = (src: string) => {
  // CSS-escape for the url('...') context, then HTML-escape so the declaration is safe to
  // place inside a style="..." attribute without breaking out of the attribute or the tag.
  const cssSafe = String(src || '').trim().replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  if (!cssSafe) return ''
  return escapeHtmlAttr(`--travel-rich-image:url('${cssSafe}')`)
}

const buildRichImageAspectDeclaration = (imgMarkup: string) => {
  const width = Number(imgMarkup.match(/\bwidth="(\d+)"/i)?.[1] ?? 0)
  const height = Number(imgMarkup.match(/\bheight="(\d+)"/i)?.[1] ?? 0)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return ''
  }
  return `--travel-rich-image-aspect:${width}/${height}`
}

const buildRichImageFrameDeclaration = (src: string, imgMarkup: string) => {
  return [buildRichImageBackdropDeclaration(src), buildRichImageAspectDeclaration(imgMarkup)]
    .filter(Boolean)
    .join(';')
}

const normalizeImgTags = (html: string): string => {
  let imgIdx = 0
  return html.replace(/<img\b[^>]*?>/gi, (tag) => {
    const src = tag.match(/\bsrc="([^"]+)"/i)?.[1] ?? ''
    const responsive = src ? buildMetravelResponsiveImage(src) : null
    const optimizedSrc = responsive?.src ?? (src ? buildWeservProxyUrl(src) || src : src)
    let width = tag.match(/\bwidth="(\d+)"/i)?.[1]
    let height = tag.match(/\bheight="(\d+)"/i)?.[1]

    if (!width || !height) {
      const wh = src.match(/[-_](\d{2,5})x(\d{2,5})\.(?:jpe?g|png|webp|avif)(?:\?|$)/i)
      if (wh) {
        width = width || wh[1]
        height = height || wh[2]
      }
    }

    const finalW = width || 800
    const finalH = height || 450

    const styleMatch = tag.match(/\bstyle="([^"]*)"/i)
    const style = styleMatch?.[1] ?? ''
    const aspectRule = `aspect-ratio:${finalW}/${finalH}`
    const ensured = ['display:block', 'height:auto', 'margin:0 auto', aspectRule]
      .filter(Boolean)
      .reduce((acc, rule) => (acc.includes(rule) ? acc : acc ? `${acc};${rule}` : rule), style)

    let out = tag.replace(styleMatch ? styleMatch[0] : '', '').replace(/>$/, ` style="${ensured}">`)
    out = out
      .replace(/\bsrc="[^"]*"/i, optimizedSrc ? `src="${escapeHtmlAttr(optimizedSrc)}"` : '')
      .replace(/\bsrcset="[^"]*"/i, '')
      .replace(/\bsizes="[^"]*"/i, '')
      .replace(/\bwidth="[^"]*"/i, '')
      .replace(/\bheight="[^"]*"/i, '')

    if (responsive) {
      out = out.replace(
        />$/,
        ` srcset="${escapeHtmlAttr(responsive.srcSet)}" sizes="${escapeHtmlAttr(responsive.sizes)}">`
      )
    }

    out = out.replace(/>$/, ` width="${finalW}" height="${finalH}">`)
    out = out
      .replace(/\bdecoding="[^"]*"/i, '')
      .replace(/\bfetchpriority="[^"]*"/i, '')
      .replace(/\bloading="[^"]*"/i, '')

    const fallbackAlt = `Изображение маршрута ${imgIdx + 1}`
    const altMatch = out.match(/\balt="([^"]*)"/i)
    if (!altMatch) {
      out = out.replace(/>$/, ` alt="${fallbackAlt}">`)
    } else if (!altMatch[1].trim()) {
      out = out.replace(/\balt="[^"]*"/i, `alt="${fallbackAlt}"`)
    }

    out = out.replace(/>$/, ' loading="lazy" decoding="async" fetchpriority="low">')
    if (Platform.OS === 'web' && imgIdx >= EAGER_LEAD_IMAGE_COUNT) {
      out = deferBodyImageDownload(out)
    }
    imgIdx += 1
    return out
  })
}

const replaceYouTubeIframes = (html: string): string =>
  html.replace(/<iframe\b[^>]*src="([^"]+)"[^>]*><\/iframe>/gi, (full, src: string) => {
    if (!isYouTubeEmbedUrl(src)) return full
    const id =
      src.match(/[?&]v=([a-z0-9_-]{6,})/i)?.[1] ||
      src.match(/youtu\.be\/([a-z0-9_-]{6,})/i)?.[1]
    if (!id) return full
    return `
<div class="yt-lite" data-yt="${id}"
     style="position:relative;aspect-ratio:16/9;background:var(--color-backgroundTertiary);border-radius:12px;overflow:hidden;margin:16px 0">
  <img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg"
       width="1280" height="720"
       alt="YouTube preview" loading="lazy" decoding="async"
       style="width:100%;height:100%;object-fit:cover;display:block"/>
  <div role="button" tabindex="0" aria-label="Смотреть видео"
    style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:transparent;cursor:pointer">
    <span style="width:68px;height:48px;background:var(--color-overlay);clip-path:polygon(20% 10%,20% 90%,85% 50%);"></span>
  </div>
</div>`
  })

const stripTags = (value: string) => value.replace(/<[^>]+>/g, '')

const decodeEntities = (value: string) =>
  value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")

const encodeEntities = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const injectAutoHeadingAnchors = (html: string) => {
  if (!html) return html

  const orderedHashIds = Array.from(
    html.matchAll(/<a\b[^>]*href=(["'])#([^"'#?]+)\1[^>]*>/gi),
    (match) => String(match[2] || '').trim()
  ).filter(Boolean)
  const uniqueOrderedHashIds = orderedHashIds.filter((id, index) => orderedHashIds.indexOf(id) === index)

  return html.replace(/<h([1-3])([^>]*)>([\s\S]*?)<\/h\1>/gi, (full, level, rawAttrs, inner) => {
    const attrs = String(rawAttrs || '')
    if (/\bid\s*=\s*"[^"]+"/i.test(attrs)) return full

    const innerText = decodeEntities(String(inner || '').replace(/<[^>]+>/g, '').trim())
    const match = innerText.match(/^(\d{1,3})[.)]\s+/)
    if (!match) return full

    const orderedId = uniqueOrderedHashIds[Number(match[1]) - 1]
    const id = orderedId || `part${match[1]}`
    const nextAttrs = attrs ? `${attrs} id="${id}"` : ` id="${id}"`
    return `<h${level}${nextAttrs}>${inner}</h${level}>`
  })
}

const sliceText = (text: string, limit: number) => {
  const chars = Array.from(text)
  if (chars.length <= limit) {
    return { text, truncated: false }
  }
  return {
    text: chars.slice(0, limit).join('').trimEnd(),
    truncated: true,
  }
}

const truncateInstagramCaptions = (html: string) => {
  return html.replace(/<p([^>]*)>([\s\S]*?)<\/p>/gi, (match, attrs = '', inner = '') => {
    const plain = decodeEntities(stripTags(inner)).trim()
    if (!plain.startsWith('@') || plain.length <= 100) return match

    const handleMatch = inner.match(/^(\s*@\s*(?:<a[\s\S]+?<\/a>|[\w.@]+))(.*)$/i)
    let nextInner = inner
    if (handleMatch) {
      const handleHtml = handleMatch[1]
      const restHtml = handleMatch[2] || ''
      const handlePlain = decodeEntities(stripTags(handleHtml)).trim()
      const restPlain = decodeEntities(stripTags(restHtml)).trim()
      const remaining = Math.max(0, 100 - handlePlain.length - 1)
      const { text, truncated } = sliceText(restPlain, remaining)
      const spacer = text ? '&nbsp;' : ''
      nextInner = `${handleHtml}${spacer}<span class="instagram-caption-text">${encodeEntities(text)}${truncated ? '…' : ''}</span>`
    } else {
      const { text, truncated } = sliceText(plain, 100)
      nextInner = `${encodeEntities(text)}${truncated ? '…' : ''}`
    }

    return `<p${appendClass(attrs, 'instagram-caption')}>${nextInner}</p>`
  })
}

const replaceStandaloneInstagramLinks = (html: string) =>
  html.replace(
    /<p([^>]*)>\s*<a\b[^>]*href=(["'])(https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel)\/[A-Za-z0-9_-]+\/?)\2[^>]*>\s*\3\s*<\/a>\s*<\/p>/gi,
    (_match, attrs = '', _quote = '', url = '') => {
      const cleanUrl = String(url).replace(/\/+$/, '')
      const embedUrl = `${cleanUrl}/embed/captioned/`
      return `<p${attrs}><iframe class="ql-video" frameborder="0" allowfullscreen="true" src="${embedUrl}" height="640"></iframe></p>`
    }
  )

const decorateRichImageFrames = (html: string) => {
  if (!html) return html

  const decorateAttrs = (attrs: string, src: string, imgMarkup: string) => {
    const nextClassAttrs = appendClass(attrs, 'rich-image-frame')
    // A network-gated image carries a transparent placeholder as its src; pointing
    // the blur-backdrop CSS var at the real url here would defeat the gate (the
    // ::before background would fetch it immediately). Keep only the aspect box —
    // useWebEffects sets --travel-rich-image on the frame when the image swaps in.
    const isDeferred = /\bdata-lazy-src="/i.test(imgMarkup)
    const frameDeclaration = isDeferred
      ? buildRichImageAspectDeclaration(imgMarkup)
      : buildRichImageFrameDeclaration(src, imgMarkup)
    return frameDeclaration
      ? appendInlineStyle(nextClassAttrs, frameDeclaration)
      : nextClassAttrs
  }

  return html
    .replace(
      /<p([^>]*)>(\s*<img\b[^>]*\bsrc="([^"]+)"[^>]*>\s*(?:<br\s*\/?>\s*)?)<\/p>/gi,
      (match, attrs = '', inner = '', src = '') => `<p${decorateAttrs(attrs, src, inner)}>${inner}</p>`
    )
    .replace(
      /<figure([^>]*)>([\s\S]*?<img\b[^>]*\bsrc="([^"]+)"[^>]*>[\s\S]*?)<\/figure>/gi,
      (match, attrs = '', inner = '', src = '') => `<figure${decorateAttrs(attrs, src, inner)}>${inner}</figure>`
    )
}

export type PrepareStableContentHtmlOptions = {
  // true — html уже canonical rich_text.*.safe_html с бэка (#709): полный
  // normalize+sanitize pipeline не запускается, остаётся только дешёвый guard.
  serverSanitized?: boolean
}

export const prepareStableContentHtml = (html: string, options?: PrepareStableContentHtmlOptions) => {
  const serverSanitized = options?.serverSanitized === true
  const normalizedEmbeds = serverSanitized
    ? guardServerSafeHtml(html)
    : normalizeArticleEditorHtmlForInput(html)
  const isWeb = Platform.OS === 'web' || typeof document !== 'undefined'
  // На web: вместо живого iframe (каждый тянет ~целый Instagram-рантайм, ~900KB/десятки
  // запросов на статью) — лёгкий facade, настоящий iframe монтируется лениво при подходе
  // к вьюпорту (useStableContentWebEffects). На native — статическая карточка-ссылка.
  const instagramSafeHtml = replaceInstagramEmbedsWithCards(normalizedEmbeds, {
    iframeStrategy: isWeb ? 'facade' : 'card',
  })
  const safe = serverSanitized ? instagramSafeHtml : sanitizeRichText(instagramSafeHtml)
  const normalizedBase = replaceYouTubeIframes(normalizeImgTags(stripDangerousTags(safe)))
  const normalized = Platform.OS === 'web'
    ? normalizedBase
    : replaceStandaloneInstagramLinks(normalizedBase)
  const demoted = normalized
    .replace(/<\s*h1(\b[^>]*)>/gi, '<h2$1>')
    .replace(/<\s*\/\s*h1\s*>/gi, '</h2>')
  const truncated = truncateInstagramCaptions(demoted)
  return injectAutoHeadingAnchors(decorateRichImageFrames(applySmartImageLayout(truncated)))
}
