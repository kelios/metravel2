// utils/printAvailability.web.ts
// #2119: «есть ли чем печатать» — отдельно от адаптера печати (`printHtml.web.ts`),
// чтобы политика навигации (`constants/platformNavRoutes.ts`, entry-чанк) не тянула
// за собой окно предпросмотра.

/**
 * Постоянно true: от ответа зависит разметка (кнопки печати), а она не должна
 * различаться между SSG-сборкой и гидрацией. Нет окна — beginPrint ответит 'unavailable'.
 */
export function isPrintAvailable(): boolean {
  return true
}
