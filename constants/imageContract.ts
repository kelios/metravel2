// constants/imageContract.ts
//
// Здесь живут ДВА разных, но связанных контракта:
//
// 1. `IMAGE_STORAGE_POLICY_V1` — целевой набор файлов, которые backend хранит в
//    S3 после upload/backfill. Это не вся capability-лестница resize-proxy.
// 2. `IMAGE_WIDTHS` — наборы кандидатов текущих ключевых frontend-consumers на
//    время двусторонней миграции. Пока backend ещё умеет динамический resize,
//    отдельные legacy-consumers могут проходить через более широкую proxy-лестницу.
//
// Смешение этих двух уровней породило противоречие «2–3 файла на изображение»,
// хотя реальные responsive-наборы требуют до десяти производных. Полное описание
// и порядок двустороннего релиза — `docs/features/images.md` §3–4.

/** Каноническое качество одного сохраняемого WebP-варианта. */
export const IMAGE_QUALITY = {
  /** Мелкие производные: аватары, миниатюры, плитки каталога. */
  small: 70,
  /** Крупные web-производные: hero, галерея, тело статьи. */
  large: 80,
  /** Мастер и print-производная: upload encoder уже сохраняет мастер с q85. */
  master: 85,
  print: 85,
  /**
   * Обложка квеста — отдельный storage-profile. q60 сохраняется намеренно:
   * production-замер 2026-07-31 дал 1 918 B для w320 и 5 390 B для w640 при
   * достаточной резкости на DPR2. Это не правило для всех файлов шириной 480.
   */
  questCover: 60,
} as const;

export const IMAGE_STORAGE_POLICY_VERSION = 1 as const;
export const IMAGE_STORAGE_FORMAT = 'webp' as const;

export type StoredImageVariant = Readonly<{
  width: number;
  quality: number;
}>;

export type ImageStorageProfile = Readonly<{
  /** Публичные family-роуты, которые используют этот профиль. */
  routes: readonly string[];
  master: StoredImageVariant;
  derivatives: readonly StoredImageVariant[];
}>;

/**
 * Целевая S3 policy v1: один q85-мастер плюс все реально нужные производные.
 *
 * Quality определяется парой `(storage profile, width)`, а не одной шириной:
 * `questCover/480` хранится с q60, тогда как `travelMedia/480` — с q70. Один
 * source принадлежит ровно одному профилю, поэтому ключ
 * `d/v1/<source-key>/<width>.webp` остаётся однозначным.
 *
 * Ширина мастера в `derivatives` не встречается: точную ширину мастера backend
 * отдаёт МАСТЕРОМ с `no-store` by design, поэтому слотам её просить нельзя.
 * Исключение `articleBody/1920` прожило меньше суток: бэкенд завёл `content_1920`
 * (#1215) и тем же днём снял её shrink-коммитом `9136878` («SHALL NOT expose …
 * content_1920, regardless of durable-read coverage state»). Инвариант охраняет
 * `__tests__/constants/imageContract.test.ts` (`includesMaster: false`).
 */
export const IMAGE_STORAGE_POLICY_V1 = {
  avatar: {
    routes: ['avatar'],
    master: { width: 320, quality: IMAGE_QUALITY.master },
    derivatives: [
      { width: 96, quality: IMAGE_QUALITY.small },
      { width: 160, quality: IMAGE_QUALITY.small },
    ],
  },
  badge: {
    routes: ['badge-image'],
    master: { width: 320, quality: IMAGE_QUALITY.master },
    derivatives: [
      { width: 96, quality: IMAGE_QUALITY.small },
      { width: 160, quality: IMAGE_QUALITY.small },
    ],
  },
  questCover: {
    routes: ['quest-cover'],
    master: { width: 1200, quality: IMAGE_QUALITY.master },
    derivatives: [320, 480, 640, 800].map((width) => ({
      width,
      quality: IMAGE_QUALITY.questCover,
    })),
  },
  routePoint: {
    routes: ['address-image'],
    master: { width: 1200, quality: IMAGE_QUALITY.master },
    derivatives: [
      { width: 320, quality: IMAGE_QUALITY.small },
      { width: 480, quality: IMAGE_QUALITY.small },
      { width: 640, quality: IMAGE_QUALITY.small },
      { width: 800, quality: IMAGE_QUALITY.large },
      { width: 960, quality: IMAGE_QUALITY.large },
    ],
  },
  questSupplement: {
    routes: ['quest-step-image', 'quest-poster'],
    master: { width: 1200, quality: IMAGE_QUALITY.master },
    derivatives: [
      { width: 320, quality: IMAGE_QUALITY.small },
      { width: 480, quality: IMAGE_QUALITY.small },
      { width: 640, quality: IMAGE_QUALITY.small },
      { width: 800, quality: IMAGE_QUALITY.large },
    ],
  },
  tripCover: {
    routes: ['trip-cover'],
    master: { width: 1200, quality: IMAGE_QUALITY.master },
    derivatives: [
      { width: 320, quality: IMAGE_QUALITY.small },
      { width: 480, quality: IMAGE_QUALITY.small },
      { width: 640, quality: IMAGE_QUALITY.small },
      { width: 800, quality: IMAGE_QUALITY.large },
      { width: 960, quality: IMAGE_QUALITY.large },
    ],
  },
  travelMedia: {
    routes: ['travel-image', 'gallery'],
    master: { width: 2500, quality: IMAGE_QUALITY.master },
    derivatives: [
      { width: 96, quality: IMAGE_QUALITY.small },
      { width: 160, quality: IMAGE_QUALITY.small },
      { width: 320, quality: IMAGE_QUALITY.small },
      { width: 480, quality: IMAGE_QUALITY.small },
      { width: 640, quality: IMAGE_QUALITY.small },
      { width: 720, quality: IMAGE_QUALITY.large },
      { width: 800, quality: IMAGE_QUALITY.large },
      { width: 960, quality: IMAGE_QUALITY.large },
      { width: 1280, quality: IMAGE_QUALITY.large },
      { width: 1600, quality: IMAGE_QUALITY.print },
    ],
  },
  articleBody: {
    routes: ['travel-description-image'],
    master: { width: 1920, quality: IMAGE_QUALITY.master },
    /**
     * Ровно четыре ступени — зеркало `ARTICLE_BODY_PROFILE` бэкенда после
     * shrink-коммита `9136878` (2026-08-10, openspec
     * `shrink-article-body-derivative-profile`): `content_480` q70, `content_800`
     * q80, `content_960` q80, `content_1600` q85. Ступени 320/640/1920 сняты
     * бэкендом намеренно, спека прямо запрещает их раздавать («SHALL NOT expose
     * content_320, content_640, or content_1920»); точная ширина мастера 1920
     * отдаётся мастером с `no-store`, а 1601…1919 в durable-режиме отвечают 400.
     *
     * История #1373 — двойной дрейф за одни сутки. Бэкенд завёл производную
     * `content_1920` (#1215), FE успел её отзеркалить (проба прода 2026-08-10
     * 23:41: `w=1920` → 200 `stored-derivative` `immutable`), а тем же днём в
     * 00:38 бэкенд уже закоммитил shrink, и наутро 2026-08-11 прод отдавал сжатый
     * профиль: манифест travel 544 — `srcset` 480/800/960/1600, `variants` без
     * `content_1920`; `proxy-contract` — `article_body` requested
     * `durable_s3_derivatives`, active `dynamic_transform`, покрытие сброшено под
     * новый профиль. Пока чтение fail-open, ЛЮБАЯ ширина отвечает 200
     * `dynamic-transform`, поэтому «на проде работает» — не аргумент: зеркало
     * равняется на durable-цель профиля, а не на переходный режим.
     */
    derivatives: [
      { width: 480, quality: IMAGE_QUALITY.small },
      { width: 800, quality: IMAGE_QUALITY.large },
      { width: 960, quality: IMAGE_QUALITY.large },
      { width: 1600, quality: IMAGE_QUALITY.print },
    ],
  },
} as const satisfies Record<string, ImageStorageProfile>;

/**
 * Ширины ключевых frontend-слотов в переходном runtime.
 *
 * Это subsets целевых storage-профилей, а не обещание «столько файлов всего».
 * Legacy-consumers переводятся на w-only family policy двусторонним релизом с
 * backend; до него `utils/imageProxy.ts` продолжает знать полную capability-
 * лестницу текущего resize-proxy.
 */
export const IMAGE_WIDTHS = {
  /**
   * 100vw mobile: 390 CSS @DPR2 просит 780 → кандидат 800. Ступеней 320/640 у
   * профиля больше нет (shrink `9136878`), поэтому пол набора — 480. Потолок 800
   * намеренный: выше — плата мобильным трафиком за невидимую на 390 CSS резкость.
   */
  articleBodyMobile: [480, 800],
  /**
   * Потолок — 1600, верхняя ПРОИЗВОДНАЯ профиля `articleBody`.
   *
   * Ступень 1920 в этом наборе жила дважды и оба раза снята. 2026-08-03 — как
   * ширина МАСТЕРА: с fail-closed чтением `?w=1920` начал отвечать 400 (замер
   * прода, `media-resize/legacy/3508/…-detail_hd.jpg`: `w=1600` → 200 stored-
   * derivative, `w=1920` → 400), на desktop @DPR2 браузер выбирал из srcset
   * именно её, и 22 из 34 запросов тела статьи падали. 2026-08-10 — как
   * производная `content_1920` (#1215): прожила меньше суток — бэкенд снял её
   * shrink-коммитом `9136878` вместе с 320/640, точная 1920 снова отдаётся
   * мастером с `no-store`, а 1601…1919 в durable-режиме — 400 (см. `articleBody`).
   *
   * Слот 920 CSS на 1920vw @DPR2 просит 1840 и закрывается 1600 с апскейлом
   * ×1.15 — осознанная цена решения бэкенда, а не дефект набора: браузер тянет
   * кэшируемую производную вместо `no-store`-мастера. Ступень 1600 нужна и слоту
   * 720 CSS @DPR2 (1440).
   */
  articleBodyDesktop: [480, 800, 960, 1600],

  /** Hero travel: mobile DPR2 до 720, desktop-контейнер до 1280. */
  travelHeroMobile: [320, 480, 640, 720],
  travelHeroDesktop: [720, 960, 1280],

  /** Quest card 320–420 CSS × DPR до 2. */
  questCover: [320, 480, 640, 800],

  /** Travel master и print-производная для inline/PDF content. */
  printFull: 2500,
  printInline: 1600,
  /**
   * Миниатюра точки в карточке координат книги: слот 80 CSS px, при печати в
   * 300 DPI это ~250 px, то есть ступень 320. Просить сюда `printInline` нельзя:
   * у `routePoint` такой ступени нет, и запрос уходит в мастер, который отдаётся
   * `no-store` — 47 некэшируемых ответов на одну книгу вместо `immutable`.
   */
  printThumb: 320,
} as const;

/**
 * Публичный роут семейства → его ПРОИЗВОДНЫЕ (по возрастанию, без мастера).
 *
 * Выводится из `IMAGE_STORAGE_POLICY_V1`, а не перечисляется руками: ровно на
 * ручной копии такой таблицы уже ловились расхождения (#1170, #1220).
 */
export const DERIVATIVE_WIDTHS_BY_ROUTE: ReadonlyMap<string, readonly number[]> = new Map(
  Object.values(IMAGE_STORAGE_POLICY_V1).flatMap((profile) => {
    const widths = Object.freeze(
      profile.derivatives.map((variant) => variant.width).sort((a, b) => a - b),
    );
    return profile.routes.map((route) => [route, widths] as const);
  }),
);

/**
 * Верхняя ПРОИЗВОДНАЯ семейства, или `null` — путь вне известных роутов.
 *
 * Потолок нужен и тем, кто строит URL сам, и тем, кто берёт готовые из манифеста:
 * `media.article_body` помечает профилем `article_body` каждую картинку тела, включая
 * ключи чужих семейств, и обещает им ступень 1600. Замер прода 2026-08-04,
 * `address-image/15601/conversions/…webp` (реальный профиль `routePoint`, верхняя
 * производная 960): `w=800`/`w=960` → 200 `immutable`, `w=1600` → **400** и на
 * family-роуте, и на `/media-resize/legacy/`. То есть манифест здесь переобещает, и
 * подставлять его ступени без клэмпа нельзя — это ровно регресс #1233.
 */
export function familyDerivativeCeiling(route: string | null | undefined): number | null {
  const widths = route ? DERIVATIVE_WIDTHS_BY_ROUTE.get(route) : undefined;
  return widths?.length ? widths[widths.length - 1] : null;
}

/**
 * Потолок для первопартийного URL, чьё семейство определить НЕЛЬЗЯ.
 *
 * Такой URL — это legacy-роут `/media-resize/legacy/<id>/conversions/…` (или ссылка
 * в бакет, которая в него переписывается): первый сегмент пути там `media-resize`
 * либо id записи, а не роут семейства, поэтому профиль по адресу не читается.
 *
 * Значение — САМЫЙ УЗКИЙ из профилей, достижимых через этот роут, а не самый
 * широкий. `GET /api/media/proxy-contract` (замер 2026-08-10) отдаёт для класса
 * `legacy_conversion` ровно два семейства: `travel` (верхняя производная 1600,
 * 3 385 мастеров) и `route_point` (960, 2 529). Угадать, какое из них за конкретным
 * id, нельзя, а ошибка несимметрична: лишняя ступень — это fail-closed 400, то есть
 * битое фото у читателя (замер `address-image/15601/conversions/…webp`: `w=1600` →
 * 400 и на family-роуте, и на `/media-resize/legacy/`), тогда как заниженная —
 * всего лишь менее резкий кадр.
 *
 * Раньше такие URL не клэмпились вовсе, и это было безопасно только потому, что
 * набор `articleBodyDesktop` сам обрывался на 1600 — свойство набора, а не роута
 * (проба 2026-08-10 по `legacy/682/conversions/…webp`: `w=1600` → 200
 * `stored-derivative`, `w=1920` → **400**). Клэмп введён с #1373 и остаётся при
 * любом составе набора: у `route_point`-конверсий уже ступень 1600 — это 400 и
 * битое фото, и защита читателя не должна держаться на том, каким набор слота
 * случайно оказался сегодня.
 *
 * Область — лестница тела статьи (`components/travel/stableContent/htmlTransform.ts`),
 * то есть единственное место, где набор слота встречается с непроверяемым адресом.
 * `optimizeImageUrl` этот потолок не применяет: его вызывающие передают ширины из
 * собственных контрактных наборов, включая осознанный запрос мастера для печати
 * (`printFull` 2500), и общий клэмп сломал бы именно его.
 */
export const UNKNOWN_FAMILY_DERIVATIVE_CEILING: number = Math.min(
  ...[IMAGE_STORAGE_POLICY_V1.travelMedia, IMAGE_STORAGE_POLICY_V1.routePoint].map((profile) =>
    Math.max(...profile.derivatives.map((variant) => variant.width)),
  ),
);

/*
 * Здесь был `LEGACY_UPLOAD_TRANSFORM_FORMAT = 'jpeg'` — временный обход #1233,
 * снят в #1753 как ставший вредным.
 *
 * Обход просил класс `uploads/**` явным `f=jpeg`, потому что в proxy-contract v7
 * это было объявленное поведение: `route_behavior.legacy_upload
 * .explicit_format_overrides = {"jpeg": "transform"}` уводил класс в
 * динамический ресайз, и лестница отвечала 200, пока webp-ветка отдавала 404 на
 * каждой ступени.
 *
 * В v16 то же поле объявлено как `{"jpeg": "unsupported_format"}`: динамический
 * ресайз убран вместе с #1168, и явный `f=jpeg` теперь получает **400**
 * `unsupported-format`. Замер прода 2026-09-04,
 * `media-resize/uploads/1620061579IMG_6533.JPG?w=800&q=80&fit=contain`:
 * с `&f=jpeg` → 400, без него → 200 `stored-master-fallback`, 190 060 B. По
 * access-log прода за 72 часа обход давал 17 запросов и 17 ответов 400 на живой
 * опубликованной странице — то есть три фотографии просто не отрисовывались.
 *
 * Сегодня класс держится на объявленной v16 политике
 * `missing_derivative: v1_then_master_no_transform`: любой `w` из лестницы
 * отдаёт мастер целиком (замер 2026-09-04, тот же ключ: w=320|480|640|800|960|
 * 1200|1600 → 200, 190 060 B на каждой ступени, `cache-control: no-store`).
 * Картинка видна, но ширина на вес не влияет и кэш её не держит.
 *
 * Настоящее лечение осталось прежним и лежит на backend: durable-производные
 * для ключей `uploads/**`, реально упомянутых в телах статей. Пока их нет,
 * `LEGACY_UPLOAD_FIXED_WIDTH` ниже держит для класса ОДНУ ширину, чтобы
 * мастер хотя бы не качался в нескольких вариантах одного слота.
 */

/**
 * Единственная ширина класса `uploads/**` — лестница здесь не нужна (#1233).
 *
 * Обмер 160 мастеров класса на проде 2026-08-04: ширина **500…1000 px**,
 * медиана 750, шире 1024 нет ни одного файла. Это не выборка «мелких», а весь
 * класс: legacy-загрузки приходили из редактора уже ужатыми.
 *
 * Отсюда следует, что ступени выше 800 для него — фикция. Замер того же дня:
 *
 * | ключ (ширина мастера) | мастер | w800 | w960 | w1600 |
 * |---|---|---|---|---|
 * | `1591264022IMG_5838.jpg` (≤800) | 136 637 | 95 789 | 95 789 | 95 789 |
 * | `1591264094IMG_5870.jpg` (≤800) | 148 034 | 100 171 | 100 171 | 100 171 |
 * | `1591876434DSC_0089.JPG` (~1000) | 273 905 | 110 500 | 156 890 | 185 587 |
 * | `1592240006IMG_6121.JPG` (~1000) | 178 548 | 72 033 | 101 526 | 123 715 |
 *
 * Колонки `w*` сняты на ещё живой ветке динамического ресайза (`f=jpeg`). Сегодня
 * её нет вовсе: по `v1_then_master_no_transform` любая ширина отдаёт мастер
 * (надгробие выше). Таблица нужна как обоснование ширины для backfill, а не как
 * описание сегодняшней выдачи — по весу отсюда ничего заключать нельзя.
 *
 * У 56% класса ступени 800/960/1600 отдают байт в байт один файл (`upscale: false`),
 * у остальных — те же 1000 px, но на 40–70% тяжелее. То есть верхние ступени
 * покупают ноль пикселей за реальные байты.
 *
 * 800 выбрано по слоту, а не «на глаз»: мобильный слот 100vw при 390 CSS @DPR2 —
 * это ровно 780. На desktop слот 720/920 CSS, и @DPR2 ему нужно 1440/1840 — но
 * такого исходника в классе не существует вовсе, поэтому просить больше нечего:
 * максимум, что удалось бы добрать, это 1000 px за +40% веса.
 *
 * Практический вывод для backfill (#1222): классу `uploads/**` нужна **одна**
 * производная на ключ, а не шесть ступеней профиля `articleBody`. Это 6 066
 * файлов вместо ~36 000.
 */
export const LEGACY_UPLOAD_FIXED_WIDTH = 800;

/**
 * Ширина картинки для соцпревью (og:image / twitter:image / JSON-LD).
 *
 * Facebook и Twitter под `summary_large_image` просят от 1200 px, поэтому целимся
 * в 1280 — но берём только ту ступень, которая у семейства реально есть: спрашивать
 * ширину вне `derivatives` больше нельзя, чтение fail-closed и отвечает 400 (#1224).
 * У `articleBody` ступени 1280 нет вовсе, там выбирается 960.
 */
export const SOCIAL_PREVIEW_TARGET_WIDTH = 1280;

/**
 * Ступень семейства для соцпревью: самая крупная производная не шире целевой,
 * иначе — самая мелкая (у семейства просто нет ступени такого размера).
 * `null` — путь не принадлежит ни одному family-роуту, ширину добавлять нельзя.
 */
export function socialPreviewWidthForRoute(route: string): number | null {
  const widths = DERIVATIVE_WIDTHS_BY_ROUTE.get(route);
  if (!widths?.length) return null;
  const withinTarget = widths.filter((width) => width <= SOCIAL_PREVIEW_TARGET_WIDTH);
  return withinTarget.length ? withinTarget[withinTarget.length - 1] : widths[0];
}

/**
 * Ownership-роут в начале пути: `/gallery/…`, `/address-image/…` и т.д.
 * По нему определяется семейство, а значит и доступные ступени ширины.
 */
const OWNERSHIP_ROUTE_PATTERN = /^\/([a-z-]+)\//i;

/** Family-роут из пути URL, или `null` — путь не принадлежит семейству. */
export function familyRouteFromPathname(pathname: string): string | null {
  return OWNERSHIP_ROUTE_PATTERN.exec(String(pathname || ''))?.[1]?.toLowerCase() ?? null;
}

/**
 * Публичный роут семейства → ширины, которые он реально обслуживает: производные
 * ПЛЮС мастер. Отдельно от `DERIVATIVE_WIDTHS_BY_ROUTE`, потому что печати мастер
 * доступен и нужен, а слоту в вёрстке — нет.
 */
export const REQUESTABLE_WIDTHS_BY_ROUTE: ReadonlyMap<string, readonly number[]> = new Map(
  Object.values(IMAGE_STORAGE_POLICY_V1).flatMap((profile) => {
    const widths = Object.freeze(
      Array.from(
        new Set([...profile.derivatives.map((variant) => variant.width), profile.master.width]),
      ).sort((a, b) => a - b),
    );
    return profile.routes.map((route) => [route, widths] as const);
  }),
);

/**
 * Ступень семейства для печати: самая мелкая из обслуживаемых, которая не ниже
 * целевой, иначе — мастер. `null` — путь не принадлежит family-роуту, ширину
 * подбирать нечем и решает вызывающий код.
 *
 * Печать целится в 2500 (`printFull`) и 1600 (`printInline`), а у половины
 * семейств таких ступеней нет вовсе. Пока чтение производных было fail-open,
 * прокси резал недостающую ширину динамически; после
 * `MEDIA_IMAGE_DERIVATIVE_READ_ENABLED` он отвечает 400 — тот же fail-closed,
 * из-за которого соцпревью уехало в #1224.
 *
 * Замер прода 2026-08-04, `address-image/15057/conversions/4cd326b4….webp`
 * (профиль `routePoint`, производные до 960, мастер 1200):
 * `w=960|1200` → 200, `w=1600|1920|2500` → **400** (52 B). PDF просил 1600 на
 * КАЖДУЮ картинку, поэтому в книге пропадали и фото точек в теле статьи
 * (14 из 37 в travel 682), и миниатюры в карточках координат: `onerror`
 * прятал `<img>` и оставлял пустой серый слот.
 */
export function printWidthForRoute(route: string, targetWidth: number): number | null {
  const widths = REQUESTABLE_WIDTHS_BY_ROUTE.get(route);
  if (!widths?.length) return null;
  return widths.find((width) => width >= targetWidth) ?? widths[widths.length - 1];
}

/** Ширины ключевых frontend-consumers — для transition-проверок. */
export const ALL_CONTRACT_WIDTHS: readonly number[] = Object.freeze(
  Array.from(
    new Set(
      Object.values(IMAGE_WIDTHS).flatMap((value) =>
        typeof value === 'number' ? [value] : [...value],
      ),
    ),
  ).sort((a, b) => a - b),
);

/** Все ширины, которые policy v1 действительно хранит в S3, включая мастера. */
export const ALL_STORED_IMAGE_WIDTHS: readonly number[] = Object.freeze(
  Array.from(
    new Set(
      Object.values(IMAGE_STORAGE_POLICY_V1).flatMap((profile) => [
        profile.master.width,
        ...profile.derivatives.map((variant) => variant.width),
      ]),
    ),
  ).sort((a, b) => a - b),
);
