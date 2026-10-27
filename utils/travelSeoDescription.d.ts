export function truncateSeoText(html?: string | null, maxLength?: number): string
export function buildTravelSeoDescription(
  travel: { name?: string | null; countryName?: string | null; description?: string | null } | null | undefined,
  detailDescription?: string | null,
  detailMetaDescription?: unknown,
): string
