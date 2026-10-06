// #2274: WKWebView receives a self-contained document. Its GET/body must not
// depend on an earlier HEAD probe, which cannot prevent a later network hang.
import { parse, parseFragment, serialize } from 'parse5'
import type { DefaultTreeAdapterTypes } from 'parse5'

export const PRINT_RESOURCE_TIMEOUT_MS = 30_000
export const PRINT_DOCUMENT_TIMEOUT_MS = 120_000
const PRINT_RESOURCE_CONCURRENCY = 6
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const BLANK_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
const IMAGE_TYPE = /^image\/(?:png|jpeg|gif|webp|avif|bmp)$/i
const CSS_URL_RE = /url\(\s*(["']?)([^"')\s]+)\1\s*\)/gi
const CSS_IMPORT_RE = /@import\s+(?:url\([^)]*\)|["'][^"']*["'])[^;]*;?/gi
const PRINT_CSP = "default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:"
const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

type PreflightOptions = {
  deadlineAt: number
  signal?: AbortSignal
  fetchImpl?: typeof fetch
  now?: () => number
  resourceTimeoutMs?: number
}
export type PrintPreflightResult = { html: string; skippedImages: number; aborted: boolean }

function isExternal(value: string): boolean {
  return Boolean(value.trim()) && !/^(?:data:|about:|#)/i.test(value.trim())
}

/** No Buffer/btoa dependency: the byte encoding also works in Hermes. */
function encodeBase64(bytes: Uint8Array): string {
  const chunks: string[] = []
  let chunk = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const value = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0)
    chunk += BASE64[(value >>> 18) & 63] + BASE64[(value >>> 12) & 63] +
      (i + 1 < bytes.length ? BASE64[(value >>> 6) & 63] : '=') +
      (i + 2 < bytes.length ? BASE64[value & 63] : '=')
    if (chunk.length >= 8192) { chunks.push(chunk); chunk = '' }
  }
  return chunks.join('') + chunk
}

/** parse5 handles unquoted/entity-encoded attributes, srcset and SVG href. */
function rewriteResources(html: string, visit: (raw: string) => string): string {
  const tree = parse(html)
  let changed = false
  const css = (text: string): string => text.replace(CSS_IMPORT_RE, '').replace(CSS_URL_RE, (match, quote: string, raw: string) =>
    isExternal(raw) ? `url(${quote}${visit(raw)}${quote})` : match)
  const walk = (parent: DefaultTreeAdapterTypes.ParentNode) => {
    parent.childNodes = parent.childNodes.filter((node) => {
      if (!('tagName' in node)) return true
      if (['script', 'iframe', 'embed', 'object', 'base'].includes(node.tagName)) {
        changed = true
        return false
      }
      for (const attr of node.attrs) {
        const previous = attr.value
        if (attr.name === 'style') attr.value = css(attr.value)
        else if (attr.name === 'srcset') {
          if (node.tagName === 'img' && !node.attrs.some((item) => item.name === 'src')) {
            const first = attr.value.trim().split(/\s+/)[0]
            if (first && isExternal(first)) node.attrs.push({ name: 'src', value: visit(first) })
          }
          attr.value = ''
        } else if (['src', 'href', 'poster', 'data', 'background'].includes(attr.name)) {
          const image = (['img', 'image', 'input'].includes(node.tagName) && ['src', 'href'].includes(attr.name)) ||
            ['poster', 'background'].includes(attr.name)
          if (isExternal(attr.value) && image) attr.value = visit(attr.value)
          else if (isExternal(attr.value) && node.tagName !== 'a') attr.value = 'about:blank'
        }
        if (previous !== attr.value) changed = true
      }
      if (node.tagName === 'style') {
        for (const child of node.childNodes) {
          if (child.nodeName !== '#text') continue
          const text = child as DefaultTreeAdapterTypes.TextNode
          const next = css(text.value)
          if (next !== text.value) changed = true
          text.value = next
        }
      }
      walk(node)
      if ('content' in node) walk(node.content as DefaultTreeAdapterTypes.DocumentFragment)
      return true
    })
  }
  walk(tree)
  const root = tree.childNodes.find((node) => 'tagName' in node && node.tagName === 'html')
  const head = root && 'childNodes' in root
    ? root.childNodes.find((node) => 'tagName' in node && node.tagName === 'head')
    : undefined
  if (head && 'tagName' in head && !head.childNodes.some((node) => 'attrs' in node &&
    node.attrs.some((attr) => attr.name === 'data-print-resource-policy'))) {
    const policy = parseFragment(`<meta data-print-resource-policy http-equiv="Content-Security-Policy" content="${PRINT_CSP}">`).childNodes[0]
    policy.parentNode = head
    head.childNodes.unshift(policy)
    changed = true
  }
  return changed ? serialize(tree) : html
}

export async function preflightPrintResources(html: string, {
  deadlineAt, signal, fetchImpl = fetch, now = Date.now,
  resourceTimeoutMs = PRINT_RESOURCE_TIMEOUT_MS,
}: PreflightOptions): Promise<PrintPreflightResult> {
  if (signal?.aborted) return { html, skippedImages: 0, aborted: true }
  const images = new Set<string>()
  const safeHtml = rewriteResources(html, (raw) => { images.add(raw); return raw })
  const queue = [...images]
  const materialized = new Map<string, string>()
  const answeredOrigins = new Set<string>()
  const deadOrigins = new Set<string>()

  const load = async (raw: string): Promise<void> => {
    const budget = Math.min(resourceTimeoutMs, deadlineAt - now())
    let url: URL
    try { url = new URL(raw, 'https://metravel.by/') } catch { return }
    if (budget <= 0 || deadOrigins.has(url.origin)) return
    const controller = new AbortController()
    let stop: () => void = () => {}
    // Race explicitly: native fetch/body implementations need not honor abort.
    const stopped = new Promise<null>((resolve) => { stop = () => { controller.abort(); resolve(null) } })
    signal?.addEventListener('abort', stop)
    const timer = setTimeout(stop, budget)
    const read = async (): Promise<string | null> => {
      const response = await fetchImpl(url.href, { method: 'GET', signal: controller.signal })
      answeredOrigins.add(url.origin)
      const type = response.headers.get('content-type')?.split(';')[0].trim() ?? ''
      if (!response.ok || !IMAGE_TYPE.test(type) || Number(response.headers.get('content-length')) > MAX_IMAGE_BYTES) return null
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (controller.signal.aborted || bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) return null
      return `data:${type};base64,${encodeBase64(bytes)}`
    }
    try {
      if (signal?.aborted) stop()
      const result = await Promise.race([read(), stopped])
      if (result && !signal?.aborted && now() <= deadlineAt) materialized.set(raw, result)
      else if (!answeredOrigins.has(url.origin)) deadOrigins.add(url.origin)
    } catch {
      if (!answeredOrigins.has(url.origin)) deadOrigins.add(url.origin)
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', stop)
      controller.abort()
    }
  }
  const worker = async () => {
    for (let raw = queue.shift(); raw !== undefined && !signal?.aborted; raw = queue.shift()) await load(raw)
  }
  await Promise.all(Array.from({ length: Math.min(PRINT_RESOURCE_CONCURRENCY, queue.length) }, worker))
  if (signal?.aborted) return { html, skippedImages: 0, aborted: true }
  return {
    html: rewriteResources(safeHtml, (raw) => materialized.get(raw) ?? BLANK_IMAGE),
    skippedImages: images.size - materialized.size,
    aborted: false,
  }
}
