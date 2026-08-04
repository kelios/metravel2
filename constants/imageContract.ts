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
    derivatives: [
      { width: 320, quality: IMAGE_QUALITY.small },
      { width: 480, quality: IMAGE_QUALITY.small },
      { width: 640, quality: IMAGE_QUALITY.small },
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
  /** 100vw mobile; ~720 CSS при 1280vw; ~920 CSS при 1920vw. */
  articleBodyMobile: [320, 480, 640, 800],
  /**
   * Потолок — 1600, последняя ПРОИЗВОДНАЯ профиля `articleBody`. Здесь стояло 1920,
   * то есть ширина мастера: пока backend умел динамический resize, он такой запрос
   * обслуживал. После включения `MEDIA_IMAGE_DERIVATIVE_READ_ENABLED` чтение стало
   * fail-closed, и запрос мастера через `?w=` отвечает 400 — замер прода 2026-08-03,
   * `media-resize/legacy/3508/…-detail_hd.jpg`: `w=1600` → 200 (232 720 B,
   * stored-derivative), `w=1920` → **400** (47 B, no-store). На desktop @DPR2 браузер
   * выбирал из srcset именно 1920, поэтому 22 из 34 запросов тела статьи падали и
   * фото не отрисовывались вовсе.
   *
   * Слот 920 CSS на 1920vw @DPR2 просит 1840 и теперь закрывается 1600 с апскейлом
   * ×1.15 — незаметно на глаз и несопоставимо с битой картинкой. Вернуть 1:1 можно
   * только производной 1920 на стороне backend (#1215), не запросом мастера.
   */
  articleBodyDesktop: [480, 640, 800, 960, 1600],

  /** Hero travel: mobile DPR2 до 720, desktop-контейнер до 1280. */
  travelHeroMobile: [320, 480, 640, 720],
  travelHeroDesktop: [720, 960, 1280],

  /** Quest card 320–420 CSS × DPR до 2. */
  questCover: [320, 480, 640, 800],

  /** Travel master и print-производная для inline/PDF content. */
  printFull: 2500,
  printInline: 1600,
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
 * Формат, которым спрашивается legacy-класс `uploads/**` — ВРЕМЕННАЯ мера (#1233).
 *
 * У этого класса durable-производных нет вообще. Backfill идёт по
 * `IMAGE_FIELD_STORAGE_PROFILES`, то есть по полям живых моделей, а ключи
 * `uploads/**` не поле модели — они вшиты прямо в HTML тел легаси-статей, и в
 * инвентаризации хранилища (`docs/features/images.md` §2.2) весь класс помечен
 * «кандидаты в сироты». Пока чтение производных было fail-open, роут резал
 * динамически и это не было видно. После `MEDIA_IMAGE_DERIVATIVE_READ_ENABLED`
 * чтение стало fail-closed, и КАЖДАЯ ступень лестницы отвечает 404
 * `derivative-missing`.
 *
 * Замер прода 2026-08-04, `media-resize/uploads/1642189225IMG_6113.jpg`:
 * `w=320|480|640|800|960|1600` → 404, `w=1800|2000` → 400, `w=1920` → 200
 * `stored-master` (216 786 B на кадре 800×533). То есть ни один запрос из набора
 * `articleBodyMobile`/`articleBodyDesktop` не отрисовывается. Обход по сайту в тот
 * же день: 5 044 фото в телах 259 из 397 статей.
 *
 * `explicit_format_overrides: {"jpeg": "transform"}` в `route_behavior.legacy_upload`
 * (proxy-contract v7) — объявленное поведение: производные хранятся только как
 * `d/v1/<ключ>/<w>.webp`, поэтому явный `f=jpeg` не может быть stored-производной и
 * обслуживается динамическим ресайзом. Он возвращает 200 и `immutable`, то есть
 * лестница ширин продолжает работать: тот же кадр — 22 142 B на `w=320` против
 * 216 786 B у мастера, а screenshot-PNG 1593709066IMG_4017.PNG — 209 098 B против
 * 1 911 926 B.
 *
 * Цена — JPEG вместо WebP и динамическая конвертация на холодном кэше. Это дешевле
 * обеих альтернатив: битого фото и мастера целиком. Снимается вместе с карве-аутом,
 * когда backend забэкфиллит производные для ключей `uploads/**`, реально
 * упомянутых в телах статей (BE-задача), — тогда класс вернётся на общую webp-лестницу.
 */
export const LEGACY_UPLOAD_TRANSFORM_FORMAT = 'jpeg' as const;

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
