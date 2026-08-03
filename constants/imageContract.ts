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
