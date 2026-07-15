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
