import { DomUtils, parseDocument } from 'htmlparser2'
import { BELKRAJ_ORIGIN } from './belkrajWidgetUrl'

export type BelkrajNativeData = {
  title: string
  listUrl: string | null
  listLabel: string
  cards: Array<{
    url: string
    title: string
    imageUrl: string | null
    subtitle: string
    rating: string
  }>
}

const MAX_HTML_LENGTH = 1_000_000
type Element = ReturnType<typeof DomUtils.findAll>[number]
const hasClass = (node: Element, name: string) => (node.attribs.class ?? '').split(/\s+/).includes(name)
const findClass = (nodes: Element['children'], name: string) =>
  DomUtils.findOne((node) => hasClass(node, name), nodes)
const text = (node: Element | null) => node ? DomUtils.textContent(node).replace(/\s+/g, ' ').trim() : ''

function partnerLink(value: string | undefined, kind: 'experience' | 'experiences'): string | null {
  if (!value) return null
  try {
    const url = new URL(value, BELKRAJ_ORIGIN)
    if (url.origin !== BELKRAJ_ORIGIN || url.username || url.password) return null
    if (!url.pathname.split('/').includes(kind)) return null
    return url.toString()
  } catch {
    return null
  }
}

function partnerImage(value: string | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value, BELKRAJ_ORIGIN)
    if (url.protocol !== 'https:' || url.port || url.username || url.password) return null
    if (!['belkraj.by', 'tripvenue.com'].includes(url.hostname)) return null
    // Only the partner's actual excursion photos, never arbitrary HTML images/pixels.
    if (!/^\/sites\/default\/files\/(?:styles\/[\w-]+\/public\/)?uploads\/experience\/.+\.(?:jpe?g|png|webp|avif)$/i.test(url.pathname)) return null
    const imageToken = url.searchParams.get('itok')
    url.search = ''
    url.hash = ''
    if (imageToken) url.searchParams.set('itok', imageToken)
    return url.toString()
  } catch {
    return null
  }
}

/** Extract inert fields only. No partner HTML, styles, scripts or embeds reach a renderer. */
export function parseBelkrajNativeData(html: string): BelkrajNativeData {
  if (html.length > MAX_HTML_LENGTH) throw new Error('Belkraj document too large')
  const document = parseDocument(html)
  for (const node of DomUtils.findAll(
    (node) => ['script', 'style', 'noscript', 'iframe', 'object', 'embed', 'svg'].includes(node.name),
    document.children,
  )) DomUtils.removeElement(node)

  const titleLink = findClass(document.children, 'exp-row__title-link')
  const footer = findClass(document.children, 'exp-footer')
  const listLink = footer ? DomUtils.findOne((node) => node.name === 'a', footer.children) : null
  const cards: BelkrajNativeData['cards'] = []
  const seen = new Set<string>()
  for (const card of DomUtils.findAll((node) => node.name === 'figure' && hasClass(node, 'exp-card'), document.children)) {
    const titleNode = findClass(card.children, 'exp-card__title')
    const url = partnerLink(titleNode?.attribs.href, 'experience')
    const title = text(titleNode)
    if (!url || !title || seen.has(url)) continue
    seen.add(url)
    const image = findClass(card.children, 'exp-card__img')
    cards.push({
      url,
      title,
      imageUrl: image?.name === 'img' ? partnerImage(image.attribs.src) : null,
      subtitle: text(findClass(card.children, 'exp-card__text')),
      rating: findClass(card.children, 'exp-card__rating')?.attribs.title?.trim() ?? '',
    })
  }
  // Challenge pages and markup drift are failures, never a silent empty widget.
  if (!cards.length) throw new Error('Belkraj selection unavailable')
  return {
    title: text(titleLink),
    listUrl: partnerLink(listLink?.attribs.href ?? titleLink?.attribs.href, 'experiences'),
    listLabel: text(listLink) || text(titleLink),
    cards,
  }
}

export async function loadBelkrajNativeData(url: string, signal: AbortSignal): Promise<BelkrajNativeData> {
  const source = new URL(url)
  if (source.origin !== BELKRAJ_ORIGIN || source.pathname !== '/partner/widget' || source.username || source.password) {
    throw new Error('Invalid Belkraj widget URL')
  }
  const response = await fetch(url, { credentials: 'omit', signal, headers: { Accept: 'text/html' } })
  if (!response.ok) throw new Error(`Belkraj HTTP ${response.status}`)
  if (response.url && new URL(response.url).origin !== BELKRAJ_ORIGIN) throw new Error('Unexpected Belkraj redirect')
  const html = await response.text()
  if (signal.aborted) throw new Error('Belkraj request cancelled')
  return parseBelkrajNativeData(html)
}
