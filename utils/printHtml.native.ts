// utils/printHtml.native.ts
// #2102: native-адаптер печати — системный диалог iPhone/Android (AirPrint,
// «Сохранить как PDF») через expo-print. expo-print — native-модуль: в
// сборках, где его нет, он не подгружается (его require бросает на старте),
// а печать честно отвечает 'unavailable'.
import { Platform } from 'react-native'
import { translate as i18nT, translatePlural } from '@/i18n'
import { showToast } from '@/utils/toast'

import { isPrintAvailable } from './printAvailability.native'
import type { BeginPrintOptions, PrintOptions, PrintResult, PrintSession } from './printHtml.types'
import {
  PRINT_DOCUMENT_TIMEOUT_MS,
  preflightPrintResources,
} from './printResourcePreflight'

export type { BeginPrintOptions, PrintOptions, PrintResult, PrintSession } from './printHtml.types'
export { isPrintAvailable }

/**
 * Отмена пользователем — по коду ошибки expo-print или по причине (#2160, см. ниже)
 * (ios/ExpoPrintExceptions.swift):
 * лист печати закрыт без печати → PrintIncompleteException (`ERR_PRINT_INCOMPLETE`,
 * «Printing did not complete»); выбор принтера отменён → PickerCanceledException
 * (`ERR_PICKER_CANCELED`, только selectPrinterAsync). На Android printAsync({ uri })
 * резолвится сразу после показа системного диалога (PrintModule.kt), поэтому там
 * 'cancelled' недостижим: 'printed' означает «диалог показан».
 */
const CANCEL_CODES = new Set(['ERR_PRINT_INCOMPLETE', 'ERR_PICKER_CANCELED'])
/**
 * #2160: на iOS (RN 0.86, expo-print 57) отказ при закрытии листа приходит в JS
 * без `code` — только с `reason` исключения в тексте (замер на iPhone 17 Pro
 * iOS 26.5: `code=undefined`, `message="Printing did not complete"`). Поэтому
 * отмена распознаётся по коду ИЛИ по причине из ExpoPrintExceptions.swift,
 * в том числе во вложенной `cause`.
 */
const CANCEL_REASONS = ['Printing did not complete', 'Printer picker has been cancelled']

function isCancellation(error: unknown): boolean {
  for (let current: unknown = error, depth = 0; current && depth < 3; depth += 1) {
    const { code, message, cause } = current as { code?: unknown; message?: unknown; cause?: unknown }
    if (typeof code === 'string' && CANCEL_CODES.has(code)) return true
    if (typeof message === 'string' && CANCEL_REASONS.some((reason) => message.includes(reason))) return true
    current = cause
  }
  return false
}

async function removeTemporaryPdf(uri: string): Promise<void> {
  try {
    const FileSystem = await import('expo-file-system/legacy')
    await FileSystem.deleteAsync(uri, { idempotent: true })
  } catch {
    // Cache cleanup must not replace the print/cancellation outcome.
  }
}

/** #2274: bounded HTML rendering has no presentation side effect. Only the
 * resulting local PDF reaches printAsync; time in the system sheet is free. */
function createPrintSession(): PrintSession {
  const startedAt = Date.now()
  const controller = new AbortController()
  const { signal } = controller
  let preparationError: Error | undefined
  const available = isPrintAvailable()
  const expirePreparation = () => {
    preparationError = new Error(i18nT('common:print.preparationTimeout'))
    controller.abort()
  }
  const timer = available ? setTimeout(expirePreparation, PRINT_DOCUMENT_TIMEOUT_MS) : undefined
  const checkStopped = (): boolean => {
    if (!signal.aborted && Date.now() >= startedAt + PRINT_DOCUMENT_TIMEOUT_MS) expirePreparation()
    if (preparationError) throw preparationError
    return signal.aborted
  }

  const waitForPreparation = async <T,>(work: Promise<T>): Promise<T | undefined> => {
    let stop: () => void = () => {}
    const stopped = new Promise<undefined>((resolve) => { stop = () => resolve(undefined) })
    signal.addEventListener('abort', stop, { once: true })
    if (signal.aborted) stop()
    try { return await Promise.race([work, stopped]) }
    finally { signal.removeEventListener('abort', stop) }
  }

  const print = async (html: string, _options?: PrintOptions): Promise<PrintResult> => {
    if (!available) return 'unavailable'
    let pdfUri: string | undefined
    let delivered = false
    try {
      if (checkStopped()) return 'cancelled'
      const deadlineAt = startedAt + PRINT_DOCUMENT_TIMEOUT_MS
      const preflight = await preflightPrintResources(html, { deadlineAt, signal })
      if (checkStopped() || preflight.aborted) return 'cancelled'
      if (preflight.skippedImages > 0) {
        void showToast({
          type: 'info',
          text1: translatePlural('common:print.imagesSkipped', preflight.skippedImages),
          position: 'bottom',
        })
      }
      const Print = await waitForPreparation(import('expo-print'))
      if (checkStopped() || !Print) return 'cancelled'
      // printAsync({html}) renders and presents in one native callback, so a
      // cancelled JS promise could still open a sheet. File rendering cannot.
      const rendered = await waitForPreparation(Print.printToFileAsync({ html: preflight.html }).then((file) => {
        if (signal.aborted) {
          void removeTemporaryPdf(file.uri)
          return undefined
        }
        return file
      }))
      pdfUri = rendered?.uri
      if (checkStopped() || !pdfUri) return 'cancelled'
      clearTimeout(timer)
      await Print.printAsync({ uri: pdfUri })
      delivered = true
      return 'printed'
    } catch (error) {
      if (isCancellation(error)) return 'cancelled'
      throw error
    } finally {
      clearTimeout(timer)
      // Android resolves printAsync at presentation, before onWrite reads the
      // URI. A delivered file must remain in Expo cache for that system reader.
      if (pdfUri && (!delivered || Platform.OS === 'ios')) void removeTemporaryPdf(pdfUri)
    }
  }

  return {
    available, preparationSignal: signal, getPreparationError: () => preparationError, print,
    cancel: () => { clearTimeout(timer); controller.abort() },
  }
}

export function printHtml(html: string, options?: PrintOptions): Promise<PrintResult> {
  return createPrintSession().print(html, options)
}

/**
 * На native резервировать нечего — печать запускается, когда HTML готов;
 * `inPlace` не нужен: системный просмотр печати и так открывается поверх экрана.
 * `cancel()` (#2274) прерывает проверку ресурсов и не даёт листу открыться позже.
 */
export function beginPrint(_options?: BeginPrintOptions): PrintSession {
  return createPrintSession()
}
