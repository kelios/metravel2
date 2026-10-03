import { Platform, type TextStyle, type ViewStyle } from 'react-native'

import { webDataSetProps, type WebDataSet } from '@/utils/webProps'

/**
 * Раскладка по брейкпоинту, верная ДО гидратации (#2112).
 *
 * На web статический HTML один на все ширины, а `useResponsive` до гидратации
 * отдаёт `width = 0`: React рисует узкую раскладку, и экран ≥ брейкпоинта после
 * гидратации перекладывается в широкую — сдвиг всего, что ниже (/about: CLS 0,40).
 *
 * Блок раскладки описан ОДИН раз: `narrow` и `wide` с одинаковым набором ключей.
 * Из того же объекта читают два потребителя:
 *  - React — `breakpointStyle(layout, key, isWide)` по живому брейкпоинту;
 *  - critical CSS — `buildBreakpointLayoutCss(layout)` выпускает
 *    `@media (min-width:Npx){[data-bp-layout="scope-key"]{…!important}}`, и первый
 *    кадр на широком экране уже широкий. `!important` — иначе правило проигрывает
 *    атомарным классам RNW (та же грабля, что #1298).
 * На узком экране статический HTML и гидратированный DOM совпадают сами.
 *
 * Значения — только CSS-совместимые ключи RN: RN-сокращения (`flex`,
 * `paddingHorizontal`, …) RNW раскрывает по-своему, и CSS-копия бы разошлась.
 */
export type BreakpointBlockStyle = Pick<
  ViewStyle & TextStyle,
  | 'width'
  | 'minWidth'
  | 'maxWidth'
  | 'flexWrap'
  | 'minHeight'
  | 'padding'
  | 'gap'
  | 'flexDirection'
  | 'alignItems'
  | 'alignSelf'
  | 'justifyContent'
  | 'flexGrow'
  | 'flexShrink'
  | 'flexBasis'
  | 'fontSize'
  | 'lineHeight'
>

export type BreakpointBlock = { narrow: BreakpointBlockStyle; wide: BreakpointBlockStyle }

export type BreakpointLayout<K extends string = string> = {
  /** Префикс атрибута: `data-bp-layout="<scope>-<key>"`. */
  scope: string
  /** Ширина, с которой действует `wide` (как в `isWide = width >= minWidth`). */
  minWidth: number
  blocks: Record<K, BreakpointBlock>
}

export const defineBreakpointLayout = <K extends string>(layout: BreakpointLayout<K>): BreakpointLayout<K> =>
  layout

export const breakpointStyle = <K extends string>(
  layout: BreakpointLayout<K>,
  key: K,
  isWide: boolean,
): BreakpointBlockStyle => (isWide ? layout.blocks[key].wide : layout.blocks[key].narrow)

/**
 * Метка блока для CSS. На native не нужна: там нет статического HTML. `extra` —
 * уже заданный `dataSet` того же узла (например, `SCREEN_CONTENT_FIRST_PROPS`):
 * два спреда `dataSet` подряд затёрли бы первый, поэтому они сливаются здесь.
 */
export const breakpointLayoutProps = <K extends string>(
  layout: BreakpointLayout<K>,
  key: K,
  extra?: { dataSet?: WebDataSet } | null,
) =>
  Platform.OS === 'web'
    ? webDataSetProps({ ...(extra?.dataSet ?? {}), bpLayout: `${layout.scope}-${key}` })
    : (extra ?? null)

const UNITLESS = new Set(['flexGrow', 'flexShrink'])

const toCssValue = (prop: string, value: unknown): string => {
  if (typeof value === 'number') return UNITLESS.has(prop) ? String(value) : `${value}px`
  return String(value)
}

const toCssProp = (prop: string) => prop.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)

/** Проверка контракта блока: одинаковые ключи в narrow и wide. */
export const assertBreakpointBlock = (name: string, block: BreakpointBlock): void => {
  const narrow = Object.keys(block.narrow).sort().join(',')
  const wide = Object.keys(block.wide).sort().join(',')
  if (narrow !== wide) {
    throw new Error(`breakpointLayout ${name}: narrow {${narrow}} и wide {${wide}} обязаны иметь одинаковые ключи`)
  }
}

export const buildBreakpointLayoutCss = (layout: BreakpointLayout): string => {
  const rules = Object.entries(layout.blocks).map(([key, block]) => {
    assertBreakpointBlock(`${layout.scope}-${key}`, block)
    const declarations = Object.entries(block.wide)
      .map(([prop, value]) => `${toCssProp(prop)}:${toCssValue(prop, value)} !important`)
      .join(';')
    return `  [data-bp-layout="${layout.scope}-${key}"]{${declarations}}`
  })
  return [`@media (min-width:${layout.minWidth}px){`, ...rules, '}'].join('\n')
}
