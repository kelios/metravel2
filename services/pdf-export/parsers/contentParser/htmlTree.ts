// #2119: точка входа дерева HTML. Сборщик подставляет `htmlTree.web.ts` на web и
// `htmlTree.native.ts` в приложениях; этот файл — то, что видят TypeScript и
// окружения без платформенных расширений (Node).
export type { HtmlTreeElement, HtmlTreeNode, ParseHtmlBody } from './htmlTree.types'
export { parseHtmlBody } from './htmlTree.native'
