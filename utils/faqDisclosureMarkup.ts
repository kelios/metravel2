/**
 * Сколько FAQ-блоков `<details>/<summary>` несёт HTML статьи.
 *
 * Один счёт на два места, где потеря disclosure-разметки наблюдаема и значима:
 *
 *  - рендер — `utils/serverSafeHtml.ts` берёт legacy-поле вместо канонического
 *    `safe_html`, когда серверный санитайзер схлопнул блок;
 *  - запись — `api/misc.ts` не отправляет в `PUT /travels/upsert/` и
 *    `PATCH /travels/{id}/content/` тело, из которого клиентский санитайзер
 *    вынул FAQ (#1764).
 *
 * Считается ПАРА тегов: `<details>` без `<summary>` вопроса не даёт, и
 * `extractFaqEntries` (`scripts/generate-seo-pages.js`) такой блок пропускает.
 * Гейт по одному `<details>` объявил бы потерей то, из чего FAQPage и так не
 * собирался. Это намеренно грубая мера «структура на месте», а не вторая копия
 * разбора FAQ: разбор остаётся за генератором.
 */
export const countFaqDisclosureBlocks = (html: string | null | undefined): number => {
  const source = String(html ?? '')
  if (!source) return 0
  const countTag = (tag: 'details' | 'summary') =>
    (source.match(new RegExp(`<${tag}\\b`, 'gi')) ?? []).length
  return Math.min(countTag('details'), countTag('summary'))
}
