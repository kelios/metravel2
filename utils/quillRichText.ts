// Quill 2 class attributors: formats/{align,font,size,indent}. The editor's
// default picker values are checked against the installed Quill in unit tests.
export const QUILL_ALIGNMENTS = ['center', 'right', 'justify'] as const
export const QUILL_FONTS = ['serif', 'monospace'] as const
export const QUILL_SIZE_SCALES = { small: 0.75, large: 1.5, huge: 2.5 } as const
export const QUILL_INDENT_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8] as const

export const QUILL_BLOCK_CLASSES = [
  ...QUILL_ALIGNMENTS.map((value) => `ql-align-${value}`),
  ...QUILL_INDENT_LEVELS.map((value) => `ql-indent-${value}`),
]
export const QUILL_INLINE_CLASSES = [
  ...QUILL_FONTS.map((value) => `ql-font-${value}`),
  ...Object.keys(QUILL_SIZE_SCALES).map((value) => `ql-size-${value}`),
]

export function getQuillRichTextStyles(selector: string): string {
  return [
    ...QUILL_ALIGNMENTS.map((value) => `${selector} .ql-align-${value} { text-align: ${value}; }`),
    `${selector} .ql-font-serif { font-family: Georgia, "Times New Roman", serif; }`,
    `${selector} .ql-font-monospace { font-family: Monaco, "Courier New", monospace; }`,
    ...Object.entries(QUILL_SIZE_SCALES).map(([value, scale]) =>
      `${selector} .ql-size-${value} { font-size: ${scale}em; }`),
    ...QUILL_INDENT_LEVELS.map((value) =>
      `${selector} .ql-indent-${value} { margin-left: ${value * 1.5}em; }`),
  ].join('\n')
}
