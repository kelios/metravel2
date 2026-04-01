export type QuickFilterValue =
  | string
  | number
  | Array<string | number>
  | ReadonlyArray<string | number>

export type QuickFilterParams = Record<string, QuickFilterValue | undefined>
