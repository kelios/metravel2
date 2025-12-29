import sanitizeHtml, { Attributes } from 'sanitize-html'

const ALLOWED_IFRAME_HOSTS = [
  'youtube.com',
  'youtu.be',
  'player.vimeo.com',
  'www.google.com',
  'instagram.com',
]
const ALLOWED_SCHEMES = ['http', 'https', 'mailto']
const DIMENSION_RE = /^\d+(\.\d+)?(px|%)?$/i
const COLOR_RE =
  /^(#[0-9a-f]{3,4}|#[0-9a-f]{6}|#[0-9a-f]{8}|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*(0|1|0?\.\d+)\s*)?\)|transparent)$/i
const LENGTH_TOKEN = '-?\\d+(?:\\.\\d+)?(?:px|em|rem|%|pt)?'
const MARGIN_TOKEN = `(?:${LENGTH_TOKEN}|auto)`
const MARGIN_RE = new RegExp(`^${MARGIN_TOKEN}( +${MARGIN_TOKEN}){0,3}$`, 'i')
const PADDING_RE = new RegExp(`^${LENGTH_TOKEN}( +${LENGTH_TOKEN}){0,3}$`, 'i')
const LENGTH_OR_AUTO_RE = new RegExp(`^(?:${LENGTH_TOKEN}|auto)$`, 'i')
const LENGTH_ONLY_RE = new RegExp(`^${LENGTH_TOKEN}$`, 'i')
const SAFE_DATA_IMAGE_RE = /^data:image\/(png|jpe?g|gif|webp|avif);base64,/i

const PDF_IMAGE_PROXY_BASE = 'https://images.weserv.nl/?url='
const PDF_IMAGE_DEFAULT_PARAMS = 'w=1600&fit=inside'

const allowedTags = Array.from(
  new Set([
    ...sanitizeHtml.defaults.allowedTags,
    'img',
    'figure',
    'figcaption',
    'picture',
    'source',
    'iframe',
    'video',
    'audio',
  ]),
)

const allowedAttributes: sanitizeHtml.IOptions['allowedAttributes'] = {
  ...sanitizeHtml.defaults.allowedAttributes,
  '*': Array.from(
    new Set([
      ...(sanitizeHtml.defaults.allowedAttributes?.['*'] ?? []),
      'class',
      'style',
      'role',
      'aria-label',
      'aria-describedby',
      'aria-hidden',
      'data-caption',
      'data-align',
    ]),
  ),
  a: ['href', 'name', 'target', 'rel', 'title'],
  img: [
    'src',
    'srcset',
    'sizes',
    'data-src',
    'data-original',
    'data-lazy-src',
    'alt',
    'title',
    'width',
    'height',
    'loading',
    'decoding',
    'fetchpriority',
  ],
  iframe: ['src', 'title', 'allow', 'allowfullscreen', 'frameborder', 'width', 'height'],
  video: ['src', 'poster', 'controls', 'loop', 'autoplay', 'muted', 'playsinline', 'preload'],
  source: ['src', 'srcset', 'type', 'media'],
}

function isSafeDataImage(value: string) {
  return SAFE_DATA_IMAGE_RE.test(value)
}

function rewriteLocalImageUrl(value: string) {
  try {
    const parsed = new URL(value)
    const host = parsed.hostname.toLowerCase()
    const isLocalhost = host === 'localhost' || host === '127.0.0.1'
    const isPrivateV4 =
      /^192\.168\./.test(host) ||
      /^10\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)

    if (isLocalhost || isPrivateV4) {
      parsed.protocol = 'https:'
      parsed.host = 'metravel.by'
      return parsed.toString()
    }
  } catch {
    // ignore
  }

  return value
}

function normalizePdfImageSrc(value?: string) {
  if (!value) return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  if (trimmed.startsWith('data:')) return isSafeDataImage(trimmed) ? trimmed : undefined
  if (trimmed.startsWith('blob:')) return trimmed
  if (trimmed.startsWith('//')) return normalizePdfImageSrc(`https:${trimmed}`)
  if (trimmed.startsWith('/')) {
    try {
      if (typeof window !== 'undefined' && window.location?.origin) {
        return `${window.location.origin}${trimmed}`
      }
    } catch {
      // ignore
    }
    return `https://metravel.by${trimmed}`
  }

  const normalized = normalizeUrl(trimmed)
  if (!normalized) return undefined
  try {
    const rewritten = rewriteLocalImageUrl(normalized)
    const withoutScheme = rewritten.replace(/^https?:\/\//i, '')
    return `${PDF_IMAGE_PROXY_BASE}${encodeURIComponent(withoutScheme)}&${PDF_IMAGE_DEFAULT_PARAMS}`
  } catch {
    return normalized
  }
}

const allowedSchemesByTag: sanitizeHtml.IOptions['allowedSchemesByTag'] = {
  iframe: ['http', 'https'],
  img: ['http', 'https', 'data', 'blob'],
}

function isAllowedIframe(src?: string) {
  if (!src) return false
  try {
    const url = new URL(src, 'https://metravel.by')
    return ALLOWED_IFRAME_HOSTS.some((host) => url.hostname.endsWith(host))
  } catch {
    return false
  }
}

function normalizeUrl(value?: string) {
  if (!value) return undefined
  try {
    const url = new URL(value, 'https://metravel.by')
    if (!ALLOWED_SCHEMES.includes(url.protocol.replace(':', ''))) return undefined
    return url.href
  } catch {
    return undefined
  }
}

function normalizeDimension(value?: string) {
  if (!value) return undefined
  const trimmed = value.trim()
  if (!DIMENSION_RE.test(trimmed)) return undefined
  return trimmed
}

/**
 * Удаляет React Native компоненты из HTML перед санитизацией
 * ✅ КРИТИЧНО: Эти компоненты не являются валидными HTML и ломают рендеринг
 */
function removeReactNativeComponents(html: string): string {
  let cleaned = html;
  let previousLength = 0;
  let iterations = 0;
  const maxIterations = 10; // Защита от бесконечного цикла
  
  // Рекурсивно удаляем React Native компоненты пока они есть
  while (iterations < maxIterations) {
    const currentLength = cleaned.length;
    if (currentLength === previousLength) break; // Больше нечего удалять
    previousLength = currentLength;
    
    // Удаляем React Native компоненты, сохраняя их содержимое
    cleaned = cleaned
      .replace(/<View[^>]*>/gi, '')
      .replace(/<\/View>/gi, '')
      .replace(/<Text[^>]*>/gi, '')
      .replace(/<\/Text>/gi, '')
      .replace(/<ScrollView[^>]*>.*?<\/ScrollView>/gis, '')
      .replace(/<Image[^>]*\/?>/gi, '')
      .replace(/<TouchableOpacity[^>]*>.*?<\/TouchableOpacity>/gis, '')
      .replace(/<TouchableHighlight[^>]*>.*?<\/TouchableHighlight>/gis, '')
      .replace(/<SafeAreaView[^>]*>.*?<\/SafeAreaView>/gis, '')
      .replace(/<ActivityIndicator[^>]*\/?>/gi, '')
      .replace(/<FlatList[^>]*>.*?<\/FlatList>/gis, '')
      .replace(/<SectionList[^>]*>.*?<\/SectionList>/gis, '');
    
    iterations++;
  }
  
  return cleaned;
}

export function sanitizeRichText(html?: string | null): string {
  if (!html) return ''

  // ✅ КРИТИЧНО: Удаляем React Native компоненты перед санитизацией
  const withoutReactComponents = removeReactNativeComponents(html);

  const sanitized = sanitizeHtml(withoutReactComponents, {
    allowedTags,
    allowedAttributes,
    allowedStyles: {
      '*': {
        'text-align': [/^(left|right|center|justify)$/],
        float: [/^(left|right|none)$/],
        margin: [MARGIN_RE],
        'margin-left': [LENGTH_OR_AUTO_RE],
        'margin-right': [LENGTH_OR_AUTO_RE],
        'margin-top': [LENGTH_ONLY_RE],
        'margin-bottom': [LENGTH_ONLY_RE],
        padding: [PADDING_RE],
        color: [COLOR_RE],
        'background-color': [COLOR_RE],
        background: [COLOR_RE],
        display: [/^(block|inline-block|inline)$/],
      },
      img: {
        width: [/^\d+(px|%)$/],
        height: [/^\d+(px|%)$/],
      },
    },
    allowedSchemes: ALLOWED_SCHEMES,
    allowedSchemesByTag,
    allowProtocolRelative: false,
    transformTags: {
      a: (_tag: string, attribs: Attributes) => {
        const href = normalizeUrl(attribs.href)
        const result: Record<string, string> = {}
        if (href) {
          result.href = href
          result.rel = attribs.rel || 'noopener noreferrer'
          if (attribs.target === '_blank') {
            result.target = '_blank'
          }
        }
        if (attribs.title) result.title = attribs.title
        if (attribs.name) result.name = attribs.name
        return { tagName: 'a', attribs: result }
      },
      img: (_tag: string, attribs: Attributes) => {
        const candidate = attribs.src || attribs['data-src'] || attribs['data-original'] || attribs['data-lazy-src']
        const src = normalizePdfImageSrc(candidate)
        const result: Record<string, string> = {}
        if (src) result.src = src
        if (attribs.alt) result.alt = attribs.alt
        if (attribs.title) result.title = attribs.title
        if (attribs.width) result.width = attribs.width
        if (attribs.height) result.height = attribs.height
        if (attribs.loading) result.loading = attribs.loading
        if (attribs.decoding) result.decoding = attribs.decoding
        if (attribs.fetchpriority) result.fetchpriority = attribs.fetchpriority
        return { tagName: 'img', attribs: result }
      },
      iframe: (_tag: string, attribs: Attributes) => {
        const src = normalizeUrl(attribs.src)
        if (!src || !isAllowedIframe(src)) {
          return { tagName: 'div', text: '', attribs: {} }
        }
        const height = normalizeDimension(attribs.height)
        const width = normalizeDimension(attribs.width)
        return {
          tagName: 'iframe',
          attribs: {
            src,
            title: attribs.title || 'Embedded content',
            allow:
              attribs.allow ||
              'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
            allowfullscreen: 'true',
            frameborder: '0',
            ...(width ? { width } : {}),
            ...(height ? { height } : {}),
          },
        }
      },
    },
    // ✅ КРИТИЧНО: Явно запрещаем React Native компоненты
    disallowedTagsMode: 'discard',
  }).trim();
  
  // ✅ ДОПОЛНИТЕЛЬНАЯ ЗАЩИТА: Проверяем результат на наличие React Native компонентов
  const hasReactComponents = /<View|<Text|<ScrollView|<Image[^>]*>|<TouchableOpacity|<TouchableHighlight|<SafeAreaView|<ActivityIndicator/i.test(sanitized);
  if (hasReactComponents) {
    // Принудительно удаляем еще раз на всякий случай
    return removeReactNativeComponents(sanitized);
  }
  
  return sanitized;
}

/**
 * Санитизирует и объединяет HTML в один сплошной блок для PDF экспорта
 */
export function sanitizeRichTextForPdf(html?: string | null): string {
  if (!html) return ''
  
  // Сначала санитизируем
  const sanitized = sanitizeRichText(html);
  
  // Для PDF важно сохранить разметку (абзацы, списки, изображения)
  return sanitized;
}
