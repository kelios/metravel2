// #2119: в приложениях книга уходит в системный диалог печати (expo-print:
// AirPrint, «Сохранить как PDF»). У диалога своё превью и своя кнопка, а
// `window.print()` там нет — панель «Печать» и скрипт ожидания картинок из
// web-варианта (`bookPrintChrome.web.ts`) в документ не добавляются. Фон и цвета
// страниц печатаются и без них: `print-color-adjust: exact` задаёт сам документ
// книги (`pdfRuntimeMarkup/htmlDocument.ts`). Ожидание картинок в приложении
// ограничивает сам адаптер печати (#2274, `utils/printResourcePreflight.ts`):
// не ответившие за 30 с адреса убираются до передачи документа в expo-print.
export function addBookPrintChrome(html: string): string {
  return html
}
