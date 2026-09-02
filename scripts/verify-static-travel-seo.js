#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const { fetchJson } = require('./lib/fetchJson')

const args = process.argv.slice(2)

function getArg(name, fallback) {
  const index = args.indexOf(`--${name}`)
  return index !== -1 && args[index + 1] ? args[index + 1] : fallback
}

const DIST_DIR = path.resolve(getArg('dist', 'dist/prod'))
const API_BASE = getArg('api', 'https://metravel.by').replace(/\/+$/, '')
const sampleSizeArg = getArg('sample-size')
const SAMPLE_SIZE =
  typeof sampleSizeArg === 'string' && sampleSizeArg.trim().length > 0
    ? Math.max(1, Number.parseInt(sampleSizeArg, 10) || 1)
    : null
const GENERIC_TRAVEL_DESCRIPTION = 'Найди место для путешествия и поделись своим опытом.'

function extractItems(payload) {
  if (Array.isArray(payload)) return payload
  if (payload && typeof payload === 'object') {
    return payload.data || payload.results || payload.items || []
  }
  return []
}

function getTitle(html) {
  const match = html.match(/<title[^>]*>(.*?)<\/title>/i)
  return match ? match[1].trim() : ''
}

function getMetaContent(html, attr, name) {
  const regex = new RegExp(`<meta[^>]*${attr}="${name}"[^>]*content="([^"]*)"[^>]*\\/?>`, 'i')
  const match = html.match(regex)
  return match ? match[1] : ''
}

function countTag(html, regex) {
  const matches = html.match(regex)
  return matches ? matches.length : 0
}

function getTravelSsgHeadingTag(html) {
  const tags = String(html || '').match(/<h1\b[^>]*>/gi) || []
  return tags.find((tag) => {
    const className = tag.match(/\bclass\s*=\s*(["'])(.*?)\1/i)?.[2] || ''
    return className.split(/\s+/).includes('ssg-travel-h1')
  }) || ''
}

function hasTravelSsgHeading(html) {
  return Boolean(getTravelSsgHeadingTag(html))
}

function hasHiddenTravelH1Declarations(value) {
  return /(?:^|;)\s*(?:position\s*:\s*absolute|display\s*:\s*none|visibility\s*:\s*hidden|overflow\s*:\s*hidden|clip(?:-path)?\s*:|(?:width|height)\s*:\s*(?:0(?:px)?|1px)|opacity\s*:\s*0)(?:\s*!important)?(?:;|$)/i.test(value)
}

function hasVisibleTravelSsgHeading(html) {
  const tag = getTravelSsgHeadingTag(html)
  if (!tag || /\s(?:hidden|inert)(?:\s|=|>)/i.test(tag) || /aria-hidden\s*=\s*["']true["']/i.test(tag)) {
    return false
  }
  const inlineStyle = tag.match(/\bstyle\s*=\s*(["'])(.*?)\1/i)?.[2] || ''
  const classStyles = [...String(html || '').matchAll(/\.ssg-travel-h1\s*\{([^}]*)\}/gi)]
    .map((match) => match[1])
  return !hasHiddenTravelH1Declarations(inlineStyle) &&
    !classStyles.some(hasHiddenTravelH1Declarations)
}

function hasArticleJsonLd(html) {
  return /<script[^>]*application\/ld\+json[^>]*>[\s\S]*?"@type"\s*:\s*"Article"[\s\S]*?<\/script>/i.test(html)
}

function verifyTravelHtml(html, routeKey) {
  const title = getTitle(html)
  const description = getMetaContent(html, 'name', 'description')
  const ogTitle = getMetaContent(html, 'property', 'og:title')
  const ogImage = getMetaContent(html, 'property', 'og:image')
  const ogUrl = getMetaContent(html, 'property', 'og:url')
  const twitterImage = getMetaContent(html, 'name', 'twitter:image')
  const canonicalMatch = html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]*)"[^>]*\/?>/i)
  const canonical = canonicalMatch ? canonicalMatch[1] : ''
  const expectedCanonical = `${API_BASE}/travels/${routeKey}`

  const issues = []
  if (!title || title === 'Metravel') issues.push('generic-or-missing <title>')
  if (!description) issues.push('missing description')
  if (description === GENERIC_TRAVEL_DESCRIPTION) issues.push('generic description')
  if (countTag(html, /<meta[^>]*name="description"[^>]*\/?>/gi) !== 1) {
    issues.push('duplicate description')
  }
  if (!ogTitle) issues.push('missing og:title')
  if (!ogImage) issues.push('missing og:image')
  if (!twitterImage) issues.push('missing twitter:image')
  if (canonical !== expectedCanonical) issues.push(`bad canonical: ${canonical || 'missing'}`)
  if (ogUrl !== expectedCanonical) issues.push(`bad og:url: ${ogUrl || 'missing'}`)
  const h1Count = countTag(html, /<h1\b/gi)
  if (h1Count !== 1) issues.push(`expected exactly one SSR H1, found ${h1Count}`)
  if (!hasTravelSsgHeading(html)) issues.push('missing SSR H1 marker')
  else if (!hasVisibleTravelSsgHeading(html)) issues.push('hidden or clipped SSR H1')
  if (!hasArticleJsonLd(html)) issues.push('missing Article JSON-LD')

  return issues
}

/**
 * Обе формы страницы обязательны, и плоская — важнее.
 *
 * Голый `/travels/<slug>` — адрес из sitemap, по которому ходит краулер, —
 * резолвит Django: `public_travel_slug_view` отвечает `X-Accel-Redirect:
 * /__internal/travel-ssr/<slug>`, а этот internal-location в nginx делает
 * `try_files /travels/<slug>.html =404` (nginx/nginx.conf:493,510). Каталожный
 * `index.html` на этом пути не пробуется вовсе, поэтому статья с целым
 * `<slug>/index.html`, но без плоского файла отдаёт краулеру 404 и выпадает из
 * индекса.
 *
 * Это и есть механизм #1688, а не «неустановленный сбой прогона». Travel 583 и
 * 584 лежат на позициях 21 и 20 первой страницы каталога (проба прод-API
 * 01.09.2026), то есть внутри окна, которое гейт успевал проверить даже со
 * старой поломанной пагинацией. Деплой 01.09 13:34 прошёл, значит гейт по обеим
 * статьям был ЗЕЛЁНЫМ — он смотрел на существовавший `<slug>/index.html`, тогда
 * как отсутствовал плоский файл, единственный, который отдаётся по адресу из
 * sitemap. Тем же слепым пятном страдает и sample-проверка `<h1>` в
 * build-prod.sh: она обходит `find dist/prod/travels -name index.html`.
 */
function travelPageVariants(distDir, routeKey) {
  return [
    { role: 'flat', filePath: path.join(distDir, 'travels', `${routeKey}.html`) },
    { role: 'directory-index', filePath: path.join(distDir, 'travels', routeKey, 'index.html') },
  ]
}

/**
 * Бэкенд режет страницу до 100 записей и молча игнорирует больший `perPage`
 * (проба 01.09.2026: `perPage=500` → 100 items, `total=408`, `next` заполнен),
 * поэтому прежнее условие `matchedTravels.length === perPage` не выполнялось
 * никогда: гейт проверял первую сотню из 408 и печатал «Verified all 100».
 *
 * Ведущий признак — курсор `next` в ответе DRF, как в generate-seo-pages.js.
 * Ключ `next` присутствует всегда и на последней странице равен `null`, поэтому
 * его наличие и решает: сравнение с `total` — запасной путь только для ответа
 * без курсора.
 *
 * Считаются СЫРЫЕ записи страницы, а не пережившие фильтр `slug || id`: фильтр
 * не должен управлять пагинацией ни в одну сторону. Страница, целиком отсеянная
 * фильтром, иначе останавливала бы обход, и гейт печатал бы «Verified all N» по
 * усечённому каталогу — ровно тот fail-open, из-за которого #1688 уехал молча.
 * А в запасном пути каждая отброшенная запись держала бы `collected < total` и
 * заставила бы запросить страницу за последней: она отдаёт HTTP 404 и уронила
 * бы сборку чужой ошибкой. `total` при этом всегда считает записи каталога, а
 * не выживших после фильтра.
 */
function shouldFetchNextPage(payload, { fetchedCount, pageItemCount, total }) {
  if (pageItemCount <= 0) return false
  const isObject = Boolean(payload) && typeof payload === 'object'
  const hasCursorKey = isObject && ('next' in payload || 'next_page_url' in payload)
  if (hasCursorKey) return Boolean(payload.next || payload.next_page_url)
  return fetchedCount < total
}

/**
 * Обе формы читаются и валидируются полностью, хотя writer пишет в них один и
 * тот же байт-в-байт документ. Дешевле было бы сверять вторую по размеру, но
 * замер не оправдывает усложнение: на реальных прод-страницах (5 статей,
 * средняя 256 КБ) обе формы стоят 2.78 мс на статью, то есть ~1.14 с на весь
 * каталог из 408 против ~0.14 с у прежнего охвата в 100 статей одной формы.
 * Секунда на шаге прод-сборки, идущем десятки минут, не стоит ветки «сверяем
 * размер, а полный разбор только когда копии разошлись» — а именно разошедшиеся
 * копии этот гейт и обязан ловить.
 */
function collectTravelPageFailures(travels, distDir, deps = {}) {
  const fileSystem = deps.fs || fs
  const failures = []

  for (const travel of travels) {
    const routeKey = String(travel.slug || travel.id)

    for (const { role, filePath } of travelPageVariants(distDir, routeKey)) {
      if (!fileSystem.existsSync(filePath)) {
        failures.push(`${routeKey}: missing ${role} file ${path.relative(distDir, filePath)}`)
        continue
      }

      const issues = verifyTravelHtml(fileSystem.readFileSync(filePath, 'utf8'), routeKey)
      if (issues.length > 0) {
        failures.push(`${routeKey} (${role}): ${issues.join(', ')}`)
      }
    }
  }

  return failures
}

async function main() {
  const allTravels = []
  const perPage = SAMPLE_SIZE === null ? 500 : Math.max(SAMPLE_SIZE, 10)
  let page = 1
  let hasMore = true
  let fetchedCount = 0

  while (hasMore) {
    const params = new URLSearchParams({
      page: String(page),
      perPage: String(perPage),
      where: JSON.stringify({ publish: 1, moderation: 1 }),
    })
    const url = `${API_BASE}/api/travels/?${params}`
    const payload = await fetchJson(url)
    const pageItems = extractItems(payload)
    const matchedTravels = pageItems.filter((travel) => travel && (travel.slug || travel.id))

    fetchedCount += pageItems.length
    allTravels.push(...matchedTravels)

    if (SAMPLE_SIZE !== null) {
      hasMore = false
      break
    }

    const total =
      payload && typeof payload === 'object'
        ? typeof payload.total === 'number'
          ? payload.total
          : typeof payload.count === 'number'
            ? payload.count
            : pageItems.length
        : pageItems.length

    hasMore = shouldFetchNextPage(payload, {
      fetchedCount,
      pageItemCount: pageItems.length,
      total,
    })
    page += 1
  }

  const travels = SAMPLE_SIZE === null ? allTravels : allTravels.slice(0, SAMPLE_SIZE)

  if (travels.length === 0) {
    throw new Error('No published travels returned by API for SEO verification')
  }

  const failures = collectTravelPageFailures(travels, DIST_DIR)

  if (failures.length > 0) {
    const message = failures.map((failure) => ` - ${failure}`).join('\n')
    throw new Error(`Static travel SEO verification failed:\n${message}`)
  }

  const scopeLabel =
    SAMPLE_SIZE === null ? `all ${travels.length}` : `${travels.length} sampled`
  console.log(`[verify-static-travel-seo] Verified ${scopeLabel} travel pages in ${DIST_DIR}`)
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    collectTravelPageFailures,
    countTag,
    extractItems,
    shouldFetchNextPage,
    travelPageVariants,
    hasArticleJsonLd,
    hasTravelSsgHeading,
    hasVisibleTravelSsgHeading,
    getTitle,
    getMetaContent,
    verifyTravelHtml,
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[verify-static-travel-seo] ${error.message}`)
    process.exit(1)
  })
}
