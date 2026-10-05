import React, { forwardRef } from 'react'
import { StyleSheet, Text } from 'react-native'
import RawFeather from '@expo/vector-icons/build/Feather'

import { ICON_FONT_DATASET, ICON_FONT_FAMILY } from '@/utils/iconFontContract'

type FeatherProps = React.ComponentProps<typeof RawFeather>
type FeatherRef = React.ComponentRef<typeof Text>

const glyphMap = RawFeather.glyphMap as Record<string, number | string>

const resolveGlyph = (name: unknown): string => {
  if (!name) return ''
  const glyph = glyphMap[String(name)]
  if (typeof glyph === 'number') return String.fromCodePoint(glyph)
  return glyph || '?'
}

/**
 * Web-иконка Feather как чистая функция пропсов (#2170).
 *
 * Обёртка Expo решает «рисовать глиф или пустой Text» по глобальному кэшу
 * шрифтов: на сервере он всегда пуст, поэтому статический HTML выходил без
 * единой иконки, а прежняя версия этого файла держала их пустыми ещё и до
 * собственного commit каждого компонента — иначе граница lazy-маршрута
 * гидратировалась с уже загруженным шрифтом и расходилась с серверной
 * разметкой (#418). Здесь глиф есть в разметке всегда, одинаково на сервере и
 * на клиенте, поэтому расходиться нечему и второй рендер после гидратации не
 * нужен.
 *
 * Шрифт подключает оболочка документа (`utils/iconFontShell.ts`, вызывается из
 * `app/+html.tsx`): пока он не загружен, критический CSS прячет узел и обнуляет
 * кегль, а `minWidth/minHeight` держат место — ту же клетку `size × size`, что
 * раньше занимал плейсхолдер. После загрузки оба минимума ничего не меняют:
 * глиф Feather сам занимает ровно 1em по ширине.
 */
const FeatherHydrationSafe = forwardRef<FeatherRef, FeatherProps>(function FeatherHydrationSafe(
  { name, size = 12, color, style, children, ...props },
  ref,
) {
  const { dataSet, ...textProps } = props as typeof props & { dataSet?: Record<string, unknown> }
  return (
    <Text
      selectable={false}
      {...textProps}
      {...({ dataSet: { ...dataSet, ...ICON_FONT_DATASET } } as object)}
      ref={ref}
      style={[{ fontSize: size, color, minWidth: size, minHeight: size }, style, styles.glyph]}
    >
      {resolveGlyph(name)}
      {children}
    </Text>
  )
})

const styles = StyleSheet.create({
  glyph: {
    fontFamily: ICON_FONT_FAMILY,
    fontWeight: 'normal',
    fontStyle: 'normal',
  },
})

FeatherHydrationSafe.displayName = 'FeatherHydrationSafe'
Object.assign(FeatherHydrationSafe, RawFeather)

export default FeatherHydrationSafe as unknown as typeof RawFeather
