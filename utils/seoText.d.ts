export const SEO_TITLE_MAX_LENGTH: number;
export const SEO_TITLE_SUFFIX: string;

export function buildSeoTitle(base?: string | null, maxLength?: number): string;
export function htmlToPlainText(html?: string | null): string;
export function normalizeSeoLead(text?: string | null): string;
