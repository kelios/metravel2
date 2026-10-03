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
 * Отмена пользователем — только по коду ошибки expo-print (ios/ExpoPrintExceptions.swift):
 * лист печати закрыт без печати → PrintIncompleteException (`ERR_PRINT_INCOMPLETE`,
 * «Printing did not complete»); выбор принтера отменён → PickerCanceledException
 * (`ERR_PICKER_CANCELED`, только selectPrinterAsync). На Android printAsync({ html })
 * резолвится сразу после показа системного диалога (PrintModule.kt), поэтому там
 * 'cancelled' недостижим: 'printed' означает «диалог показан».
 */
const CANCEL_CODES = new Set(['ERR_PRINT_INCOMPLETE', 'ERR_PICKER_CANCELED'])

function isCancellation(error: unknown): boolean {
  const { code } = (error ?? {}) as { code?: unknown }
  return typeof code === 'string' && CANCEL_CODES.has(code)
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
  return { available: isPrintAvailable(), print: printHtml }
}
