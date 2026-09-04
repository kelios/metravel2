/**
 * Разметка, по которой блок «Частые вопросы» вообще опознаётся в теле статьи.
 *
 * Один счёт на два места, где её потеря наблюдаема и значима:
 *
 *  - рендер — `utils/serverSafeHtml.ts` берёт legacy-поле вместо канонического
 *    `safe_html`, когда серверный санитайзер схлопнул блок;
 *  - запись — `api/misc.ts` не отправляет в `PUT /travels/upsert/` и
 *    `PATCH /travels/{id}/content/` тело, из которого клиентский санитайзер
 *    вынул FAQ (#1764).
 *
 * Это намеренно грубая мера «структура на месте», а не вторая копия разбора
 * FAQ: сами пары вопрос-ответ собирает генератор (`extractFaqEntries` в
 * `scripts/generate-seo-pages.js`), и он остаётся единственным, кто решает, что
 * попадёт в FAQPage.
 */

/**
 * Открывающий тег секции-обёртки. Зеркалит `FAQ_SECTION_OPEN_TAG` из
 * `scripts/generate-seo-pages.js`: тот файл — CJS-скрипт сборки, из бандла
 * приложения он не импортируется, поэтому строка продублирована. Расхождение
 * двух копий ловит `__tests__/utils/faqDisclosureMarkup.test.ts`, который
 * читает константу у самого генератора.
 */
export const FAQ_SECTION_OPEN_TAG =
  '<section[^>]*(?:class="[^"]*seo-faq[^"]*"|data-faq="metravel-seo")[^>]*>'

const countMatches = (html: string, pattern: RegExp): number => (html.match(pattern) ?? []).length

/**
 * Сколько в теле пар `<details>/<summary>`.
 *
 * Считается именно ПАРА: `<details>` без `<summary>` вопроса не даёт, и
 * `extractFaqEntries` такой блок пропускает. Гейт по одному `<details>` объявил
 * бы потерей то, из чего FAQPage и так не собирался.
 */
export const countFaqDisclosureBlocks = (html: string | null | undefined): number => {
  const source = String(html ?? '')
  if (!source) return 0
  return Math.min(
    countMatches(source, /<details\b/gi),
    countMatches(source, /<summary\b/gi),
  )
}

/**
 * Сколько в теле секций-обёрток FAQ.
 *
 * Считать одни `<details>` мало. Микроразметку (`itemprop="mainEntity"`)
 * санитайзер записи снимает при каждом сохранении — она не в его allowlist, и
 * это осознанно: FAQPage собирается как JSON-LD и в ней не нуждается. Значит,
 * опознать блок как FAQ, а не как случайный `<details>` в тексте, генератор
 * может ТОЛЬКО по этой обёртке. Уйди `section` или `class` из allowlist —
 * `disallowedTagsMode: 'discard'` оставит `<details>` детьми, счёт пар не
 * дрогнет, а FAQPage исчезнет ровно так же тихо, как в июле 2026.
 */
export const countFaqSectionWrappers = (html: string | null | undefined): number => {
  const source = String(html ?? '')
  if (!source) return 0
  return countMatches(source, new RegExp(FAQ_SECTION_OPEN_TAG, 'gi'))
}

/** true — после обработки FAQ-разметки в теле стало меньше, чем было. */
export const losesFaqMarkup = (
  before: string | null | undefined,
  after: string | null | undefined,
): boolean =>
  countFaqDisclosureBlocks(after) < countFaqDisclosureBlocks(before) ||
  countFaqSectionWrappers(after) < countFaqSectionWrappers(before)

const FAQ_SECTION_BLOCK_RE = new RegExp(
  `${FAQ_SECTION_OPEN_TAG}[\\s\\S]*?<\\/section>`,
  'gi',
)
const FAQ_DETAILS_BLOCK_RE = /<details\b[\s\S]*?<\/details>/gi

/** FAQ-разметка, которую редактор/санитайзер не должен терять при правке абзаца рядом. */
export const extractFaqMarkup = (html: string | null | undefined): string => {
  const source = String(html ?? '')
  if (!source) return ''
  const sections = source.match(FAQ_SECTION_BLOCK_RE)
  if (sections?.length) return sections.join('')
  const details = source.match(FAQ_DETAILS_BLOCK_RE) ?? []
  return details.filter((block) => /<summary\b/i.test(block)).join('')
}

/**
 * Quill не умеет `<details>`: pasteHTML схлопывает блок в плоский текст ещё до
 * санитайзера. Если выход редактора потерял FAQ относительно исходного тела,
 * возвращаем исходную разметку блока, а правки вне него оставляем.
 */
export const restoreFaqMarkupIfLost = (
  before: string | null | undefined,
  after: string | null | undefined,
): string => {
  const previous = String(before ?? '')
  const next = String(after ?? '')
  if (!losesFaqMarkup(previous, next)) return next
  const originalFaq = extractFaqMarkup(previous)
  if (!originalFaq) return next
  const leftoverFaq = extractFaqMarkup(next)
  const body = leftoverFaq ? next.replace(leftoverFaq, '') : next
  return `${body.replace(/\s+$/u, '')}\n${originalFaq}`
}
