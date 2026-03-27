import { Platform } from 'react-native'

import { sanitizeRichText } from '@/utils/sanitizeRichText'
import { applySmartImageLayout } from '@/utils/richTextImageLayout'

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

const buildRichImageBackdropDeclaration = (src: string) => {
  const safeSrc = String(src || '').trim().replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  return safeSrc ? `--travel-rich-image:url('${safeSrc}')` : ''
}

const normalizeImgTags = (html: string): string => {
  let imgIdx = 0
  return html.replace(/<img\b[^>]*?>/gi, (tag) => {
    const src = tag.match(/\bsrc="([^"]+)"/i)?.[1] ?? ''
    const optimizedSrc = src ? buildWeservProxyUrl(src) || src : src
    let width = tag.match(/\bwidth="(\d+)"/i)?.[1]
    let height = tag.match(/\bheight="(\d+)"/i)?.[1]

    if (!width || !height) {
      const wh = src.match(/[-_](\d{2,5})x(\d{2,5})\.(?:jpe?g|png|webp|avif)(?:\?|$)/i)
      if (wh) {
        width = width || wh[1]
        height = height || wh[2]
      }
    }

    const styleMatch = tag.match(/\bstyle="([^"]*)"/i)
    const style = styleMatch?.[1] ?? ''
    const aspectRule = width && height ? `aspect-ratio:${width}/${height}` : ''
    const ensured = ['display:block', 'height:auto', 'margin:0 auto', aspectRule]
      .filter(Boolean)
      .reduce((acc, rule) => (acc.includes(rule) ? acc : acc ? `${acc};${rule}` : rule), style)

    let out = tag.replace(styleMatch ? styleMatch[0] : '', '').replace(/>$/, ` style="${ensured}">`)
    out = out
      .replace(/\bsrc="[^"]*"/i, optimizedSrc ? `src="${optimizedSrc.replace(/"/g, '&quot;')}"` : '')
      .replace(/\bsrcset="[^"]*"/i, '')
      .replace(/\bsizes="[^"]*"/i, '')
      .replace(/\bwidth="[^"]*"/i, '')
      .replace(/\bheight="[^"]*"/i, '')

    const finalW = width || 800
    const finalH = height || 450
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

const decorateRichImageFrames = (html: string) => {
  if (!html) return html

  const decorateAttrs = (attrs: string, src: string) => {
    const nextClassAttrs = appendClass(attrs, 'rich-image-frame')
    const backdropDeclaration = buildRichImageBackdropDeclaration(src)
    return backdropDeclaration
      ? appendInlineStyle(nextClassAttrs, backdropDeclaration)
      : nextClassAttrs
  }

  return html
    .replace(
      /<p([^>]*)>(\s*<img\b[^>]*\bsrc="([^"]+)"[^>]*>\s*(?:<br\s*\/?>\s*)?)<\/p>/gi,
      (match, attrs = '', inner = '', src = '') => `<p${decorateAttrs(attrs, src)}>${inner}</p>`
    )
    .replace(
      /<figure([^>]*)>([\s\S]*?<img\b[^>]*\bsrc="([^"]+)"[^>]*>[\s\S]*?)<\/figure>/gi,
      (match, attrs = '', inner = '', src = '') => `<figure${decorateAttrs(attrs, src)}>${inner}</figure>`
    )
}

export const prepareStableContentHtml = (html: string) => {
  const safe = sanitizeRichText(html)
  const normalized = replaceYouTubeIframes(normalizeImgTags(stripDangerousTags(safe)))
  const demoted = normalized
    .replace(/<\s*h1(\b[^>]*)>/gi, '<h2$1>')
    .replace(/<\s*\/\s*h1\s*>/gi, '</h2>')
  const truncated = truncateInstagramCaptions(demoted)
  return decorateRichImageFrames(applySmartImageLayout(truncated))
}
