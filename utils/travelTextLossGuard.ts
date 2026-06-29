import { confirmAction } from '@/utils/confirmAction'

export type RichTextLossField = 'description' | 'plus' | 'minus' | 'recommendation'

export type RichTextSnapshot = Partial<Record<RichTextLossField, string | null | undefined>>

const FIELD_LABELS: Record<RichTextLossField, string> = {
  description: 'описание',
  plus: 'плюсы',
  minus: 'минусы',
  recommendation: 'рекомендации',
}

const GUARDED_FIELDS: RichTextLossField[] = ['description', 'plus', 'minus', 'recommendation']

// Очевидные заглушки, которыми затирают реальный текст (см. инцидент travel/225: «<p>desc</p>»).
const PLACEHOLDER_VALUES = new Set(['desc', 'test', 'тест', 'текст', 'placeholder'])

const MIN_BASELINE_TEXT_LENGTH = 50
const MIN_NEXT_TEXT_LENGTH = 10
const SHRINK_RATIO = 0.2

function toPlainText(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isDestructiveChange(baselineText: string, nextText: string): boolean {
  if (baselineText.length < MIN_BASELINE_TEXT_LENGTH) return false

  if (nextText.length === 0) return true
  if (nextText.length <= MIN_NEXT_TEXT_LENGTH) return true
  if (PLACEHOLDER_VALUES.has(nextText.toLowerCase())) return true
  if (nextText.length < baselineText.length * SHRINK_RATIO) return true

  return false
}

/**
 * Сравнивает rich-text поля сохраняемых данных с серверным baseline и возвращает
 * список полей, текст которых резко разрушается (затирается на пустоту/заглушку).
 * Чистая функция: не показывает диалогов и не трогает данные.
 */
export function detectRichTextLoss(
  baseline: RichTextSnapshot | null | undefined,
  next: RichTextSnapshot | null | undefined,
): RichTextLossField[] {
  if (!baseline || !next) return []

  const lost: RichTextLossField[] = []
  for (const field of GUARDED_FIELDS) {
    const baselineText = toPlainText(baseline[field])
    const nextText = toPlainText(next[field])
    if (isDestructiveChange(baselineText, nextText)) {
      lost.push(field)
    }
  }
  return lost
}

/**
 * Если хотя бы одно поле теряет текст — спрашивает подтверждение (RN Web + native).
 * true → продолжить сохранение; false → прервать. Нет потерь → true без диалога.
 */
export async function confirmRichTextLossIfNeeded(
  baseline: RichTextSnapshot | null | undefined,
  next: RichTextSnapshot | null | undefined,
): Promise<boolean> {
  const lostFields = detectRichTextLoss(baseline, next)
  if (lostFields.length === 0) return true

  const labels = lostFields.map((field) => FIELD_LABELS[field]).join(', ')
  return confirmAction({
    title: 'Удаление текста',
    message: `Вы удаляете большую часть текста (${labels}). Сохранить?`,
    confirmText: 'Сохранить',
    cancelText: 'Отмена',
  })
}
