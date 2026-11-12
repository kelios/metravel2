import { useEffect, useLayoutEffect } from 'react'
import { Platform } from 'react-native'

/**
 * Текст, набранный в поле статической страницы до гидрации (#3346).
 *
 * Статический HTML показывает поле раньше, чем приходят скрипты, и посетитель
 * успевает в него печатать. Событий ввода React не воспроизводит, поэтому state
 * владельца остаётся пустым в обоих исходах гидрации:
 * - экран под `Suspense` с ленивым чанком: обновление от предков приходит раньше
 *   чанка, React бросает гидрацию границы, удаляет серверную разметку вместе с полем
 *   и рисует экран заново;
 * - разметка гидрирована на месте: первый же повторный рендер контролируемого поля
 *   записывает пустой state поверх набранного.
 *
 * Поэтому значение читается не из разметки «после», а из самого узла статики:
 * `rememberPrehydrationInput` запоминает узел, пока разметка цела (удалённый из
 * документа узел хранит то, что в него успели напечатать), а хук при монтировании
 * поля отдаёт его значение владельцу state. Native: статической разметки нет.
 */
type StaticInput = { value?: unknown }

const staticInputs = new Map<string, StaticInput>()

const canUseDom = () => Platform.OS === 'web' && typeof document !== 'undefined'

/**
 * Запоминает узел поля из статической разметки. Вызывать до того, как React может
 * её заменить, — из фабрики `React.lazy` экрана: она выполняется в render-фазе,
 * когда серверный DOM ещё на месте. Вне гидрации узла нет, и вызов ничего не делает.
 */
export function rememberPrehydrationInput(testID: string): void {
  if (!canUseDom()) return
  const node = document.querySelector(`[data-testid="${testID}"]`)
  if (node) staticInputs.set(testID, node as StaticInput)
}

/** Значение, набранное в запомненном узле; узел отдаётся один раз. */
function takePrehydrationInputValue(testID: string): string {
  const node = staticInputs.get(testID)
  staticInputs.delete(testID)
  return typeof node?.value === 'string' ? node.value : ''
}

const useWebLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/**
 * Один раз при монтировании поля отдаёт набранное до гидрации владельцу state.
 * Layout-фаза: раньше кадра и раньше любого эффекта, который перерисует поле пустым.
 */
export function usePrehydrationInputValue(testID: string, value: string, onAdopt: (typed: string) => void): void {
  useWebLayoutEffect(() => {
    if (!canUseDom()) return
    const typed = takePrehydrationInputValue(testID)
    if (typed && typed !== value) onAdopt(typed)
    // Только при монтировании: дальше значением владеет state.
  }, [])
}
