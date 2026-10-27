/** Explicit print URLs are an entry into the existing printable-quest flow. */
export const QUEST_PRINT_PARAM = 'print';

export function isQuestPrintRequested(value: string | string[] | undefined): boolean {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === '1' || raw === 'true';
}
