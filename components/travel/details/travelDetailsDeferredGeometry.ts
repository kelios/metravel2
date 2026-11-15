import type { ViewInstance } from 'react-native'

import { SECTION_READING_LINE_BUFFER_PX, resolveSectionScrollOffset } from '@/utils/sectionScrollOffset'

// DOM geometry of the deferred travel sections (#2329, #3396, #3430): the scroll
// owner, its visible part, following anchors and where a slack lies. The single
// transaction owner is `TravelDetailsDeferredTransition`.
export const RUNTIME_SETTLE_HEIGHT_EPSILON_PX = 1

export type ReserveReleaseAnchor = {
  anchor: HTMLElement
  owner: HTMLElement
  beforeTop: number
}

// When releasing conserved slack, a drawn runtime is a fallback only if no
// visible following frame owns the transaction. Its post-insertion aggregate
// bounds cannot identify the reading anchor for a runtime payload mutation.
export function findRuntimeReadingAnchor(node: HTMLElement, runtime: HTMLElement | null): ReserveReleaseAnchor | null {
  const owner = findMeasuredScrollOwner(node)
  const view = node.ownerDocument.defaultView
  if (!owner || !view || !runtime?.isConnected || !node.contains(runtime)) return null
  const bounds = owner.getBoundingClientRect()
  for (const child of Array.from(runtime.children)) {
    if (!(child instanceof view.HTMLElement)) continue
    const rect = child.getBoundingClientRect()
    if (/^(absolute|fixed|sticky)$/.test(view.getComputedStyle(child).position)) continue
    if (rect.width > 0 && rect.height > 0 &&
        rect.bottom > Math.max(0, bounds.top + owner.clientTop) && rect.top < Math.min(view.innerHeight, bounds.top + owner.clientTop + owner.clientHeight) &&
        rect.right > Math.max(0, bounds.left + owner.clientLeft) && rect.left < Math.min(view.innerWidth, bounds.left + owner.clientLeft + owner.clientWidth) &&
        isDrawnWithinOwner(child, owner)) return { anchor: child, owner, beforeTop: rect.top }
  }
  return null
}

export function connectedDOMView(ref: ViewInstance | null): HTMLElement | null {
  const node = ref as unknown as HTMLElement | null
  const view = node?.ownerDocument?.defaultView
  // Native/test-renderer handles and stale/disconnected DOM refs cannot own
  // web geometry. Do not attach an observer or mutate their style as fallback.
  return view && node instanceof view.HTMLElement && node.isConnected ? node : null
}

export function isDrawnWithinOwner(node: HTMLElement, owner: HTMLElement): boolean {
  const view = node.ownerDocument.defaultView
  if (!view) return false
  let frame: HTMLElement | null = node
  while (frame) {
    const style = view.getComputedStyle(frame)
    if (style.opacity === '0' || style.visibility === 'hidden' || style.visibility === 'collapse' || style.display === 'none') return false
    if (frame === owner) return true
    frame = frame.parentElement
  }
  return false
}

export function findMeasuredScrollOwner(node: HTMLElement): HTMLElement | null {
  const view = node.ownerDocument.defaultView
  if (!node.isConnected || !view) return null
  let owner = node.parentElement
  while (owner) {
    const overflowY = view.getComputedStyle(owner).overflowY
    if (/^(auto|scroll)$/.test(overflowY) && owner.scrollHeight > owner.clientHeight) break
    owner = owner.parentElement
  }
  return owner
}

// The part of the scroll owner the reader actually sees. On desktop it is shorter
// than the window (header above, bottom bar below), so a `100vh` reserve can
// cover it entirely.
export function ownerViewport(owner: HTMLElement, view: Window) {
  const ownerRect = owner.getBoundingClientRect()
  const top = Math.max(0, ownerRect.top + owner.clientTop)
  const bottom = Math.min(view.innerHeight, ownerRect.top + owner.clientTop + owner.clientHeight)
  const left = Math.max(0, ownerRect.left + owner.clientLeft)
  const right = Math.min(view.innerWidth, ownerRect.left + owner.clientLeft + owner.clientWidth)
  return bottom > top && right > left ? { top, bottom, left, right } : null
}

// #3430: a reserve covering the whole visible owner leaves no following frame to
// anchor; releasing its visible slack then pulls the footer up into view (CLS
// 0.72 on 390, 0.078 on 1280 — the owner is shorter than the `100vh` reserve).
// Such a release waits until the slack leaves the viewport or a following frame
// becomes visible: slack below the viewport moves nothing visible. A visible
// following frame keeps the reading-line rule of `findMeasuredTransactionAnchor`.
export function isReserveSlackVisible(node: HTMLElement, runtime: HTMLElement, owner: HTMLElement): boolean {
  const view = node.ownerDocument.defaultView
  const viewport = view && owner.clientHeight > 0 && owner === findMeasuredScrollOwner(node) ? ownerViewport(owner, view) : null
  if (!viewport) return false
  const slackTop = runtime.getBoundingClientRect().bottom
  const slackBottom = node.getBoundingClientRect().bottom
  return slackBottom - slackTop > RUNTIME_SETTLE_HEIGHT_EPSILON_PX && slackBottom > viewport.top && slackTop < viewport.bottom
}

// #3430: Chrome scores a content move in a frame whose scroll steps also moved the
// owner by the size of the move, whatever compensation the same frame applies
// (12 px → 0.011, 217 px → 0.195). A held shrink therefore lands only in a frame
// without an owner scroll; the stamp is taken in that frame's scroll steps, which
// run before its animation frame callbacks.
// The stamp keeps the offset of that scroll too: a scroll written by a task
// earlier in this painted frame dispatches its event only in the frame's scroll
// steps, after our layout commit — its offset already differs (#3430: a probe
// step and an anchored map shrink in one frame scored 0.797 on 390).
const ownerScrollStamps = new WeakMap<HTMLElement, { time: number; top: number }>()

export function watchOwnerScroll(owner: HTMLElement) {
  if (ownerScrollStamps.has(owner)) return
  ownerScrollStamps.set(owner, { time: -Infinity, top: owner.scrollTop })
  owner.addEventListener('scroll', () => ownerScrollStamps.set(owner, { time: performance.now(), top: owner.scrollTop }), { passive: true })
}

export function ownerScrolledInFrame(owner: HTMLElement, frameTime: number) {
  const stamp = ownerScrollStamps.get(owner)
  return !!stamp && (stamp.time >= frameTime || Math.abs(owner.scrollTop - stamp.top) > 0.5)
}

// Our own anchor correction is not the reader's scroll.
export function noteOwnerScrollWrite(owner: HTMLElement) {
  const stamp = ownerScrollStamps.get(owner)
  if (stamp) stamp.top = owner.scrollTop
}

// #3430: a React commit runs in a task, and a later task of the same frame may
// still scroll the owner (a probe step after an anchored map shrink scored 0.797
// on 390). Where frames can be told apart (a document timeline), a height
// change that moves drawn content therefore lands only in the frame's rendering
// steps — a ResizeObserver or an animation frame callback — never in a task.
export function ownerFrameKnown(owner: HTMLElement) {
  return typeof owner.ownerDocument.timeline?.currentTime === 'number'
}

// Outside an animation frame callback the current frame time is the document
// timeline's; without one (no Web Animations) the frame cannot be told apart.
export function ownerScrolledInCurrentFrame(owner: HTMLElement) {
  const frameTime = owner.ownerDocument.timeline?.currentTime
  return typeof frameTime === 'number' && ownerScrolledInFrame(owner, frameTime)
}

// #3430: two releases in one painted frame at the page end let the browser clamp
// the scroll by their sum; a frame between them moved by only one of them, and
// Chrome, which subtracts the whole scroll delta, scored that frame's difference
// (sidebar −1365 px + comments −163 px: 0.148 on 390). One release per owner
// per painted frame: the claim lapses two animation frames later.
const ownerReleaseClaims = new WeakMap<HTMLElement, HTMLElement>()

// The same transition may release twice in its frame (held frame and reserve):
// everything below it moves by the one sum.
export function claimOwnerRelease(owner: HTMLElement, node: HTMLElement): boolean {
  const claimant = ownerReleaseClaims.get(owner)
  if (claimant && claimant !== node) return false
  const view = owner.ownerDocument.defaultView
  if (!view || claimant) return true
  ownerReleaseClaims.set(owner, node)
  view.requestAnimationFrame(() => view.requestAnimationFrame(() => ownerReleaseClaims.delete(owner)))
  return true
}

// Where the slack of a shrink would be: below the viewport it moves nothing drawn;
// on screen or above it only an anchored transaction in a frame without an owner
// scroll may take it, otherwise the occupied height is held.
export function heldSlackPlacement(node: HTMLElement, frameHeight: number, occupiedHeight: number): 'visible' | 'above' | 'below' {
  const owner = findMeasuredScrollOwner(node)
  const view = node.ownerDocument.defaultView
  const viewport = owner && view ? ownerViewport(owner, view) : null
  if (!viewport) return 'below'
  const top = node.getBoundingClientRect().top
  if (top + occupiedHeight <= viewport.top) return 'above'
  return top + frameHeight >= viewport.bottom ? 'below' : 'visible'
}

export function findReserveReleaseAnchor(node: HTMLElement): ReserveReleaseAnchor | null {
  const view = node.ownerDocument.defaultView
  const owner = findMeasuredScrollOwner(node)
  if (!view) return null
  if (!owner || owner.clientHeight <= 0) return null
  const viewport = ownerViewport(owner, view)
  if (!viewport) return null
  const { top, bottom, left, right } = viewport

  // The transition sits inside a section wrapper. Walk only within this owner
  // to the first visible following flow frame, never to the window/body.
  let frame: HTMLElement | null = node
  let anchor: HTMLElement | null = null
  while (frame && frame !== owner) {
    let sibling = frame.nextElementSibling
    while (sibling) {
      if (sibling instanceof view.HTMLElement) {
        const rect = sibling.getBoundingClientRect()
        const position = view.getComputedStyle(sibling).position
        if (!/^(absolute|fixed|sticky)$/.test(position) && rect.width > 0 && rect.height > 0 &&
            rect.bottom > top && rect.top < bottom && rect.right > left && rect.left < right &&
            isDrawnWithinOwner(sibling, owner)) {
          anchor = sibling
          break
        }
      }
      sibling = sibling.nextElementSibling
    }
    if (anchor) break
    frame = frame.parentElement
  }
  if (!anchor || !owner.contains(anchor)) return null
  const rect = anchor.getBoundingClientRect()
  return { anchor, owner, beforeTop: rect.top }
}

// The frame under the scrollspy reading line is the one the reader is on: a menu
// jump parks its section there. A mutation that starts below that line cannot
// move it, so the following flow takes the change. Holding a lower visible frame
// instead would scroll the reading frame away by the full height of the late
// block — «Похожие статьи» growing under a just-opened «Популярные» (#3396).
//
// A block that only appends (route elevation profiles under the map, #3419)
// changes the flow at its previous END, not at its start: its flow height is
// still unpublished while the anchor is captured, so that end is the node's
// current bottom. A reader looking at the map keeps it, and the profiles push
// «Точки маршрута» down; only a reader already past the block has it compensated.
export function startsBelowReadingLine(origin: HTMLElement, owner: HTMLElement, fromEnd = false): boolean {
  const ownerTop = owner.getBoundingClientRect().top
  const readingLine = ownerTop + resolveSectionScrollOffset(owner) + SECTION_READING_LINE_BUFFER_PX
  const rect = origin.getBoundingClientRect()
  return (fromEnd ? rect.bottom : rect.top) > readingLine
}
