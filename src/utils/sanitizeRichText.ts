import sanitizeHtml from 'sanitize-html'

const ALLOWED_IFRAME_HOSTS = [
  'youtube.com',
  'youtu.be',
  'player.vimeo.com',
  'www.google.com',
  'instagram.com',
]
const ALLOWED_SCHEMES = ['http', 'https', 'mailto']
const DIMENSION_RE = /^\d+(\.\d+)?(px|%)?$/i

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

/**
 * Объединяет HTML в один сплошной блок для PDF экспорта
 * Извлекает только текстовое содержимое и объединяет в один блок
 */
function flattenHtmlForPdf(html: string): string {
  if (!html || html.trim() === '') return '';
  
  // Сначала санитизируем HTML, чтобы убрать опасные элементы
  // Затем извлекаем только текстовое содержимое
  
  // Удаляем все HTML теги, оставляя только текст
  // Используем более безопасный подход - заменяем закрывающие теги на пробелы
  let text = html
    // Удаляем скрипты и стили полностью
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    // Заменяем блочные элементы на пробелы
    .replace(/<\/p>/gi, ' ')
    .replace(/<\/div>/gi, ' ')
    .replace(/<\/h[1-6]>/gi, ' ')
    .replace(/<\/li>/gi, ' ')
    .replace(/<\/ul>/gi, ' ')
    .replace(/<\/ol>/gi, ' ')
    // Удаляем открывающие теги
    .replace(/<[^>]+>/g, '')
    // Заменяем HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Объединяем множественные пробелы в один
    .replace(/\s+/g, ' ')
    .trim();
  
  // Если текст пустой после обработки, возвращаем пустую строку
  if (!text || text.trim() === '') return '';
  
  // Оборачиваем в простой div для правильного отображения
  // Экранируем HTML для безопасности
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  
  return `<div>${escaped}</div>`;
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
  
  // Затем объединяем в один блок
  return flattenHtmlForPdf(sanitized);
}

