// Native-реализация `@/ui/paper`: тонкая обёртка над react-native-paper.
//
// Расширение `.tsx` здесь ОБЯЗАТЕЛЬНО и не является случайностью (#1657).
// `moduleSuffixes: ['.web', '.native', '']` в tsconfig перебирает расширения
// снаружи, а суффиксы внутри: сначала `paper.web.ts` / `paper.native.ts` /
// `paper.ts`, и только потом `*.tsx`. Пока этот файл назывался `.ts`, он
// выигрывал у `paper.web.tsx` на первой же стадии, и типы ВСЕХ вызовов
// `@/ui/paper` — включая web — брались отсюда, то есть из react-native-paper.
// Web-реализация при этом тихо выбрасывала неизвестные ей пропы, а `tsc`
// молчал. Проверяется `npx tsc --noEmit --traceResolution | grep ui/paper`.
//
// Следствие: источник истины по типам шима — `ui/paper.web.tsx`, более узкая
// из двух реализаций. Проп, которого нет в web-шиме, нужно брать напрямую из
// `react-native-paper`, а не через `@/ui/paper`.

import React from 'react'
import { Menu as PaperMenu } from 'react-native-paper'

export * from 'react-native-paper'

type DialogMenuProps = React.ComponentProps<typeof PaperMenu> & {
  accessibilityLabel?: string
}

type DialogMenuComponent = React.FC<DialogMenuProps> & {
  Item: typeof PaperMenu.Item
}

export const DialogMenu: DialogMenuComponent = ({ accessibilityLabel: _accessibilityLabel, ...props }) =>
  React.createElement(PaperMenu, props)

// Keep the subcomponent lookup lazy. Several focused Jest suites replace
// react-native-paper with a partial mock that intentionally omits Menu; an
// eager `PaperMenu.Item` lookup then crashes while importing unrelated UI.
DialogMenu.Item = ((props: React.ComponentProps<typeof PaperMenu.Item>) =>
  React.createElement(PaperMenu.Item, props)) as typeof PaperMenu.Item
