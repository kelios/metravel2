// #2119: тонкий интерфейс дерева HTML для ContentParser.
//
// Это подмножество DOM — ровно те свойства и методы, которые читает разбор
// описаний. На web его реализует сам браузерный документ (`htmlTree.web.ts`,
// DOMParser), в приложениях — дерево parse5 (`htmlTree.native.ts`): в Hermes нет
// ни `DOMParser`, ни `document`, ни `Node`. ContentParser работает только через
// этот интерфейс и браузерных глобалов не трогает.

/** `Node.ELEMENT_NODE` и `Node.TEXT_NODE` — значениями, без глобала `Node`. */
export const HTML_ELEMENT_NODE = 1
export const HTML_TEXT_NODE = 3

export const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml'

export interface HtmlTreeNode {
  readonly nodeType: number
  /** Текстовый узел — его данные; элемент — текст всех потомков по порядку. */
  readonly textContent: string | null
  readonly childNodes: ArrayLike<HtmlTreeNode>
}

export interface HtmlTreeElement extends HtmlTreeNode {
  /** Как в DOM: у HTML-элементов в верхнем регистре. */
  readonly tagName: string
  readonly namespaceURI: string | null
  readonly className: string
  readonly innerHTML: string
  getAttribute(name: string): string | null
  querySelector(selectors: string): HtmlTreeElement | null
  querySelectorAll(selectors: string): ArrayLike<HtmlTreeElement>
  closest(selectors: string): HtmlTreeElement | null
}

/** Разбирает строку как HTML-документ и отдаёт его `<body>`. */
export type ParseHtmlBody = (html: string) => HtmlTreeElement | null
