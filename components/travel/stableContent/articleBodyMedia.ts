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
import { familyRouteOfMediaUrl, isLegacyStorageBucketUrl } from '@/utils/mediaUrl'
import { resolveManifestImageRungs, type ManifestImageRung } from '@/utils/travelMediaVariants'
import { unwrapWeservImageUrl } from '@/utils/weservImageUrl'

/** Ключ изображения → его ступени из манифеста, по возрастанию ширины. */
export type ArticleBodyMediaIndex = ReadonlyMap<string, readonly ManifestImageRung[]>

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
 */
const mediaKeysOfUrl = (value: string): string[] => {
  const raw = String(value || '').trim()
  if (!raw || /^(data:|blob:)/i.test(raw)) return []

  try {
    const decoded = raw.replace(/&amp;/gi, '&')
    const unwrapped = unwrapWeservImageUrl(decoded)
    const absolute = unwrapped.startsWith('//') ? `https:${unwrapped}` : unwrapped
    const { pathname } = new URL(absolute, RELATIVE_URL_BASE)
    if (!pathname || pathname === '/') return []

    const keys = [pathname]
    try {
      const decodedPath = decodeURIComponent(pathname)
      if (decodedPath !== pathname) keys.push(decodedPath)
    } catch {
      // Битая процент-последовательность: остаётся сырой путь.
    }
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

  const index = new Map<string, readonly ManifestImageRung[]>()
  for (const entry of gallery) {
    const rungs = resolveManifestImageRungs(entry).filter((rung) => !isLegacyStorageBucketUrl(rung.url))
    if (!rungs.length) continue
    for (const key of mediaKeysOfUrl(rungs[0].url)) {
      if (!index.has(key)) index.set(key, rungs)
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

  const entry = mediaKeysOfUrl(src).reduce<readonly ManifestImageRung[] | undefined>(
    (found, key) => found ?? index.get(key),
    undefined,
  )
  if (!entry?.length) return null

  const ceiling = familyDerivativeCeiling(familyRouteOfMediaUrl(src))
  const withinFamily = ceiling ? entry.filter((rung) => rung.width <= ceiling) : entry
  // Семейство целиком ниже самой мелкой ступени манифеста — берём её одну, иначе
  // кандидатов не осталось бы вовсе.
  const available = withinFamily.length ? withinFamily : [entry[0]]

  const chosen = new Map<number, ManifestImageRung>()
  for (const slotWidth of slotWidths) {
    const rung = pickManifestRung(available, slotWidth)
    if (rung) chosen.set(rung.width, rung)
  }

  return Array.from(chosen.values()).sort((a, b) => a.width - b.width)
}
