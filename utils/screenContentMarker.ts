import { webDataSetProps } from './webProps'

/**
 * Метка «первый блок содержательного контента экрана» — единственный сигнал,
 * который читает замер мобильного бюджета `e2e/helpers/mobileScreenBudget.ts`
 * (#2094, `[data-screen-content="first"]`) для `firstContentTop/viewportHeight`.
 * Ставится на первый блок ПОСЛЕ шапки/тулбара/описания экрана — там, где
 * начинается то, ради чего пользователь открыл экран (карточка, карта,
 * форма), а не на самой шапке.
 *
 * Единая типизированная точка поверх `webDataSetProps` (typed RN-Web bridge,
 * `utils/webProps.ts`) — без неё каждый файл писал бы свой `as any` для
 * `dataSet`. Карточки эпика #2105 (#2099, #2104), меняющие вид этих же
 * экранов, находят все места разметки одним grep по
 * `SCREEN_CONTENT_FIRST_PROPS`.
 *
 * Спред, а не JSX-литерал: `<View {...SCREEN_CONTENT_FIRST_PROPS}>` —
 * TypeScript excess-property checking не применяется к спреду типизированной
 * константы, поэтому `dataSet` доходит до `View`/`Pressable`/`Text` без
 * приведения типа на месте использования.
 */
export const SCREEN_CONTENT_FIRST_PROPS = webDataSetProps({ screenContent: 'first' })
