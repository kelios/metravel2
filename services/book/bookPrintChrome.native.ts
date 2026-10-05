// #2119: в приложениях книга уходит в системный диалог печати (expo-print:
// AirPrint, «Сохранить как PDF»). У диалога своё превью и своя кнопка, а
// `window.print()` там нет — панель «Печать» и скрипт ожидания картинок из
// web-варианта (`bookPrintChrome.web.ts`) в документ не добавляются. Фон и цвета
// страниц печатаются и без них: `print-color-adjust: exact` задаёт сам документ
// книги (`pdfRuntimeMarkup/htmlDocument.ts`).
export function addBookPrintChrome(html: string): string {
  return html
}
