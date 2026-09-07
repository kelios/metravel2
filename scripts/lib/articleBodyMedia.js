/**
 * scripts/lib/articleBodyMedia.js
 * Разбор медиа тела статьи: адреса кадров и семейство по адресу.
 *
 * Оба потребителя читают ОДНИ и те же тела статей, но спрашивают у них разное:
 * `post-deploy-media-check.js` проверяет контракт трансформации (вес, кэш,
 * ступени), `audit-article-body-media.js` — что кадр вообще отдаётся (#1834).
 * Разбор при этом один: `<img>` с ленивыми атрибутами, манифест `media.article_body`
 * и правило «семейство = первый сегмент пути». Второй его копии быть не должно —
 * разошедшийся разбор означает, что один гейт видит кадр, которого другой не видит.
 */

/** Origin по умолчанию — только чтобы разобрать относительный путь. */
const DEFAULT_SITE = 'https://metravel.by'

/** URL'ы медиа тела статьи из BE-манифеста: обложка + галерея. */
function collectArticleBodyMediaUrls(detail) {
  const body = detail?.media?.article_body
  if (!body) return []
  const items = [body.cover, ...(Array.isArray(body.gallery) ? body.gallery : [])]
  return items
    .filter(Boolean)
    .flatMap((item) => [item.src, item.variants?.original, item.src_contain, item.src_cover])
    .filter(Boolean)
}

/**
 * Поля rich text, в которых лежит HTML тела статьи.
 *
 * Тот же набор отдаёт в рендер `TravelDetailsContentSection`
 * (`components/travel/details/sections`): именно эти четыре строки проходят
 * через `resolveServerRichTextHtml` и превращаются в `<img>` у читателя.
 */
const RICH_TEXT_FIELDS = ['description', 'plus', 'minus', 'recommendation']

/**
 * Атрибуты `<img>`, в которых может лежать адрес кадра, — в порядке приоритета
 * `utils/sanitizeRichText.ts` (`src || data-src || data-original || data-lazy-src`).
 *
 * Одного `src` мало: ленивые атрибуты живут в legacy-полях, ради них у фронта и
 * заведён этот fallback. Брать их надо ПОСЛЕ `src`, иначе `<img data-src="…"
 * src="…/uploads/x.jpg">` отдаёт placeholder, а настоящий ключ теряется и гейт
 * печатает «класса больше нет» вместо непроверенного класса.
 */
const RICH_TEXT_IMG_SRC_ATTRIBUTES = ['src', 'data-src', 'data-original', 'data-lazy-src']

const RICH_TEXT_IMG_TAG_RE = /<img\b[^>]*>/gi
const RICH_TEXT_IMG_ATTRIBUTE_RE = /([-\w]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g

/**
 * Адреса картинок из rich-text HTML статьи.
 *
 * Манифеста у этих кадров нет, и класс `uploads/**` остался ТОЛЬКО здесь. Обход
 * 2026-09-04 по четырём статьям, где класс ещё жив (travel 116, 171, 220, 290):
 * все восемь ссылок лежат в `recommendation`/`description`, а
 * `media.article_body` у них целиком канонический (`travel-description-image`).
 * Значит поиск цели по одному манифесту не находил класс НИ В ОДНОЙ статье
 * каталога — не «редко», а никогда (#1758).
 *
 * Порядок слепков повторяет `resolveServerRichTextHtml`: сначала canonical
 * `rich_text.<field>.safe_html` — его и рендерит страница, — потом legacy-поле.
 * Так цель строится из URL, который читатель реально запрашивает; legacy-поле
 * остаётся резервом, потому что серверный санитайзер выбрасывает `<img>` без
 * `src` и кадр может быть виден только в сыром слепке.
 */
function collectRichTextMediaUrls(detail) {
  if (!detail) return []
  const urls = []
  for (const field of RICH_TEXT_FIELDS) {
    for (const chunk of [detail.rich_text?.[field]?.safe_html, detail[field]]) {
      if (typeof chunk !== 'string' || !chunk) continue
      for (const [tag] of chunk.matchAll(RICH_TEXT_IMG_TAG_RE)) {
        const attributes = new Map()
        for (const [, name, doubleQuoted, singleQuoted] of tag.matchAll(RICH_TEXT_IMG_ATTRIBUTE_RE)) {
          const key = name.toLowerCase()
          if (!attributes.has(key)) attributes.set(key, doubleQuoted ?? singleQuoted ?? '')
        }
        // Один кадр — один адрес. Рендер берёт по цепочке `||` ПЕРВЫЙ непустой и
        // остальные не запрашивает вовсе, поэтому класть в кандидаты все атрибуты
        // тега нельзя: устаревший `data-src` с ключом `uploads/**` рядом с живым
        // каноническим `src` дал бы цель, которой у читателя нет, и гейт отчитался
        // бы ошибкой по несуществующему кадру.
        const source = RICH_TEXT_IMG_SRC_ATTRIBUTES.map((name) => attributes.get(name)).find(Boolean)
        if (source) urls.push(source.replace(/&amp;/gi, '&'))
      }
    }
  }
  return urls
}

/** Кандидаты в цель `uploads/**`: манифест плюс rich-text HTML тела статьи. */
function collectLegacyUploadCandidates(detail) {
  return [...collectArticleBodyMediaUrls(detail), ...collectRichTextMediaUrls(detail)]
}

/**
 * Семейство по адресу медиа: первый сегмент пути, у legacy-роутов — второй.
 *
 * Совпадает с ключами `WIDTHS_BY_FAMILY`, поэтому потолок берётся оттуда же,
 * а не из новой таблицы: сверку той таблицы с `IMAGE_STORAGE_POLICY_V1` уже
 * держит `__tests__/scripts/postDeployMediaWidths.test.ts`.
 */
function familyOfMediaUrl(rawUrl, site = DEFAULT_SITE) {
  let pathname
  try {
    const value = String(rawUrl || '').trim()
    if (!value) return null
    pathname = (value.startsWith('/') ? new URL(value, site) : new URL(value)).pathname
  } catch {
    return null
  }
  const parts = pathname.split('/').filter(Boolean)
  if (!parts.length) return null
  if (parts[0].toLowerCase() === 'media-resize') {
    return parts[1]?.toLowerCase() === 'legacy' ? 'media-resize-legacy' : 'media-resize-uploads'
  }
  return parts[0].toLowerCase()
}

/**
 * Прямая ссылка в наше legacy-хранилище S3: не на проверяемом origin.
 *
 * Нужна пост-деплойному гейту, чтобы выбросить такой адрес из обхода ступеней
 * `srcset`: `?w=` бакет игнорирует by design (#1176), лестницу на нём мерить
 * нечем, и у класса есть своя цель `media-resize-uploads`.
 *
 * Адрес, по которому кадр запрашивает читатель, эта функция НЕ считает — им
 * занят `lib/readerMediaUrl.js` (#1854): бакетную ссылку фронт переписывает на
 * `/media-resize/uploads/<key>`, и щупать её «как есть» значит мерить
 * доступность другого файла.
 */
function isLegacyBucketUrl(rawUrl) {
  return /^https?:\/\/[^/]*\bs3[.-][^/]*amazonaws\.com\//i.test(String(rawUrl || '').trim())
}

module.exports = {
  RICH_TEXT_FIELDS,
  RICH_TEXT_IMG_SRC_ATTRIBUTES,
  collectArticleBodyMediaUrls,
  collectLegacyUploadCandidates,
  collectRichTextMediaUrls,
  familyOfMediaUrl,
  isLegacyBucketUrl,
}
