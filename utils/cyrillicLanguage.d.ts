export type CyrillicLanguageSegment = { text: string; lang: string | null };

export const CYRILLIC_LETTER: RegExp;
export const LATIN_SCRIPT_LOCALES: readonly string[];
export function cyrillicLanguageSegments(
  text: unknown,
  options?: { countryCode?: string | null },
): CyrillicLanguageSegment[];
export function cyrillicRunLanguages(
  run: string,
  options?: { countryCode?: string | null },
): CyrillicLanguageSegment[];
export function quotedCyrillicSegments(
  text: unknown,
  options?: { contentLocale?: string | null; countryCode?: string | null },
): CyrillicLanguageSegment[] | null;
