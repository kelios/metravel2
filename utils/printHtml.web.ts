// utils/printHtml.web.ts
// #2102: web-адаптер печати — печатная версия открывается в окне браузера
// (document.write в заранее открытое окно), печатает пользователь кнопкой
// «Печать» в самом документе. Среди файлов печати, которые проверяет
// governance-тест (__tests__/config/print-governance.test.ts), это единственный
// владелец window.print; QuestFullMap.tsx и BookHtmlExportService.ts — вне его scope.
import {
  discardPendingBookPreviewWindow,
  openBookPreviewWindow,
  openPendingBookPreviewWindow,
} from '@/utils/openBookPreviewWindow'
import type { PrintOptions, PrintResult, PrintSession } from './printHtml.types'

export type { PrintOptions, PrintResult, PrintSession } from './printHtml.types'

/** Документы помечают кнопку печати атрибутом `data-print-action`, не скриптом. */
const PRINT_ACTION_SCRIPT =
  "<script>document.addEventListener('click',function(e){var t=e.target&&e.target.closest&&e.target.closest('[data-print-action]');if(t){window.print()}})</script>"

export function withPrintActionHandler(html: string): string {
  if (!html.includes('data-print-action')) return html
  const bodyEnd = html.lastIndexOf('</body>')
  return bodyEnd === -1 ? html + PRINT_ACTION_SCRIPT : html.slice(0, bodyEnd) + PRINT_ACTION_SCRIPT + html.slice(bodyEnd)
}

/**
 * Постоянно true: от ответа зависит разметка (кнопки печати), а она не должна
 * различаться между SSG-сборкой и гидрацией. Нет окна — beginPrint ответит 'unavailable'.
 */
export function isPrintAvailable(): boolean {
  return true
}

/** Открывает окно синхронно — вызывать до первого await в обработчике клика. */
export function beginPrint(): PrintSession {
  const win = typeof window !== 'undefined' && typeof window.open === 'function' ? openPendingBookPreviewWindow() : null
  let settled = false
  return {
    available: win != null,
    print: async (html: string, _options?: PrintOptions): Promise<PrintResult> => {
      if (!win) return 'unavailable'
      if (settled) return 'cancelled'
      settled = true
      // Окно закрыл сам пользователь, пока документ собирался, — это отмена, а не сбой.
      if (win.closed) {
        discardPendingBookPreviewWindow(win)
        return 'cancelled'
      }
      openBookPreviewWindow(withPrintActionHandler(html), win)
      return 'printed'
    },
    cancel: () => {
      if (!win || settled) return
      settled = true
      discardPendingBookPreviewWindow(win)
    },
  }
}

export function printHtml(html: string, options?: PrintOptions): Promise<PrintResult> {
  return beginPrint().print(html, options)
}
