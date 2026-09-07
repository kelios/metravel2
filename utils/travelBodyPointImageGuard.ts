import { confirmAction } from '@/utils/confirmAction'
import { translate as i18nT } from '@/i18n'
import { unwrapWeservImageUrl } from '@/utils/weservImageUrl'

import {
  GUARDED_RICH_TEXT_FIELDS,
  getRichTextFieldLabel,
  type RichTextLossField,
  type RichTextSnapshot,
} from '@/utils/travelTextLossGuard'

/**
 * Фото точки в теле статьи живёт по чужому ключу (#1834, рецидив #1088).
 *
 * `/address-image/<id точки>/conversions/<файл>` резолвится бэкендом ПО СТРОКЕ
 * `travel_address`: исчезла точка — ссылка навсегда отдаёт 404. Тело статьи про
 * точки не знает ничего, поэтому правка маршрута молча ломает текст: у travel 586
 * точки 15188 и 15190 ушли из маршрута, а `<img>` на их фото остались в описании.
 *
 * Здесь ровно сверка, а не лечение: тело автору не переписывается — мёртвую
 * ссылку заменяет он сам загрузкой в `travel-description-image`, у которой свой
 * жизненный цикл и точка ей не владелец.
 */

export type DanglingPointImage = {
  field: RichTextLossField
  pointId: number
  url: string
}

/**
 * Ссылка на фото точки в произвольном месте HTML.
 *
 * Ищем не `<img src>`, а само вхождение ключа: тот же адрес встречается в
 * `srcset`, `data-src` и внутри обёртки `images.weserv.nl/?url=…`, где слэши
 * приезжают процентно-закодированными (`%2Faddress-image%2F15188%2F`). Разбор
 * тегов такой кадр бы потерял, а мёртвым он остаётся в любой из этих позиций.
 */
const POINT_IMAGE_REFERENCE_RE = /address-image(?:\/|%2f)(\d+)(?:\/|%2f)/gi

/** Границы URL внутри HTML: кавычки атрибута, пробел, угловая скобка, запятая `srcset`. */
const URL_BOUNDARY_RE = /[\s"'<>(),]/

/**
 * Адрес целиком вокруг найденного вхождения — для показа автору.
 *
 * Ключ говорит, ЧТО умерло, но заменять автор идёт в конкретную картинку, и
 * узнаёт он её по имени файла.
 */
function extractUrlAround(html: string, index: number): string {
  let start = index
  while (start > 0 && !URL_BOUNDARY_RE.test(html[start - 1])) start -= 1
  let end = index
  while (end < html.length && !URL_BOUNDARY_RE.test(html[end])) end += 1
  return html.slice(start, end)
}

/** Id точек сохраняемого маршрута. Новая точка (`id == null`) в набор не входит. */
function collectPointIds(markers: unknown): Set<number> {
  const ids = new Set<number>()
  if (!Array.isArray(markers)) return ids
  for (const marker of markers) {
    const raw = (marker as { id?: unknown } | null | undefined)?.id
    if (raw == null) continue
    const id = Number(raw)
    if (Number.isFinite(id) && id > 0) ids.add(id)
  }
  return ids
}

/**
 * Ссылки тела статьи на фото точек, которых в сохраняемом маршруте больше нет.
 *
 * Пустой набор точек — НЕ вердикт «все ссылки мертвы»: маршрут без точек в форме
 * означает и «автор удалил всё», и «точки ещё не подгрузились в стейт», а второе
 * превратило бы обычное сохранение текста в модалку на каждую картинку тела.
 * Сверяем только там, где маршрут точно прочитан — тогда несовпадение id это
 * факт, а не догадка.
 *
 * Чистая функция: диалогов не показывает, данные не трогает.
 */
export function detectDanglingPointImages(
  body: RichTextSnapshot | null | undefined,
  markers: unknown,
): DanglingPointImage[] {
  if (!body) return []

  const knownIds = collectPointIds(markers)
  if (knownIds.size === 0) return []

  const dangling: DanglingPointImage[] = []
  const seen = new Set<string>()

  for (const field of GUARDED_RICH_TEXT_FIELDS) {
    const html = typeof body[field] === 'string' ? (body[field] as string) : ''
    if (!html) continue

    POINT_IMAGE_REFERENCE_RE.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = POINT_IMAGE_REFERENCE_RE.exec(html)) !== null) {
      const pointId = Number(match[1])
      if (!Number.isFinite(pointId) || knownIds.has(pointId)) continue

      const url = extractUrlAround(html, match.index)
      const key = `${field}\u0000${url}`
      if (seen.has(key)) continue
      seen.add(key)
      dangling.push({ field, pointId, url })
    }
  }

  return dangling
}

/**
 * Имя файла кадра — то, что автор видит в тексте; целый URL в списке нечитаем.
 *
 * Обёртку `images.weserv.nl/?url=…` разворачиваем ПЕРЕД тем, как брать последний
 * сегмент: у обёрнутого адреса настоящий путь лежит в query, и наивный разбор
 * напечатал бы автору `images.weserv.nl` вместо имени фотографии — ровно ту
 * форму, ради которой детектор и умеет читать процентно-кодированный адрес.
 */
function toDisplayName(url: string): string {
  const path = unwrapWeservImageUrl(url).replace(/[?#].*$/, '')
  const name = path.split('/').filter(Boolean).pop()
  return name || url
}

/**
 * Сколько кадров показываем списком.
 *
 * Не косметика, а условие работоспособности диалога: `ConfirmDialog` высоту не
 * ограничивает и не скроллит, поэтому длинное сообщение выносит кнопки за экран.
 * Замер на локальном стенде (travel 682, 14 позиций): диалог 1051 px в окне 900,
 * верх обрезан, обе кнопки на y=925 — автор не может ни подтвердить, ни отменить.
 * Пяти строк хватает, чтобы узнать проблему, а полный перечень даёт корпусный
 * прогон `scripts/audit-article-body-media.js`.
 */
const MAX_LISTED_ITEMS = 5

/** Список для диалога: первые `MAX_LISTED_ITEMS` строк плюс хвостовой счётчик. */
function buildList(dangling: DanglingPointImage[]): string {
  const lines = dangling.slice(0, MAX_LISTED_ITEMS).map(describe)
  const rest = dangling.length - lines.length
  if (rest > 0) {
    lines.push(i18nT('travel:utils.travelBodyPointImageGuard.more', { count: String(rest) }))
  }
  return lines.join('\n')
}

/** Строка списка: «описание — 1b3ee9bb….webp (точка 15188)». */
function describe(item: DanglingPointImage): string {
  return i18nT('travel:utils.travelBodyPointImageGuard.item', {
    field: getRichTextFieldLabel(item.field),
    file: toDisplayName(item.url),
    pointId: String(item.pointId),
  })
}

/**
 * Если в теле остались фото исчезнувших точек — спрашивает подтверждение.
 *
 * true → продолжить сохранение; false → прервать (чистый no-op, форму не трогаем).
 * Нет мёртвых ссылок → true без диалога.
 */
export async function confirmDanglingPointImagesIfNeeded(
  body: RichTextSnapshot | null | undefined,
  markers: unknown,
): Promise<boolean> {
  const dangling = detectDanglingPointImages(body, markers)
  if (dangling.length === 0) return true

  return confirmAction({
    title: i18nT('travel:utils.travelBodyPointImageGuard.title'),
    message: i18nT('travel:utils.travelBodyPointImageGuard.message', {
      count: String(dangling.length),
      list: buildList(dangling),
    }),
    confirmText: i18nT('travel:utils.travelBodyPointImageGuard.confirm'),
    cancelText: i18nT('travel:utils.travelBodyPointImageGuard.cancel'),
  })
}
