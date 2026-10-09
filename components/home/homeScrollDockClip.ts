import { webDockReserve } from '@/components/layout/bottomChromeInset'

/**
 * #2359: прокрутка главной на web заканчивается над нижним доком тем же
 * резервом, которым SSG-оболочка открывает настоящий док (#2216,
 * `scripts/ssg-skeletons.js`: `bottom:calc(56px + env(safe-area-inset-bottom))`).
 *
 * Иначе у одного кадра «Маршрута недели» два разных клипа: SSG-фото обрезано
 * скроллером «экран − док», а React-копия — всем экраном под доком. Площадь
 * React-кандидата выходила больше, и Chrome переносил LCP с раннего SSG-кадра
 * (~2,2 с) на поздний React-кадр (~6 с). При равных клипах SSG-кандидат не
 * меньше React-копии, и это не зависит от тайминга.
 *
 * Док непрозрачен: скроллер короче на `--mt-dock-h`, а нижний отступ контента
 * меньше на ту же величину — конец страницы стоит на прежнем месте
 * относительно экрана. Сам ряд дока 56px, а резерв — 56px + safe-area: при
 * `safe-area-inset-bottom` > 0 прокрутка обрезается на inset выше кромки дока,
 * та же полоса, что у SSG-оболочки. На desktop и при выключенном доке
 * `--mt-dock-h` = 0px, формулы сводятся к прежним.
 */
export const HOME_WEB_SCROLL_DOCK_CLIP = webDockReserve()

/** Нижний отступ контента главной на web: прежний конец страницы над доком/плашкой согласия. */
export function homeWebScrollEndPadding(minimum: number): string {
  return `calc(max(${minimum}px, var(--mt-consent-h, 0px)) + 8px - ${HOME_WEB_SCROLL_DOCK_CLIP})`
}
