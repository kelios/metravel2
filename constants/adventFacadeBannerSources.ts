import type { AdventFacadeBannerSources } from './adventVisuals'

/**
 * Native (#3488): облегчённых копий фасада в приложении нет. Полный фасад и так
 * лежит в сборке для дома адвента и сети не стоит, а копии добавили бы ~316 КБ
 * картинок без выигрыша. Пустые списки → `AdventWindowCrop` кадрирует полный фасад.
 * Web-пара с копиями — `adventFacadeBannerSources.web.ts`.
 */
export const ADVENT_FACADE_BANNER_SOURCES: AdventFacadeBannerSources = {
  desktop: [],
  phone: [],
}
