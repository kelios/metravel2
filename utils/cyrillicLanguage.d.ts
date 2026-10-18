export type CyrillicLanguageSegment = { text: string; lang: string | null };

export const CYRILLIC_LETTER: RegExp;
export function cyrillicLanguageSegments(
  text: unknown,
  options?: { countryCode?: string | null },
): CyrillicLanguageSegment[];
export function cyrillicRunLanguages(
  run: string,
  options?: { countryCode?: string | null },
): CyrillicLanguageSegment[];
