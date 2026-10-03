// utils/printHtml.types.ts
// #2102: контракт единой точки печати. Реализации — printHtml.web.ts (окно
// браузера) и printHtml.native.ts (системный диалог печати через expo-print).

/** printed — печать запущена; cancelled — пользователь закрыл диалог; unavailable — печатать нечем. */
export type PrintResult = 'printed' | 'cancelled' | 'unavailable'

export type PrintOptions = {
  /** Название задания в диалоге печати и очереди принтера. */
  title?: string
}

/**
 * Печать, зарезервированная синхронно. На web окно печати обязано открыться в
 * обработчике клика, до первого await, иначе блокировщик всплывающих окон его
 * отменит; HTML догружается в уже открытое окно. На native резерва нет.
 */
export type PrintSession = {
  /**
   * false — печатать некуда (окно заблокировано / нет native-модуля): вызывающий
   * выходит с 'unavailable' ДО загрузки данных, карт и картинок для документа.
   */
  available: boolean
  print: (html: string, options?: PrintOptions) => Promise<PrintResult>
}
