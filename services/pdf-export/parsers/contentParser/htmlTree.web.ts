// #2119: web-реализация дерева HTML — сам браузерный документ. Узлы DOM уже
// удовлетворяют `HtmlTreeElement`, обёрток нет: разбор описаний на сайте идёт
// тем же `DOMParser`, что и до появления интерфейса.
//
// Единственный файл в `services/pdf-export/**`, которому разрешён `DOMParser`
// (`__tests__/config/pdf-export-dom-governance.test.ts`).
import type { HtmlTreeElement } from './htmlTree.types'

export function parseHtmlBody(html: string): HtmlTreeElement | null {
  return new DOMParser().parseFromString(html, 'text/html').body
}
