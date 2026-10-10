import { IncrementalContentError } from '@/services/pdf-export/parsers/incrementalContentError'
import type { IncrementalContentMetrics, SafeContentFragment } from '@/services/pdf-export/parsers/incrementalContent'

export interface FragmentOpenElement {
  name: string; emittedName: string; open: string; reopen: string; close: string; omitted: boolean
  tableIndex?: number; rowIndex?: number; cellIndex?: number; nextChild?: number; listItem?: number; listRun?: 'ol' | 'ul'
}
export interface FragmentWriterCheckpoint {
  version: 1; policy: {maxFragment: number; maxDepth: number; preserveListStarts: boolean; expandDisclosures: boolean; anchorPolicy: string}
  stack: FragmentOpenElement[]; parts: string[]; chars: number; textChars: number
  images: SafeContentFragment['imageOccurrences']; payload: boolean; continuedPath: string[]
  tableContinuation?: SafeContentFragment['tableContinuation']; listContinuation?: SafeContentFragment['listContinuation']
  nextTable: number; pendingSurrogate: string; plainText: boolean; omittedDepth: number; metrics: IncrementalContentMetrics
}
function invalid(): never { throw new IncrementalContentError('FRAGMENT_CHECKPOINT_INVALID') }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid()
  return value as Record<string, unknown>
}
function int(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) return invalid()
  return value
}
function string(value: unknown, max: number): string { if (typeof value !== 'string' || value.length > max) return invalid(); return value }
function bool(value: unknown): boolean { if (typeof value !== 'boolean') return invalid(); return value }
function strings(value: unknown, count: number, chars: number): string[] {
  if (!Array.isArray(value) || value.length > count) return invalid()
  const result = value.map(item => string(item, chars))
  if (result.reduce((sum, item) => sum + item.length, 0) > chars) return invalid()
  return result
}
function coordinates(value: unknown): NonNullable<SafeContentFragment['tableContinuation']> {
  const state = record(value)
  return {tableIndex: int(state.tableIndex), ...(state.rowIndex !== undefined ? {rowIndex: int(state.rowIndex)} : {}),
    ...(state.cellIndex !== undefined ? {cellIndex: int(state.cellIndex)} : {}), header: bool(state.header)}
}
export function validateFragmentWriterCheckpoint(value: unknown): FragmentWriterCheckpoint {
  const state = record(value); if (state.version !== 1) return invalid()
  const policyState = record(state.policy)
  const policy = {maxFragment: int(policyState.maxFragment, 256, 1048576), maxDepth: int(policyState.maxDepth, 1, 128),
    preserveListStarts: bool(policyState.preserveListStarts), expandDisclosures: bool(policyState.expandDisclosures), anchorPolicy: string(policyState.anchorPolicy, 4096)}
  const raw = Math.floor(policy.maxFragment / 2)
  if (!Array.isArray(state.stack) || state.stack.length > policy.maxDepth) return invalid()
  const stack: FragmentOpenElement[] = state.stack.map(value => {
    const item = record(value)
    const element: FragmentOpenElement = {name: string(item.name, raw), emittedName: string(item.emittedName, raw), open: string(item.open, raw),
      reopen: string(item.reopen, raw), close: string(item.close, raw), omitted: bool(item.omitted)}
    for (const key of ['tableIndex', 'rowIndex', 'cellIndex', 'nextChild', 'listItem'] as const) {
      if (item[key] !== undefined) element[key] = int(item[key], key === 'nextChild' || key === 'listItem' ? Number.MIN_SAFE_INTEGER : 0)
    }
    if (item.listRun !== undefined) { if (item.listRun !== 'ol' && item.listRun !== 'ul') return invalid(); element.listRun = item.listRun }
    return element
  })
  if (stack.reduce((sum, element) => sum + element.open.length + element.close.length, 0) > raw * 2) return invalid()
  const parts = strings(state.parts, raw + policy.maxDepth, raw)
  const chars = int(state.chars, 0, raw)
  if (parts.reduce((sum, part) => sum + part.length, 0) !== chars) return invalid()
  if (!Array.isArray(state.images) || state.images.length > raw) return invalid()
  const images = state.images.map(value => { const item = record(value); return {index: int(item.index), source: string(item.source, raw)} })
  if (images.reduce((sum, item) => sum + item.source.length, 0) > raw) return invalid()
  const metricState = record(state.metrics)
  const metrics: IncrementalContentMetrics = {fragments: int(metricState.fragments), sourceTextChars: int(metricState.sourceTextChars), images: int(metricState.images),
    peakBufferedChars: int(metricState.peakBufferedChars, 0, raw + 4), peakDepth: int(metricState.peakDepth, 0, policy.maxDepth)}
  if (images.some((image, index) => image.index >= metrics.images || (index > 0 && image.index !== images[index - 1].index + 1))) return invalid()
  let listContinuation: FragmentWriterCheckpoint['listContinuation']
  if (state.listContinuation !== undefined) {
    if (!Array.isArray(state.listContinuation) || state.listContinuation.length > policy.maxDepth) return invalid()
    listContinuation = state.listContinuation.map(value => ({item: int(record(value).item, Number.MIN_SAFE_INTEGER)}))
  }
  const pendingSurrogate = string(state.pendingSurrogate, 1)
  if (pendingSurrogate && !/^[\ud800-\udbff]$/.test(pendingSurrogate)) return invalid()
  const omittedDepth = int(state.omittedDepth, 0, policy.maxDepth)
  if (omittedDepth !== stack.filter(element => element.omitted).length) return invalid()
  return {version: 1, policy, stack, parts, chars, textChars: int(state.textChars, 0, metrics.sourceTextChars), images, payload: bool(state.payload),
    continuedPath: strings(state.continuedPath, policy.maxDepth + 1, raw),
    ...(state.tableContinuation !== undefined ? {tableContinuation: coordinates(state.tableContinuation)} : {}),
    ...(listContinuation ? {listContinuation} : {}), nextTable: int(state.nextTable), pendingSurrogate,
    plainText: bool(state.plainText), omittedDepth, metrics}
}
