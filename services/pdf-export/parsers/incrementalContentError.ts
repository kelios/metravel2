export class IncrementalContentError extends Error {
  constructor(readonly code: string) {
    super(code)
    this.name = 'IncrementalContentError'
  }
}
