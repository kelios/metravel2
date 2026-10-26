import { prepareServerWebLocale } from '@/i18n/translate.web'
import { isServerSsrRuntime, readRequestLocale } from '@/utils/ssr/requestLocale'

/** Complete the request's catalogue before metadata and document rendering. */
export default async function middleware() {
  if (!isServerSsrRuntime()) return
  const locale = readRequestLocale()
  if (!locale) throw Object.assign(new Error('SSR locale context unavailable'), { httpStatus: 503 })
  await prepareServerWebLocale(locale)
}
