/**
 * Text Processing Utilities для TravelDetails
 * Извлечено из TravelDetailsDeferred
 */

/**
 * Извлекает короткий фрагмент текста для превью
 */
export function extractSnippets(text: string | undefined | null, maxSentences: number): string {
  if (!text || !text.trim()) return '';

  const cleanText = text
    .replace(/(&nbsp;|&#160;)/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const sentences = cleanText.match(/[^.!?]+[.!?]+/g) || [cleanText];
  const selected = sentences.slice(0, maxSentences).join(' ').trim();

  return selected.length > 150 ? selected.slice(0, 150) + '...' : selected;
}

/**
 * Разбивает текст на буллеты с учетом списков и подпунктов
 */
export interface TipItem {
  text: string;
  level: 0 | 1;
}

export function splitTextToBullets(text: string): TipItem[] {
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/(&nbsp;|&#160;)/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\u2022/g, '•')
    .replace(/\s+/g, ' ')
    .trim();

  const withListBreaks = normalized
    .replace(/\s+(?=\d{1,2}\s*[).]\s+)/g, '\n')
    .replace(/\s+(?=[-–—]\s+)/g, '\n');

  const lines = withListBreaks
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const items: TipItem[] = [];

  const pushOrAppend = (level: 0 | 1, value: string) => {
    const v = value.trim();
    if (!v) return;
    items.push({ text: v, level });
  };

  const splitInlineSubBullets = (mainText: string): { main: string; subs: string[] } => {
    const cleaned = mainText.trim();
    if (!cleaned) return { main: '', subs: [] };

    const parts = cleaned
      .split(/\s+[-–—]\s+/g)
      .map((p) => p.trim())
      .filter(Boolean);

    if (parts.length <= 1) return { main: cleaned, subs: [] };
    return { main: parts[0] ?? '', subs: parts.slice(1) };
  };

  let inNumbered = false;

  for (const lineRaw of lines) {
    const line = lineRaw.replace(/^•\s*/, '').trim();
    const numberedMatch = line.match(/^(\d{1,2})\s*[).]\s+(.*)$/);

    if (numberedMatch) {
      inNumbered = true;
      const rest = (numberedMatch[2] ?? '').trim();
      const { main, subs } = splitInlineSubBullets(rest);
      pushOrAppend(0, main);
      subs.forEach((s) => pushOrAppend(1, s));
      continue;
    }

    const subMatch = line.match(/^[-–—]\s+(.*)$/);
    if (subMatch) {
      pushOrAppend(1, subMatch[1] ?? '');
      continue;
    }

    if (inNumbered && items.length > 0) {
      const idxFromEnd = [...items].reverse().findIndex((x) => x.level === 0);
      if (idxFromEnd >= 0) {
        const idx = items.length - 1 - idxFromEnd;
        items[idx] = { ...items[idx], text: `${items[idx].text} ${line}` };
        continue;
      }
    }

    pushOrAppend(0, line);
  }

  return items;
}

/**
 * Создает краткую сводку по рекомендациям, плюсам и минусам
 */
export interface DecisionSummaryItem {
  label: string;
  text: string;
  tone: 'info' | 'positive' | 'negative';
}

export function buildDecisionSummary(
  recommendation: string | undefined | null,
  plus: string | undefined | null,
  minus: string | undefined | null
): DecisionSummaryItem[] {
  const items: DecisionSummaryItem[] = [];
  const rec = extractSnippets(recommendation, 2);
  const plusText = extractSnippets(plus, 1);
  const minusText = extractSnippets(minus, 1);

  if (rec) items.push({ label: 'Полезно', text: rec, tone: 'info' });
  if (plusText) items.push({ label: 'Плюс', text: plusText, tone: 'positive' });
  if (minusText) items.push({ label: 'Минус', text: minusText, tone: 'negative' });

  return items.slice(0, 3);
}

/**
 * Преобразует текст рекомендаций в структурированные подсказки
 */
export function buildDecisionTips(recommendation: string | undefined | null): TipItem[] {
  if (!recommendation || !recommendation.trim()) return [];
  return splitTextToBullets(recommendation);
}
