import sanitizeHtml from 'sanitize-html'

const ALLOWED_IFRAME_HOSTS = ['youtube.com', 'youtu.be', 'player.vimeo.com', 'www.google.com']
const ALLOWED_SCHEMES = ['http', 'https', 'mailto']

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

const allowedSchemesByTag: sanitizeHtml.IOptions['allowedSchemesByTag'] = {
  iframe: ['http', 'https'],
  img: ['http', 'https', 'data'],
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

export function sanitizeRichText(html?: string | null): string {
  if (!html) return ''

  return sanitizeHtml(html, {
    allowedTags,
    allowedAttributes,
    allowedStyles: {
      '*': {
        'text-align': [/^(left|right|center|justify)$/],
        float: [/^(left|right|none)$/],
        margin: [/^-?\d+(px|em|rem|%)?( +-?\d+(px|em|rem|%)?){0,3}$/],
        padding: [/^\d+(px|em|rem|%)?( +\d+(px|em|rem|%)?){0,3}$/],
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
      a: (_tag, attribs) => {
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
      iframe: (_tag, attribs) => {
        const src = normalizeUrl(attribs.src)
        if (!src || !isAllowedIframe(src)) {
          return { tagName: 'div', text: '' }
        }
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
          },
        }
      },
    },
  }).trim()
}

