/**
 * Единственный клиентский владелец SEO-тегов head на вебе (#2756).
 *
 * С Expo SDK 58 базовый head статического HTML пишет `generateMetadata` маршрута
 * (теги без `data-rh`), а клиент раньше добавлял рядом helmet-копии и снимал
 * статические двойники одноразовым проходом в окне 5 с (#2740). Если первая
 * страница монтировала SEO позже окна, теги экспорта переживали SPA-переход и
 * соседствовали с тегами новой страницы.
 *
 * Здесь у каждого SEO-ключа один узел: страница в фокусе пишет значения прямо в
 * него (upsert по name/property/rel), лишние копии снимаются, а ключи, которые
 * объявлял прежний владелец, но не объявляет текущий, удаляются. Теги экспорта
 * — значения первого URL: на нём необъявленные ключи остаются (build-owned
 * `robots` без `data-rh` переживает гидрацию, #1929/#1930), после ухода с него
 * — снимаются вместе с остальным чужим. Значения главной поэтому не утекают на
 * другие страницы (#1613).
 *
 * JSON-LD и прочие `<script>` по-прежнему рендерит helmet: менеджер их не трогает.
 */

import { siteDefaultRobots } from '@/utils/seo'

export type HeadTag =
  | { kind: 'title'; content: string }
  | { kind: 'meta'; attr: 'name' | 'property'; key: string; content: string }
  | { kind: 'link'; rel: 'canonical'; href: string }

const SEO_META_NAME = /^(?:description|robots|twitter:.+)$/
const ROBOTS_KEY = 'meta:name:robots'

const SEO_META_PROPERTY = /^og:.+$/

const tagKey = (tag: HeadTag): string =>
  tag.kind === 'title' ? 'title' : tag.kind === 'link' ? `link:${tag.rel}` : `meta:${tag.attr}:${tag.key}`

const escapeAttr = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')

const selectorFor = (key: string): string => {
  if (key === 'title') return 'title'
  if (key === 'link:canonical') return 'link[rel="canonical"]'
  const [, attr, name] = key.match(/^meta:(name|property):(.+)$/) ?? []
  return `meta[${attr}="${escapeAttr(name)}"]`
}

/** Ключ SEO-узла head или `null` для всего, чем менеджер не владеет. */
const nodeKey = (node: Element): string | null => {
  if (node.tagName === 'TITLE') return 'title'
  if (node.tagName === 'LINK') return node.getAttribute('rel') === 'canonical' ? 'link:canonical' : null
  if (node.tagName !== 'META') return null
  const name = node.getAttribute('name')
  if (name && SEO_META_NAME.test(name)) return `meta:name:${name}`
  const property = node.getAttribute('property')
  if (property && SEO_META_PROPERTY.test(property)) return `meta:property:${property}`
  return null
}

const normalizePath = (value: string) => {
  const raw = String(value || '/').split(/[?#]/, 1)[0].trim() || '/'
  const trimmed = raw.length > 1 ? raw.replace(/\/+$/, '') : raw
  return trimmed === '/index' ? '/' : trimmed
}

type State = {
  initialPath: string
  /** Ключи, которые стоят в head от экспорта первого URL. */
  exportKeys: Set<string>
  /** Ключи, записанные менеджером для текущего владельца. */
  ownedKeys: Set<string>
  owner: symbol | null
}

let state: State | null = null

const getState = (): State => {
  if (state) return state
  const exportKeys = new Set<string>()
  document.head.querySelectorAll('title, meta, link[rel="canonical"]').forEach((node) => {
    if (node.hasAttribute('data-rh')) return
    const key = nodeKey(node)
    if (key) exportKeys.add(key)
  })
  state = { initialPath: normalizePath(window.location.pathname), exportKeys, ownedKeys: new Set(), owner: null }
  return state
}

/**
 * Снимок head экспорта, пока его не тронул ни один писатель. Вызывается при
 * загрузке корневого web-layout: если первая страница сама SEO не пишет, снимок
 * при первой записи взял бы уже чужой путь, и теги экспорта пережили бы переход.
 */
export function captureExportHead(): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return
  getState()
}

const removeKey = (key: string) => {
  document.head.querySelectorAll(selectorFor(key)).forEach((node) => node.remove())
}

const writeTag = (tag: HeadTag) => {
  const nodes = Array.from(document.head.querySelectorAll(selectorFor(tagKey(tag))))
  let node = nodes[0] ?? null
  nodes.slice(1).forEach((extra) => extra.remove())
  // Перенятый узел с меткой helmet (её ставят и императивные патчеры квеста и
  // статьи) helmet снял бы при следующей своей фиксации — она теперь объявляет
  // только JSON-LD и удаляет все `meta[data-rh]`/`link[data-rh]`. Узел менеджера
  // helmet не принадлежит.
  node?.removeAttribute('data-rh')
  if (tag.kind === 'title') {
    if (!node) {
      node = document.createElement('title')
      document.head.insertBefore(node, document.head.firstChild)
    }
    // Единственный `<title>` head — источник `document.title`, отдельная запись не нужна.
    if (node.textContent !== tag.content) node.textContent = tag.content
    return
  }
  if (!node) {
    node = document.createElement(tag.kind)
    if (tag.kind === 'link') node.setAttribute('rel', tag.rel)
    else node.setAttribute(tag.attr, tag.key)
    document.head.appendChild(node)
  }
  const [attr, value] = tag.kind === 'link' ? ['href', tag.href] : ['content', tag.content]
  if (node.getAttribute(attr) !== value) node.setAttribute(attr, value)
}

/**
 * Делает `owner` владельцем SEO-head: пишет его теги и снимает ключи прежнего
 * владельца, которых у него нет. Теги экспорта необъявленных ключей живут, пока
 * открыт первый URL документа.
 */
export function applyHeadTags(owner: symbol, tags: readonly HeadTag[]): void {
  if (typeof document === 'undefined') return
  const current = getState()
  const nextKeys = new Set(tags.map(tagKey))
  const onInitialPath = normalizePath(window.location.pathname) === current.initialPath

  for (const key of current.ownedKeys) if (!nextKeys.has(key)) removeKey(key)
  current.owner = owner
  current.ownedKeys = nextKeys
  if (!onInitialPath) dropExportKeys(current)
  for (const tag of tags) writeTag(tag)
  if (current.exportKeys.size === 0) ensureDefaultRobots(current)

  // Эффект новой страницы может опередить запись history роутером: путь
  // перепроверяется после текущей задачи, иначе теги экспорта первого URL
  // пережили бы переход.
  if (onInitialPath && current.exportKeys.size > 0) {
    window.setTimeout(() => {
      if (state !== current || normalizePath(window.location.pathname) === current.initialPath) return
      dropExportKeys(current)
      ensureDefaultRobots(current)
    }, 0)
  }
}

/** Снимает теги экспорта первого URL, кроме ключей текущего владельца. */
function dropExportKeys(current: State): void {
  for (const key of current.exportKeys) if (!current.ownedKeys.has(key)) removeKey(key)
  current.exportKeys.clear()
}

/** После снятия тегов экспорта страница без своего robots получает robots документа. */
function ensureDefaultRobots(current: State): void {
  if (current.ownedKeys.has(ROBOTS_KEY)) return
  writeTag({ kind: 'meta', attr: 'name', key: 'robots', content: siteDefaultRobots() })
}

/**
 * Страница ушла из фокуса: владение снимается, теги остаются до записи следующей
 * страницы — она перезапишет свои ключи и уберёт необъявленные. Без этого между
 * blur и focus head оставался бы пустым, а запоздавшая правка другого писателя
 * (детали статьи, квест) терялась бы.
 */
export function releaseHeadTags(owner: symbol): void {
  if (!state || state.owner !== owner) return
  state.owner = null
}

/** Только для тестов: забыть снимок документа. */
export function resetHeadManagerForTests(): void {
  state = null
}
