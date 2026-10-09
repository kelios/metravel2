// Дерево parse5 для платформенных адаптеров — без браузерных глобалов.
//
// Разбор — parse5: он строит дерево по тому же алгоритму HTML, что и браузерный
// `DOMParser` (неявные теги, перенос ведущих `style`/`script` в `head`, вынос
// текста из таблиц, починка перекрывающихся тегов), поэтому книга в приложении
// получает те же блоки, что и на сайте, в том числе на битой разметке. Поверх
// дерева parse5 — узлы с тем подмножеством DOM, которое читает ContentParser
// (`htmlTree.types.ts`). Глобалы `document`/`DOMParser` не подменяются: по ним
// остальной код отличает браузер от приложения.
import { html as parse5Html, parse, serialize } from 'parse5'
import type { DefaultTreeAdapterTypes } from 'parse5'

import { HTML_ELEMENT_NODE, HTML_NAMESPACE, HTML_TEXT_NODE } from './htmlTree.types'
import type { HtmlTreeElement, HtmlTreeNode } from './htmlTree.types'

type SourceNode = DefaultTreeAdapterTypes.ChildNode
type SourceElement = DefaultTreeAdapterTypes.Element
type SourceParent = DefaultTreeAdapterTypes.ParentNode

const COMMENT_NODE = 8
const DOCUMENT_TYPE_NODE = 10

// У документа из `DOMParser` скрипты выключены: `<noscript>` разбирается как
// обычная разметка, а его текст при сериализации экранируется.
const PARSE_OPTIONS = { scriptingEnabled: false } as const

const NO_CHILDREN: readonly HtmlTreeNode[] = Object.freeze([])

const isSourceElement = (node: SourceNode | SourceParent): node is SourceElement => 'tagName' in node

const isSourceText = (node: SourceNode): node is DefaultTreeAdapterTypes.TextNode => node.nodeName === '#text'

type SimpleSelector = { kind: 'type'; name: string } | { kind: 'class'; name: string }

const TYPE_SELECTOR = /^[A-Za-z][A-Za-z0-9]*$/
const CLASS_SELECTOR = /^\.[A-Za-z_][\w-]*$/
const ASCII_WHITESPACE = /[\t\n\f\r ]+/

const selectorCache = new Map<string, SimpleSelector[]>()

/**
 * ContentParser выбирает узлы списками простых селекторов: тип (`img`,
 * `th, td`) и класс (`.title`). Иное здесь не поддержано намеренно — новый вид
 * селектора обязан упасть в тесте приложений, а не молча ничего не найти.
 */
function compileSelectors(selectors: string): SimpleSelector[] {
  const cached = selectorCache.get(selectors)
  if (cached) return cached

  const compiled = selectors.split(',').map((raw): SimpleSelector => {
    const part = raw.trim()
    if (TYPE_SELECTOR.test(part)) return { kind: 'type', name: part }
    if (CLASS_SELECTOR.test(part)) return { kind: 'class', name: part.slice(1) }
    throw new Error(`htmlTree.native: селектор «${selectors}» не поддержан — только списки тегов и классов`)
  })
  selectorCache.set(selectors, compiled)
  return compiled
}

const asciiUpperCase = (value: string): string => value.replace(/[a-z]+/g, (chunk) => chunk.toUpperCase())
const asciiLowerCase = (value: string): string => value.replace(/[A-Z]+/g, (chunk) => chunk.toLowerCase())

class TreeDocument {
  private readonly wrappers = new WeakMap<SourceNode, HtmlTreeNode>()

  /** В режиме совместимости (документ без doctype) классы сравниваются без учёта регистра. */
  constructor(readonly quirksMode: boolean) {}

  wrap(node: SourceNode): HtmlTreeNode {
    const cached = this.wrappers.get(node)
    if (cached) return cached

    let wrapper: HtmlTreeNode
    if (isSourceElement(node)) {
      wrapper = new NativeHtmlElement(node, this)
    } else if (isSourceText(node)) {
      wrapper = new NativeCharacterData(HTML_TEXT_NODE, node.value)
    } else if (node.nodeName === '#comment') {
      wrapper = new NativeCharacterData(COMMENT_NODE, node.data)
    } else {
      wrapper = new NativeCharacterData(DOCUMENT_TYPE_NODE, null)
    }
    this.wrappers.set(node, wrapper)
    return wrapper
  }

  wrapElement(node: SourceElement): NativeHtmlElement {
    return this.wrap(node) as NativeHtmlElement
  }
}

class NativeCharacterData implements HtmlTreeNode {
  readonly childNodes: ArrayLike<HtmlTreeNode> = NO_CHILDREN

  constructor(
    readonly nodeType: number,
    readonly textContent: string | null
  ) {}
}

class NativeHtmlElement implements HtmlTreeElement {
  readonly nodeType = HTML_ELEMENT_NODE
  private children: HtmlTreeNode[] | null = null

  constructor(
    private readonly source: SourceElement,
    private readonly owner: TreeDocument
  ) {}

  private get isHtml(): boolean {
    return this.source.namespaceURI === HTML_NAMESPACE
  }

  get tagName(): string {
    return this.isHtml ? asciiUpperCase(this.source.tagName) : this.source.tagName
  }

  get namespaceURI(): string | null {
    return this.source.namespaceURI
  }

  get className(): string {
    return this.getAttribute('class') ?? ''
  }

  get childNodes(): ArrayLike<HtmlTreeNode> {
    if (!this.children) {
      this.children = this.source.childNodes.map((child) => this.owner.wrap(child))
    }
    return this.children
  }

  get textContent(): string {
    let text = ''
    const collect = (parent: SourceElement) => {
      for (const child of parent.childNodes) {
        if (isSourceText(child)) text += child.value
        else if (isSourceElement(child)) collect(child)
      }
    }
    collect(this.source)
    return text
  }

  get innerHTML(): string {
    return serialize(this.source, PARSE_OPTIONS)
  }

  getAttribute(name: string): string | null {
    const qualifiedName = this.isHtml ? asciiLowerCase(name) : name
    for (const attr of this.source.attrs) {
      const attrName = attr.prefix ? `${attr.prefix}:${attr.name}` : attr.name
      if (attrName === qualifiedName) return attr.value
    }
    return null
  }

  querySelector(selectors: string): HtmlTreeElement | null {
    const compiled = compileSelectors(selectors)
    const find = (parent: SourceElement): SourceElement | null => {
      for (const child of parent.childNodes) {
        if (!isSourceElement(child)) continue
        if (this.matches(child, compiled)) return child
        const nested = find(child)
        if (nested) return nested
      }
      return null
    }
    const found = find(this.source)
    return found ? this.owner.wrapElement(found) : null
  }

  querySelectorAll(selectors: string): ArrayLike<HtmlTreeElement> {
    const compiled = compileSelectors(selectors)
    const found: HtmlTreeElement[] = []
    const collect = (parent: SourceElement) => {
      for (const child of parent.childNodes) {
        if (!isSourceElement(child)) continue
        if (this.matches(child, compiled)) found.push(this.owner.wrapElement(child))
        collect(child)
      }
    }
    collect(this.source)
    return found
  }

  closest(selectors: string): HtmlTreeElement | null {
    const compiled = compileSelectors(selectors)
    let current: SourceNode | SourceParent | null = this.source
    while (current && isSourceElement(current)) {
      if (this.matches(current, compiled)) return this.owner.wrapElement(current)
      current = current.parentNode
    }
    return null
  }

  private matches(element: SourceElement, selectors: SimpleSelector[]): boolean {
    return selectors.some((selector) =>
      selector.kind === 'type' ? this.matchesType(element, selector.name) : this.matchesClass(element, selector.name)
    )
  }

  /** Имя HTML-элемента сравнивается без учёта регистра, чужого (SVG, MathML) — точно. */
  private matchesType(element: SourceElement, name: string): boolean {
    return element.namespaceURI === HTML_NAMESPACE
      ? element.tagName === asciiLowerCase(name)
      : element.tagName === name
  }

  private matchesClass(element: SourceElement, name: string): boolean {
    const classAttr = element.attrs.find((attr) => attr.name === 'class' && !attr.prefix)
    if (!classAttr) return false
    const tokens = classAttr.value.split(ASCII_WHITESPACE)
    if (!this.owner.quirksMode) return tokens.includes(name)
    const expected = asciiLowerCase(name)
    return tokens.some((token) => asciiLowerCase(token) === expected)
  }
}

/**
 * Разбирает строку как HTML-документ и отдаёт то, что в браузере вернул бы
 * `document.body`: `<body>` или `<frameset>` — первый из них среди детей `<html>`.
 */
export function parseHtmlBody(html: string): HtmlTreeElement | null {
  const parsed = parse(html, PARSE_OPTIONS)
  const owner = new TreeDocument(parsed.mode === parse5Html.DOCUMENT_MODE.QUIRKS)

  const root = parsed.childNodes.find(
    (node): node is SourceElement => isSourceElement(node) && node.tagName === 'html'
  )
  if (!root) return null

  const body = root.childNodes.find(
    (node): node is SourceElement =>
      isSourceElement(node) &&
      node.namespaceURI === HTML_NAMESPACE &&
      (node.tagName === 'body' || node.tagName === 'frameset')
  )
  return body ? owner.wrapElement(body) : null
}
