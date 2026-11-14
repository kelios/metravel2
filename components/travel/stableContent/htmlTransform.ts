import { Platform } from 'react-native'

import { normalizeArticleEditorHtmlForInput } from '@/components/article/articleEditorConfig'
import type { ArticleBodyMediaIndex } from '@/components/travel/stableContent/articleBodyMedia'
import {
  buildArticleBodyResponsiveImage,
  buildExternalImageUrl,
  currentSlotWidths,
} from '@/components/travel/stableContent/articleBodyImageUrls'
import { replaceInstagramEmbedsWithCards } from '@/utils/instagramRichText'
import { normalizeRichTextListFragments } from '@/utils/richTextLists'
import { sanitizeRichText } from '@/utils/sanitizeRichText'
import { applySmartImageLayout } from '@/utils/richTextImageLayout'
import { guardServerSafeHtml } from '@/utils/serverSafeHtml'
import {
  appendClassAttribute,
  editFirstStartTag,
  findFirstStartTag,
  getAttribute,
  removeAttribute,
  rewriteStartTags,
  setAttribute,
  tokenizeHtml,
} from '@/utils/htmlTokens'
import { decorateRichImageFrames } from '@/components/travel/stableContent/richImageFrames'
import { extractYouTubeFacadeVideoId } from '@/components/travel/stableContent/youtubeFacadeId'
import { demoteRichTextPageHeadings } from '@/utils/richTextHeadings'
import { applyRichTextImageAlt } from '@/utils/richTextImageAlt'
import {
  applyRichTextImageReserveSize,
  applyRichTextImageReserveStyle,
  resolveRichTextImageReserve,
} from '@/utils/richTextImageReserve'
import { translate as i18nT } from '@/i18n'

// #3408: адреса картинок тела строит `articleBodyImageUrls.ts` — тот же
// построитель берёт серверный остров. Публичные имена остаются доступны отсюда.
export { buildExternalImageUrl } from '@/components/travel/stableContent/articleBodyImageUrls'

export const hasIframe = (html: string) => /<iframe[\s/>]/i.test(html)

export const isYouTubeEmbedUrl = (src: string) => /youtube\.com|youtu\.be/i.test(src)

export const isInstagramEmbedUrl = (src: string) => /instagram\.com/i.test(src)

const stripDangerousTags = (html: string) =>
  html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')

const escapeHtmlAttr = (value: string) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

// #3202: атрибуты читаются и меняются по разобранному тегу. Раньше здесь стояли
// регулярки по строке тега, и `src="` в хвосте значения `alt` принимался за `src`:
// замена сдвигала кавычки, и текст из `class` становился атрибутом `onerror`.
const normalizeImgTags = (html: string, media: ArticleBodyMediaIndex | null): string => {
  return rewriteStartTags(html, ['img'], ({ attrs }) => {
    const src = getAttribute(attrs, 'src') ?? ''
    const responsive = src ? buildArticleBodyResponsiveImage(src, media, currentSlotWidths()) : null
    const optimizedSrc = responsive?.src ?? (src ? buildExternalImageUrl(src) || src : src)
    // #3414: резерв места считает общий модуль — его же берёт серверный остров.
    const reserve = resolveRichTextImageReserve(attrs)
    applyRichTextImageReserveStyle(attrs, reserve)
    if (optimizedSrc) setAttribute(attrs, 'src', escapeHtmlAttr(optimizedSrc))
    else removeAttribute(attrs, 'src')
    for (const name of ['srcset', 'sizes']) removeAttribute(attrs, name)

    // Пустой `srcSet` — это не «забыли построить», а класс без лестницы (#1233).
    // Атрибуты в таком случае не выводим: `srcset=""` браузер трактует как
    // кандидатов нет и в части движков гасит `src`.
    if (responsive?.srcSet) {
      attrs.push({ name: 'srcset', value: escapeHtmlAttr(responsive.srcSet) })
      attrs.push({ name: 'sizes', value: escapeHtmlAttr(responsive.sizes) })
    }
    applyRichTextImageReserveSize(attrs, reserve)
    for (const name of ['decoding', 'fetchpriority', 'loading']) removeAttribute(attrs, name)

    // #3237: подпись автора или пустой `alt` — тот же контракт, что у серверного HTML.
    applyRichTextImageAlt(attrs)

    attrs.push({ name: 'loading', value: 'lazy' }, { name: 'decoding', value: 'async' }, { name: 'fetchpriority', value: 'low' })
  })
}

// Пустой `<iframe src="…youtube…"></iframe>` → лёгкий фасад. `src` читается из
// разобранного тега (#3202), а не регуляркой по строке.
const replaceYouTubeIframes = (html: string): string => {
  if (!hasIframe(html)) return html
  const tokens = tokenizeHtml(html)
  let out = ''
  let cursor = 0
  tokens.forEach((token, index) => {
    const closing = tokens[index + 1]
    if (token.kind !== 'start' || token.name !== 'iframe' || closing?.kind !== 'end' || !closing.closesRawText) return
    const src = getAttribute(token.attrs, 'src') ?? ''
    const id = src && isYouTubeEmbedUrl(src) ? extractYouTubeFacadeVideoId(src) : undefined
    if (!id) return
    out += html.slice(cursor, token.start) + buildYouTubeFacade(id)
    cursor = closing.end
  })
  return cursor === 0 ? html : out + html.slice(cursor)
}

const buildYouTubeFacade = (id: string) => `
<div class="yt-lite" data-yt="${id}"
     style="position:relative;aspect-ratio:16/9;background:var(--color-backgroundTertiary);border-radius:12px;overflow:hidden;margin:16px 0">
  <img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg"
       width="1280" height="720"
       alt="YouTube preview" loading="lazy" decoding="async"
       style="width:100%;height:100%;object-fit:cover;display:block"/>
  <div role="button" tabindex="0" aria-label="${i18nT("travel:components.travel.stableContent.htmlTransform.div_class_yt_lite_data_yt_value1_style_posit_873857b2.text01")}"
    style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:transparent;cursor:pointer">
    <span style="width:68px;height:48px;background:var(--color-overlay);clip-path:polygon(20% 10%,20% 90%,85% 50%);"></span>
  </div>
</div>`

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

const HEADING_HASH_RE = /^#([^"'#?]+)$/

const injectAutoHeadingAnchors = (html: string) => {
  if (!html) return html

  const orderedHashIds = tokenizeHtml(html).flatMap((token) => {
    if (token.kind !== 'start' || token.name !== 'a') return []
    const id = String(getAttribute(token.attrs, 'href') ?? '').match(HEADING_HASH_RE)?.[1]?.trim()
    return id ? [id] : []
  })
  const uniqueOrderedHashIds = orderedHashIds.filter((id, index) => orderedHashIds.indexOf(id) === index)

  return html.replace(/<h([1-3])([^>]*)>([\s\S]*?)<\/h\1>/gi, (full, level, rawAttrs, inner) => {
    const openingTag = `<h${level}${rawAttrs}>`
    if (getAttribute(findFirstStartTag(openingTag, `h${level}`)?.attrs ?? [], 'id')) return full

    const innerText = decodeEntities(String(inner || '').replace(/<[^>]+>/g, '').trim())
    const match = innerText.match(/^(\d{1,3})[.)]\s+/)
    if (!match) return full

    const orderedId = uniqueOrderedHashIds[Number(match[1]) - 1]
    const id = orderedId || `part${match[1]}`
    return `${editFirstStartTag(openingTag, `h${level}`, (attrs) => setAttribute(attrs, 'id', id))}${inner}</h${level}>`
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

    const openingTag = editFirstStartTag(`<p${attrs}>`, 'p', (parsed) => appendClassAttribute(parsed, 'instagram-caption'))
    return `${openingTag}${nextInner}</p>`
  })
}

export type PrepareStableContentHtmlOptions = {
  // true — html уже canonical rich_text.*.safe_html с бэка (#709): полный
  // normalize+sanitize pipeline не запускается, остаётся только дешёвый guard.
  serverSanitized?: boolean
  /**
   * #1256: индекс `media.article_body`. Без него картинки тела адресуются прежним
   * клиентским способом — это штатный фолбэк, а не деградация: у статей со старым
   * payload и на экранах вне travel манифеста нет вовсе.
   */
  articleBodyMedia?: ArticleBodyMediaIndex | null
}

export const prepareStableContentHtml = (html: string, options?: PrepareStableContentHtmlOptions) => {
  const serverSanitized = options?.serverSanitized === true
  const normalizedEmbeds = serverSanitized
    ? guardServerSafeHtml(html)
    : normalizeArticleEditorHtmlForInput(html)
  const isWeb = Platform.OS === 'web' || typeof document !== 'undefined'
  // На web: вместо живого iframe (каждый тянет ~целый Instagram-рантайм, ~900KB/десятки
  // запросов на статью) — лёгкий facade, настоящий iframe монтируется лениво при подходе
  // к вьюпорту (useStableContentWebEffects). На native iframe остаётся в HTML и попадает
  // в `InstagramEmbed` (WebView) через рендерер RNRH, который так же монтирует его лениво
  // и с окном — посты обязаны выглядеть одинаково на mobile web и Android.
  const instagramSafeHtml = replaceInstagramEmbedsWithCards(normalizedEmbeds, {
    iframeStrategy: isWeb ? 'facade' : 'embed',
  })
  const safe = serverSanitized ? instagramSafeHtml : sanitizeRichText(instagramSafeHtml)
  const normalized = replaceYouTubeIframes(
    normalizeImgTags(stripDangerousTags(safe), options?.articleBodyMedia ?? null),
  )
  const demoted = demoteRichTextPageHeadings(normalized)
  const truncated = truncateInstagramCaptions(demoted)
  const normalizedLists = normalizeRichTextListFragments(truncated)
  return injectAutoHeadingAnchors(decorateRichImageFrames(applySmartImageLayout(normalizedLists)))
}
