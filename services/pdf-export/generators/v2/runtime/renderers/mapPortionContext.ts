/** Worker-only full source text policy; omission preserves the legacy layout. */
export interface RuntimeMapPortionContext {
  startIndex: number
  textPolicy: 'inline' | 'detached'
}
