import { translate as i18nT } from '@/i18n'
import type { ReportReason, ReportReasonKey } from '@/api/userSafety'

const REPORT_REASON_I18N_KEYS: Record<ReportReasonKey, string> = {
  spam: 'sharedStatic:userSafety.reason.spam',
  harassment: 'sharedStatic:userSafety.reason.harassment',
  scam: 'sharedStatic:userSafety.reason.scam',
  inappropriate_content: 'sharedStatic:userSafety.reason.inappropriateContent',
  fake_account: 'sharedStatic:userSafety.reason.fakeAccount',
  other: 'sharedStatic:userSafety.reason.other',
}

export const REPORT_REASON_KEYS = Object.keys(REPORT_REASON_I18N_KEYS) as ReportReasonKey[]

/**
 * Подпись причины жалобы на языке интерфейса. BE отдаёт `label` из
 * непереведённых Django choices (по-русски при любом Accept-Language), поэтому
 * подпись — app-owned текст по `key`; серверная остаётся только для ключа,
 * которого приложение ещё не знает.
 */
export function reportReasonLabel(reason: ReportReason): string {
  const i18nKey = REPORT_REASON_I18N_KEYS[reason.key]
  return i18nKey ? i18nT(i18nKey) : reason.label
}
