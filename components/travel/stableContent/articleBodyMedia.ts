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

import type { TravelMediaGroup } from '@/types/types'
import {
  isLegacyStorageBucketUrl,
  isLegacyUploadResizeUrl,
  toLegacyResizePath,
} from '@/utils/mediaUrl'
import {
  resolveManifestImageRungs,
  selectWidthCandidates,
  type ManifestImageRung,
} from '@/utils/travelMediaVariants'
import { unwrapWeservImageUrl } from '@/utils/weservImageUrl'

/** Ключ изображения → ступени манифеста по возрастанию ширины, адреса резолвнуты. */
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
 * Ступень манифеста, которую нельзя подставлять в разметку.
 *
 * Два класса, оба legacy:
 *
 * - адрес остался прямой ссылкой в бакет. Бакет не понимает `?w=` и отдаёт
 *   мастер — 141 354 B против 7 820 B на `?w=320` через свой роут (#1176);
 * - ключ `uploads/**`, даже уже переписанный на `/media-resize/uploads/…`.
 *   Durable-производных у класса нет вовсе: любая ступень отдаёт мастер целиком
 *   с `no-store` по политике `v1_then_master_no_transform` (proxy-contract v16),
 *   то есть ступени манифеста для класса всё так же непригодны — они обещают
 *   вес, которого не будет. Сегодня манифест их и не отдаёт (`srcset: null`), но
 *   проверять надо по ключу, а не по факту пустого поля.
 */
const isUnusableManifestRung = (url: string): boolean =>
  isLegacyStorageBucketUrl(url) || isLegacyUploadResizeUrl(url)

/**
 * Индекс манифеста тела статьи, либо `null` — годных ступеней нет ни у одного кадра.
 *
 * Кадры, у которых не осталось ни одной пригодной ступени, пропускаются молча, и
 * это штатный случай: у внешних картинок и legacy-классов готовых производных не
 * существует, манифест отдаёт им один `src` на исходный файл. Такие ключи идут
 * прежним клиентским путём.
 */
export const buildArticleBodyMediaIndex = (
  group: TravelMediaGroup | null | undefined,
): ArticleBodyMediaIndex | null => {
  const gallery = group?.gallery
  if (!gallery?.length) return null

  const index = new Map<string, readonly ManifestImageRung[]>()
  for (const item of gallery) {
    const rungs = resolveManifestImageRungs(item).filter((rung) => !isUnusableManifestRung(rung.url))
    if (!rungs.length) continue

    // Ключи считаем от НЕПЕРЕПИСАННОГО адреса манифеста: `resolveMediaVariantUrl`
    // переводит conversion-ключ на `/media-resize/legacy/…`, а разметка тела
    // ссылается на family-роут, и без исходного адреса стороны не встретились бы.
    const originalUrl = String(item?.src || '').trim() || rungs[0].url
    const keys = mediaKeysOfUrl(originalUrl)
    if (!keys.length) continue

    for (const key of [...keys, ...mediaKeysOfUrl(rungs[0].url)]) {
      if (!index.has(key)) index.set(key, rungs)
    }
  }

  return index.size ? index : null
}

/**
 * Кандидаты `srcset` для картинки тела: ступени манифеста, отобранные под слот.
 *
 * Ступени берутся ДОСЛОВНО — своего потолка семейства здесь больше нет (#1261).
 * Он стоял тут с #1233, пока манифест строил лестницу по слоту-потребителю и
 * обещал ступень 1600 ключам чужих семейств: у `address-image` верхняя реальная
 * производная 960, и `w=1600` отвечал 400. После #1260 лестницу определяет
 * профиль ИСТОЧНИКА, и манифест перестал переобещать: замер прода 2026-08-05 на
 * `address-image/15601/conversions/…webp` — `storage_policy.profile: route_point`,
 * `srcset` обрывается на 960; обход 4 статей (885 URL) даёт 0 non-200.
 *
 * Держать после этого свою копию потолков нельзя: две таблицы ширин расходятся
 * молча (#1170, #1220), а фронтовая ещё и слепа к `/media-resize/legacy/…`, где
 * роут семейства уже не виден. Регресс контракта ловит не клиентский клэмп, а
 * пост-деплой гейт: он обходит КАЖДУЮ ступень `media.article_body[*].srcset` и
 * сверяет верхнюю с профилем семейства (`scripts/post-deploy-media-check.js`).
 *
 * Отбор под слот остаётся, и к семействам он отношения не имеет: слот решает,
 * какие ступени вообще предлагать. На мобиле 100vw при DPR 3 просит 1170, и с
 * полной лестницей браузер взял бы 1600 — на выборке из 10 кадров статьи 544 это
 * 1 403 792 B против 946 638 B на ступени 800, то есть +48% мобильного трафика за
 * резкость, невидимую на 390 CSS.
 *
 * Ступени слота — это ЗАПРОС, а не адрес: каждая ложится на ближайшую ступень
 * манифеста, поэтому смена набора производных на бэкенде правки фронта не требует.
 * `null` — ключа в манифесте нет, вызывающий код строит URL прежним путём.
 */
export const resolveArticleBodyRungs = (
  src: string,
  index: ArticleBodyMediaIndex | null | undefined,
  slotWidths: readonly number[],
): readonly ManifestImageRung[] | null => {
  if (!index?.size) return null

  const rungs = mediaKeysOfUrl(src).reduce<readonly ManifestImageRung[] | undefined>(
    (found, key) => found ?? index.get(key),
    undefined,
  )
  if (!rungs?.length) return null

  return selectWidthCandidates(rungs, slotWidths)
}
