// components/travel/stableContent/articleBodyMedia.ts
//
// #1256: тело статьи берёт ГОТОВЫЕ адреса из `media.article_body`, а не собирает
// их само. До этого `htmlTransform` был последним местом на фронте, которое
// строило медиа-URL руками (`?w=…&q=80&fit=contain` плюс своя копия лестницы):
// #1203 перевёл на манифест обложку, галерею, точки и квесты, но тело статьи
// получило манифест позже и осталось на клиентской сборке.
//
// Здесь только сопоставление разметки с манифестом и отбор ступеней. Какой у
// слота размер (`sizes`) и какие ступени ему вообще уместны — знание вёрстки, оно
// остаётся в `htmlTransform`.

import { familyDerivativeCeiling } from '@/constants/imageContract'
import type { TravelMediaGroup } from '@/types/types'
import {
  familyRouteOfMediaUrl,
  isLegacyStorageBucketUrl,
  toLegacyResizePath,
} from '@/utils/mediaUrl'
import { resolveManifestImageRungs, type ManifestImageRung } from '@/utils/travelMediaVariants'
import { unwrapWeservImageUrl } from '@/utils/weservImageUrl'

export type ArticleBodyMediaEntry = {
  /** Ступени манифеста по возрастанию ширины, адреса уже резолвнуты. */
  rungs: readonly ManifestImageRung[]
  /**
   * Верхняя реальная производная семейства ИСХОДНОГО адреса, или `null`.
   *
   * Считается при сборке индекса, а не при выдаче: к моменту выдачи адрес может
   * быть уже переписан на `/media-resize/legacy/…`, где первый сегмент ключа — id
   * записи, а не роут, и семейство по нему не определяется (#1233).
   */
  ceiling: number | null
}

/** Ключ изображения → что манифест обещает по этому ключу. */
export type ArticleBodyMediaIndex = ReadonlyMap<string, ArticleBodyMediaEntry>

/** База для разбора корне-относительных адресов; в результат не попадает. */
const RELATIVE_URL_BASE = 'https://metravel.by'

/**
 * Ключи, под которыми один и тот же файл может встретиться в манифесте и в разметке.
 *
 * Ключ — это pathname, а не полный URL: хост у одного файла разный по делу
 * (`metravel.by`, `cdn.metravel.by`, настроенный `EXPO_PUBLIC_API_URL`), а
 * query несёт то ступень (`?w=1600` в манифесте), то cache-buster (`?v=3315` в
 * разметке). Сравнивать их бессмысленно — адресует файл именно путь.
 *
 * Вторым ключом идёт раскодированный путь: редактор кладёт в HTML
 * процент-кодированное имя (`%D0%98…jpg`), а сериализатор может отдать то же имя
 * как есть, и тогда строки не совпадут при одном и том же файле.
 *
 * Третьим — путь resize-роута. Один и тот же conversion-ключ адресуется двумя
 * способами: разметка тела ссылается на family-роут (`/address-image/…`,
 * `/gallery/…`), а `resolveMediaVariantUrl` переводит адреса манифеста на
 * `/media-resize/legacy/…` (#1195). Без общего ключа обе стороны индекса просто
 * не встретились бы, и манифест не применился бы ни к одной такой картинке.
 */
const mediaKeysOfUrl = (value: string): string[] => {
  const raw = String(value || '').trim()
  if (!raw || /^(data:|blob:)/i.test(raw)) return []

  const push = (keys: string[], pathname: string) => {
    if (!pathname || pathname === '/' || keys.includes(pathname)) return
    keys.push(pathname)
    try {
      const decodedPath = decodeURIComponent(pathname)
      if (decodedPath !== pathname && !keys.includes(decodedPath)) keys.push(decodedPath)
    } catch {
      // Битая процент-последовательность: остаётся сырой путь.
    }
  }

  try {
    const decoded = raw.replace(/&amp;/gi, '&')
    const unwrapped = unwrapWeservImageUrl(decoded)
    const absolute = unwrapped.startsWith('//') ? `https:${unwrapped}` : unwrapped

    const keys: string[] = []
    push(keys, new URL(absolute, RELATIVE_URL_BASE).pathname)
    push(keys, String(toLegacyResizePath(absolute) || '').split('?')[0])
    return keys
  } catch {
    return []
  }
}

/**
 * Индекс манифеста тела статьи, либо `null` — годных ступеней нет ни у одного кадра.
 *
 * Элементы без `srcset` пропускаются молча, и это штатный случай, а не потеря
 * данных: у legacy-класса `uploads/**` и у внешних картинок готовых производных
 * не существует, манифест отдаёт им один `src` на исходный файл. Для `uploads/**`
 * это ссылка прямо в бакет, который игнорирует `?w=` и отвечает мастером —
 * подставить её в разметку значит вернуть #1176. Такие ключи идут прежним путём.
 */
export const buildArticleBodyMediaIndex = (
  group: TravelMediaGroup | null | undefined,
): ArticleBodyMediaIndex | null => {
  const gallery = group?.gallery
  if (!gallery?.length) return null

  const index = new Map<string, ArticleBodyMediaEntry>()
  for (const item of gallery) {
    const rungs = resolveManifestImageRungs(item).filter((rung) => !isLegacyStorageBucketUrl(rung.url))
    if (!rungs.length) continue

    // Ключи считаем от НЕПЕРЕПИСАННОГО адреса манифеста: у него ещё виден
    // family-роут, из которого берётся и потолок семейства, и второй алиас.
    const originalUrl = String(item?.src || '').trim() || rungs[0].url
    const keys = mediaKeysOfUrl(originalUrl)
    if (!keys.length) continue

    const entry: ArticleBodyMediaEntry = {
      // Семейство ищется по всем алиасам ключа: у `/media-resize/legacy/…` его не
      // определить, поэтому потолок даёт тот алиас, у которого роут ещё виден.
      ceiling: keys.reduce<number | null>(
        (found, key) => found ?? familyDerivativeCeiling(familyRouteOfMediaUrl(key)),
        null,
      ),
      rungs,
    }
    for (const key of [...keys, ...mediaKeysOfUrl(rungs[0].url)]) {
      if (!index.has(key)) index.set(key, entry)
    }
  }

  return index.size ? index : null
}

/**
 * Ступень, которую браузер возьмёт для слота шириной `targetWidth`: минимальный
 * кандидат, покрывающий слот, иначе самый широкий. Правило то же, что в HTML-спеке.
 */
export const pickManifestRung = (
  rungs: readonly ManifestImageRung[],
  targetWidth: number,
): ManifestImageRung | null => {
  if (!rungs.length) return null
  return rungs.find((rung) => rung.width >= targetWidth) ?? rungs[rungs.length - 1]
}

/**
 * Кандидаты `srcset` для картинки тела: ступени манифеста, отобранные под слот.
 *
 * Почему не весь `srcset` манифеста дословно — две причины, обе измерены на проде
 * 2026-08-04.
 *
 * 1. Манифест перечисляет всю лестницу семейства (320…1600) и помечает профилем
 *    `article_body` даже ключи чужих семейств. У `address-image` верхняя реальная
 *    производная — 960, и `w=1600` отвечает **400**. Поэтому потолок семейства
 *    остаётся обязательным (#1233), см. `familyDerivativeCeiling`.
 * 2. Слот решает, какие ступени ему вообще предлагать. На мобиле слот 100vw при
 *    DPR 3 просит 1170, и с полной лестницей браузер взял бы 1600: на выборке из
 *    10 кадров статьи 544 это 1 403 792 B против 946 638 B на ступени 800, то есть
 *    +48% мобильного трафика за резкость, невидимую на 390 CSS.
 *
 * Ступени слота — это ЗАПРОС, а не адрес: каждая из них ложится на ближайшую
 * ступень манифеста, поэтому смена набора производных на бэкенде правки фронта не
 * требует. `null` — ключа в манифесте нет, вызывающий код строит URL прежним путём.
 */
export const resolveArticleBodyRungs = (
  src: string,
  index: ArticleBodyMediaIndex | null | undefined,
  slotWidths: readonly number[],
): readonly ManifestImageRung[] | null => {
  if (!index?.size) return null

  const entry = mediaKeysOfUrl(src).reduce<ArticleBodyMediaEntry | undefined>(
    (found, key) => found ?? index.get(key),
    undefined,
  )
  if (!entry?.rungs.length) return null

  const ceiling = entry.ceiling
  const withinFamily = ceiling ? entry.rungs.filter((rung) => rung.width <= ceiling) : entry.rungs
  // Семейство целиком ниже самой мелкой ступени манифеста — берём её одну, иначе
  // кандидатов не осталось бы вовсе.
  const available = withinFamily.length ? withinFamily : [entry.rungs[0]]

  const chosen = new Map<number, ManifestImageRung>()
  for (const slotWidth of slotWidths) {
    const rung = pickManifestRung(available, slotWidth)
    if (rung) chosen.set(rung.width, rung)
  }

  return Array.from(chosen.values()).sort((a, b) => a.width - b.width)
}
