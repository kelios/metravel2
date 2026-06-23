import { DESIGN_TOKENS } from '@/constants/designSystem'
import { escapeHtml } from '@/utils/htmlUtils'

type RichTextColors = {
  text: string
  textMuted: string
  primary?: string
  primaryText?: string
  borderLight: string
  surface: string
  surfaceMuted: string
  boxShadows?: {
    light?: string
  }
}

type InstagramTarget = {
  canonicalUrl: string
  kind: 'post' | 'reel' | 'tv' | 'story'
  title: string
  subtitle: string
}

type InstagramIframeStrategy = 'card' | 'facade'

type ReplaceInstagramEmbedsOptions = {
  iframeStrategy?: InstagramIframeStrategy
}

const INSTAGRAM_URL_RE = /https?:\/\/(?:www\.)?instagram\.com\/[^\s"'<>]+/i

const decodeEntities = (value: string) =>
  value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")

const normalizeUrlScheme = (value: string) => {
  const trimmed = String(value || '').trim()
  return trimmed.startsWith('//') ? `https:${trimmed}` : trimmed
}

const encodeHtml = escapeHtml

function normalizeInstagramUrl(rawUrl: string): string {
  const normalized = normalizeUrlScheme(decodeEntities(rawUrl))
  if (!normalized) return ''

  try {
    const parsed = new URL(normalized)
    parsed.pathname = parsed.pathname
      .replace(/\/embed\/captioned\/?$/i, '/')
      .replace(/\/embed\/?$/i, '/')
    return parsed.toString()
  } catch {
    return normalized
      .replace(/\/embed\/captioned\/?(?=[?#]|$)/i, '/')
      .replace(/\/embed\/?(?=[?#]|$)/i, '/')
  }
}

export function resolveInstagramTarget(rawUrl: string): InstagramTarget | null {
  const candidate = normalizeInstagramUrl(rawUrl)
  if (!candidate) return null

  try {
    const parsed = new URL(candidate)
    const host = parsed.hostname.toLowerCase()
    if (host !== 'instagram.com' && host !== 'www.instagram.com') return null

    const segments = parsed.pathname.split('/').filter(Boolean)
    if (segments.length < 2) return null

    const first = String(segments[0] || '').toLowerCase()
    const second = String(segments[1] || '')
    const third = String(segments[2] || '')

    if ((first === 'p' || first === 'reel' || first === 'tv') && second) {
      const canonicalUrl = `https://www.instagram.com/${first}/${second}/`
      const labels = {
        p: {
          title: 'Публикация в Instagram',
          subtitle: 'Открыть пост в Instagram',
        },
        reel: {
          title: 'Reel в Instagram',
          subtitle: 'Открыть reel в Instagram',
        },
        tv: {
          title: 'Видео в Instagram',
          subtitle: 'Открыть видео в Instagram',
        },
      } as const

      return {
        canonicalUrl,
        kind: first === 'p' ? 'post' : first,
        title: labels[first].title,
        subtitle: labels[first].subtitle,
      }
    }

    if (first === 'stories' && second && third) {
      if (second.toLowerCase() === 'highlights') {
        return {
          canonicalUrl: `https://www.instagram.com/stories/highlights/${third}/`,
          kind: 'story',
          title: 'Актуальное в Instagram',
          subtitle: 'Открыть актуальное в Instagram',
        }
      }

      return {
        canonicalUrl: `https://www.instagram.com/stories/${second}/${third}/`,
        kind: 'story',
        title: `История @${encodeHtml(second)} в Instagram`,
        subtitle: 'Открыть историю в Instagram',
      }
    }

    return null
  } catch {
    return null
  }
}

export function buildInstagramCardHtml(rawUrl: string): string | null {
  const target = resolveInstagramTarget(rawUrl)
  if (!target) return null

  return [
    '<div class="rich-social-card rich-social-card--instagram">',
    '<div class="rich-social-card__eyebrow">Instagram</div>',
    `<a class="rich-social-card__title" href="${encodeHtml(target.canonicalUrl)}" target="_blank" rel="noopener noreferrer nofollow">${target.title}</a>`,
    `<div class="rich-social-card__caption">${target.subtitle}</div>`,
    '</div>',
  ].join('')
}

function buildInstagramEmbedSrc(canonicalUrl: string): string {
  return `${canonicalUrl.replace(/\/$/, '')}/embed/?omitscript=true&hidecaption=1`
}

export function buildInstagramFacadeHtml(rawUrl: string): string | null {
  const target = resolveInstagramTarget(rawUrl)
  if (!target) return null
  // У stories нет /embed/-endpoint'а — ленивый iframe показал бы страницу ошибки.
  if (target.kind === 'story') return buildInstagramCardHtml(rawUrl)

  const embedSrc = buildInstagramEmbedSrc(target.canonicalUrl)

  // Keep this as a first-party facade. Instagram embed URLs can return a cross-origin
  // HTML "5xx Server Error" inside iframes, and browsers do not expose that status.
  return [
    `<div class="ig-lite" data-ig-embed="${encodeHtml(embedSrc)}">`,
    '<div class="ig-lite__inner">',
    '<div class="ig-lite__eyebrow">Instagram</div>',
    `<a class="ig-lite__title" href="${encodeHtml(target.canonicalUrl)}" target="_blank" rel="noopener noreferrer nofollow">${target.title}</a>`,
    `<div class="ig-lite__hint">${target.subtitle}</div>`,
    '</div>',
    '</div>',
  ].join('')
}

function replaceStandaloneInstagramBlocks(html: string): string {
  return html.replace(
    /<(p|div)([^>]*)>\s*(?:<a\b[^>]*href=(['"])(https?:\/\/(?:www\.)?instagram\.com\/[^'"<>\s]+)\3[^>]*>[\s\S]*?<\/a>|(https?:\/\/(?:www\.)?instagram\.com\/[^\s<]+))\s*<\/\1>/gi,
    (full, _tag = '', _attrs = '', _quote = '', href = '', rawUrl = '') => {
      const card = buildInstagramCardHtml(String(href || rawUrl || ''))
      return card ?? full
    },
  )
}

function replaceInstagramIframes(
  html: string,
  build: (src: string) => string | null = buildInstagramCardHtml,
): string {
  return html.replace(/<iframe\b([^>]*?)(?:\/>|>[\s\S]*?<\/iframe>)/gi, (full, rawAttrs = '') => {
    const attrs = String(rawAttrs || '')
    const src = attrs.match(/\ssrc=(['"])(.*?)\1/i)?.[2] ?? ''
    if (!/instagram\.com/i.test(src)) return full
    return build(src) ?? full
  })
}

function replaceInstagramBlockquotes(html: string): string {
  return html.replace(
    /<blockquote\b([^>]*)class=(['"])[^'"]*instagram-media[^'"]*\2([^>]*)>[\s\S]*?<\/blockquote>/gi,
    (full, before = '', _quote = '', after = '') => {
      const attrs = `${String(before || '')} ${String(after || '')}`
      const permalink =
        attrs.match(/\b(?:data-instgrm-permalink|cite)=(['"])(.*?)\1/i)?.[2] ?? ''
      const card = buildInstagramCardHtml(permalink)
      return card ?? full
    },
  )
}

export function replaceInstagramEmbedsWithCards(
  html: string,
  options: ReplaceInstagramEmbedsOptions = {},
): string {
  const initial = String(html || '')
  if (!initial.trim()) return initial

  const strategy: InstagramIframeStrategy = options.iframeStrategy ?? 'card'

  let next = replaceInstagramIframes(
    initial,
    strategy === 'facade' ? buildInstagramFacadeHtml : buildInstagramCardHtml,
  )
  next = replaceInstagramBlockquotes(next)
  next = replaceStandaloneInstagramBlocks(next)

  const trimmed = decodeEntities(next.trim())
  if (!/<[a-z][\s\S]*>/i.test(trimmed) && INSTAGRAM_URL_RE.test(trimmed)) {
    return buildInstagramCardHtml(trimmed) ?? next
  }

  return next
}

export function getInstagramCardStyles(scopeSelector: string, colors: RichTextColors): string {
  const linkColor = colors.primaryText || colors.primary || colors.text

  return `
${scopeSelector} .rich-social-card {
  width: min(100%, 430px);
  max-width: 430px;
  margin: ${DESIGN_TOKENS.spacing.md}px auto ${DESIGN_TOKENS.spacing.lg}px;
  padding: 18px 18px 16px;
  border-radius: 22px;
  border: 1px solid ${colors.borderLight};
  background: linear-gradient(180deg, ${colors.surface} 0%, ${colors.surfaceMuted} 100%);
  box-shadow: ${colors.boxShadows?.light || 'none'};
  overflow: hidden;
}

${scopeSelector} .rich-social-card__eyebrow {
  margin: 0 0 8px;
  font-size: 12px;
  line-height: 1.35;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${colors.textMuted};
}

${scopeSelector} .rich-social-card__title {
  display: inline-block;
  margin: 0;
  color: ${linkColor};
  font-size: 18px;
  line-height: 1.35;
  font-weight: 600;
  text-decoration: none;
}

${scopeSelector} .rich-social-card__title:hover,
${scopeSelector} .rich-social-card__title:focus-visible {
  text-decoration: underline;
}

${scopeSelector} .rich-social-card__caption {
  margin: 10px 0 0;
  color: ${colors.textMuted};
  font-size: 14px;
  line-height: 1.45;
}
`
}
