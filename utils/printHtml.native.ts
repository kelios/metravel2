// utils/printHtml.native.ts
// #2102: native-адаптер печати — системный диалог iPhone/Android (AirPrint,
// «Сохранить как PDF») через expo-print. expo-print — native-модуль: в
// сборках, где его нет, он не подгружается (его require бросает на старте),
// а печать честно отвечает 'unavailable'.
import { requireOptionalNativeModule } from 'expo'
import type { PrintOptions, PrintResult, PrintSession } from './printHtml.types'

export type { PrintOptions, PrintResult, PrintSession } from './printHtml.types'

const PRINT_NATIVE_MODULE = 'ExpoPrint'

export function isPrintAvailable(): boolean {
  try {
    return requireOptionalNativeModule(PRINT_NATIVE_MODULE) != null
  } catch {
    return false
  }
}

/**
 * Отмена пользователем — по коду ошибки expo-print или по причине (#2160, см. ниже)
 * (ios/ExpoPrintExceptions.swift):
 * лист печати закрыт без печати → PrintIncompleteException (`ERR_PRINT_INCOMPLETE`,
 * «Printing did not complete»); выбор принтера отменён → PickerCanceledException
 * (`ERR_PICKER_CANCELED`, только selectPrinterAsync). На Android printAsync({ html })
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

export async function printHtml(html: string, _options?: PrintOptions): Promise<PrintResult> {
  if (!isPrintAvailable()) return 'unavailable'
  try {
    const Print = await import('expo-print')
    await Print.printAsync({ html })
    return 'printed'
  } catch (error) {
    if (isCancellation(error)) return 'cancelled'
    throw error
  }
}

/** На native резервировать нечего — печать запускается, когда HTML готов. */
export function beginPrint(): PrintSession {
  return { available: isPrintAvailable(), print: printHtml, cancel: () => {} }
}
