export const FAQ_SECTION_OPEN_TAG: string
export function extractFaqEntries(html: unknown): { question: string; answer: string }[]
export function buildTravelFaqJsonLd(html: unknown): Record<string, unknown> | null
