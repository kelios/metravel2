import { sendFeedback } from '@/api/misc'
import { sendAnalyticsEvent } from '@/utils/analytics'
import { resolveSourcePath } from '@/utils/navigationTrail'

/**
 * Отправка формы «Связаться с нами» (#3284) — одна для /contact и /about.
 * Вместе с текстом уходит экран, с которого человек пришёл к форме, а успешная
 * отправка оставляет событие аналитики: раньше её не было видно ни в Метрике,
 * ни в GA4, а по письму нельзя было понять, какая страница вызвала вопрос.
 */
export async function submitContactFeedback(name: string, email: string, message: string): Promise<string> {
  const sourcePath = resolveSourcePath()
  const result = await sendFeedback(name, email, message, sourcePath)
  void sendAnalyticsEvent('ContactForm_Submitted', { source_path: sourcePath ?? 'direct' })
  return result
}
