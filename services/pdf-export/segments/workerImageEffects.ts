import { Parser } from 'htmlparser2'

export type WorkerColorFilter = 'none' | 'sepia(1)' | 'grayscale(1)'
export interface WorkerImageEffect { theme_id: string; filter: WorkerColorFilter }

/** Private markers are emitted only by canonical builders in the schema-4 context. */
export function workerImageFilterStyle(filter: string | undefined, themeId?: string): string {
  if (!themeId) return filter ? `filter: ${filter};` : ''
  if (!filter) return ''
  const canonical = filter === 'sepia(100%)' || filter === 'sepia(1)' ? 'sepia(1)'
    : filter === 'grayscale(100%)' || filter === 'grayscale(1)' ? 'grayscale(1)' : undefined
  if (!canonical || (canonical === 'sepia(1)' ? themeId !== 'sepia' : themeId !== 'black-white')) throw new Error('PRINT_IMAGE_EFFECT_UNSUPPORTED')
  return `filter: none; --metravel-print-effect: ${canonical}; --metravel-print-theme: ${themeId};`
}

export function assertWorkerImageEffect(effect: WorkerImageEffect): void {
  if (!effect || typeof effect !== 'object' || !['theme_id', 'filter'].every(key => Object.keys(effect).includes(key)) || Object.keys(effect).length !== 2 ||
    !(effect.filter === 'none' && effect.theme_id === 'unfiltered') &&
    !(effect.filter === 'sepia(1)' && effect.theme_id === 'sepia') &&
    !(effect.filter === 'grayscale(1)' && effect.theme_id === 'black-white')) throw new Error('PRINT_IMAGE_EFFECT_UNSUPPORTED')
}

export function imageEffectFromWorkerStyle(style: string): WorkerImageEffect {
  const effect = style.match(/--metravel-print-effect\s*:\s*([^;]+);?/g) || []
  const theme = style.match(/--metravel-print-theme\s*:\s*([^;]+);?/g) || []
  if (!effect.length && !theme.length) {
    if (/--metravel-print-/i.test(style)) throw new Error('PRINT_IMAGE_EFFECT_UNSUPPORTED')
    return { theme_id: 'unfiltered', filter: 'none' }
  }
  if (effect.length !== 1 || theme.length !== 1 || /!important|url\(/i.test(style)) throw new Error('PRINT_IMAGE_EFFECT_AMBIGUOUS')
  const filters = [...style.matchAll(/(?:^|;)\s*filter\s*:\s*([^;]+)/g)]
  if (!filters.length || filters.at(-1)![1].trim() !== 'none') throw new Error('PRINT_IMAGE_EFFECT_AMBIGUOUS')
  const intent = { theme_id: theme[0].split(':').slice(1).join(':').replace(/;$/, '').trim(),
    filter: effect[0].split(':').slice(1).join(':').replace(/;$/, '').trim() as WorkerColorFilter }
  assertWorkerImageEffect(intent)
  return intent
}


export function assertNoAuthoredImageEffectMarkers(html: string): void {
  new Parser({ onopentag(_name, attributes) {
    if (/--metravel-print-/i.test(attributes.style || '') || Object.keys(attributes).some(name => /^data-(?:metravel|book)-print-(?:color|effect|theme)/i.test(name))) throw new Error('PRINT_IMAGE_EFFECT_AUTHORED_MARKER')
  } }, { decodeEntities: true }).end(html)
}
