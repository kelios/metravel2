import { confirmAction } from '@/utils/confirmAction'
import { translate as i18nT } from '@/i18n'


export type RichTextLossField = 'description' | 'plus' | 'minus' | 'recommendation'

export type RichTextSnapshot = Partial<Record<RichTextLossField, string | null | undefined>>

const FIELD_LABELS: Record<RichTextLossField, string> = {
  get description() { return i18nT('sharedStatic:utils.travelTextLossGuard.opisanie_92a9bc20') },
  get plus() { return i18nT('travel:utils.travelTextLossGuard.field.plus') },
  get minus() { return i18nT('travel:utils.travelTextLossGuard.field.minus') },
  get recommendation() { return i18nT('travel:utils.travelTextLossGuard.field.recommendation') },
}

const GUARDED_FIELDS: RichTextLossField[] = ['description', 'plus', 'minus', 'recommendation']

// Очевидные заглушки, которыми затирают реальный текст (см. инцидент travel/225: «<p>desc</p>»).
const getPlaceholderValues = () => new Set(
  i18nT('travel:utils.travelTextLossGuard.placeholderValues')
    .split('|')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
)

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
  if (getPlaceholderValues().has(nextText.toLowerCase())) return true
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
    title: i18nT('shared:utils.travelTextLossGuard.udalenie_teksta_a462d4b0'),
    message: i18nT('shared:utils.travelTextLossGuard.vy_udalyaete_bolshuyu_chast_teksta_value1_so_5ee11217', { value1: labels }),
    confirmText: i18nT('shared:utils.travelTextLossGuard.sohranit_6bb2a5f7'),
    cancelText: i18nT('shared:utils.travelTextLossGuard.otmena_d5b1e3ab'),
  })
}
