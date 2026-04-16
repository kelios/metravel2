import React from 'react'
import {
  ActivityIndicator,
  Modal,
  Text,
  TextInput,
  View,
} from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import type { ThemedColors } from '@/hooks/useTheme'
import UiIconButton from '@/components/ui/IconButton'
import Button from '@/components/ui/Button'

type DynamicStyles = ReturnType<typeof import('./ArticleEditor.web.styles').getArticleEditorWebStyles>

type IconName = keyof typeof Feather.glyphMap

type ToolbarAction = {
  name: IconName
  label: string
  onPress: () => void
}

type ArticleEditorToolbarProps = {
  colors: ThemedColors
  dynamicStyles: DynamicStyles
  isCompactViewport: boolean
  isImageUploading: boolean
  isManualSaving: boolean
  isWeb: boolean
  label: string
  onManualSave?: (() => void) | null
  actions: ToolbarAction[]
}

const ToolbarIconButton = ({
  colors,
  dynamicStyles,
  isCompactViewport,
  name,
  onPress,
  label,
}: {
  colors: ThemedColors
  dynamicStyles: DynamicStyles
  isCompactViewport: boolean
  name: IconName
  onPress: () => void
  label: string
}) => (
  <UiIconButton
    icon={<Feather name={name} size={20} color={colors.textSecondary} />}
    onPress={onPress}
    label={label}
    size={isCompactViewport ? 'sm' : 'md'}
    style={dynamicStyles.btn}
  />
)

export const ArticleEditorToolbar = ({
  colors,
  dynamicStyles,
  isCompactViewport,
  isImageUploading,
  isManualSaving,
  label,
  onManualSave,
  actions,
}: ArticleEditorToolbarProps) => {
  return (
    <View style={dynamicStyles.bar}>
      <Text style={dynamicStyles.label}>{label}</Text>
      <View style={dynamicStyles.row}>
        {actions.map((action) => (
          <ToolbarIconButton
            key={action.label}
            colors={colors}
            dynamicStyles={dynamicStyles}
            isCompactViewport={isCompactViewport}
            name={action.name}
            onPress={action.onPress}
            label={action.label}
          />
        ))}
        {onManualSave && (
          <UiIconButton
            icon={
              isManualSaving || isImageUploading ? (
                <ActivityIndicator size="small" color={colors.textSecondary} />
              ) : (
                <Feather name="save" size={20} color={colors.textSecondary} />
              )
            }
            onPress={onManualSave}
            label={
              isImageUploading
                ? 'Загрузка изображения…'
                : isManualSaving
                  ? 'Сохранение…'
                  : 'Сохранить путешествие'
            }
            size={isCompactViewport ? 'sm' : 'md'}
            style={dynamicStyles.btn}
            disabled={isManualSaving || isImageUploading}
          />
        )}
      </View>
    </View>
  )
}

type AnchorModalProps = {
  colors: ThemedColors
  dynamicStyles: DynamicStyles
  visible: boolean
  value: string
  inputRef: React.RefObject<any>
  onChangeText: (value: string) => void
  onCancel: () => void
  onConfirm: () => void
  onShow?: () => void
}

export const ArticleEditorAnchorModal = ({
  colors,
  dynamicStyles,
  visible,
  value,
  inputRef,
  onChangeText,
  onCancel,
  onConfirm,
  onShow,
}: AnchorModalProps) => (
  <Modal
    visible={visible}
    transparent
    animationType="fade"
    onShow={onShow}
    onRequestClose={onCancel}
  >
    <View style={dynamicStyles.modalBackdrop}>
      <View style={dynamicStyles.modalCard}>
        <Text style={dynamicStyles.modalTitle}>Вставить якорь</Text>
        <Text style={dynamicStyles.modalDescription}>
          Идентификатор (например: day-3)
        </Text>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          placeholder="day-3"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          style={dynamicStyles.modalInput}
        />
        <View style={dynamicStyles.modalActions}>
          <Button onPress={onCancel} label="Отмена" variant="ghost" size="sm" />
          <Button onPress={onConfirm} label="Вставить" variant="primary" size="sm" />
        </View>
      </View>
    </View>
  </Modal>
)

type LinkModalProps = {
  colors: ThemedColors
  dynamicStyles: DynamicStyles
  visible: boolean
  value: string
  inputRef: React.RefObject<any>
  onChangeText: (value: string) => void
  onCancel: () => void
  onConfirm: () => void
  onShow?: () => void
}

export const ArticleEditorLinkModal = ({
  colors,
  dynamicStyles,
  visible,
  value,
  inputRef,
  onChangeText,
  onCancel,
  onConfirm,
  onShow,
}: LinkModalProps) => (
  <Modal
    visible={visible}
    transparent
    animationType="fade"
    onShow={onShow}
    onRequestClose={onCancel}
  >
    <View style={dynamicStyles.modalBackdrop}>
      <View style={dynamicStyles.modalCard}>
        <Text style={dynamicStyles.modalTitle}>Ссылка</Text>
        <Text style={dynamicStyles.modalDescription}>
          URL (например: https://example.com)
        </Text>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          placeholder="https://..."
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          style={dynamicStyles.modalInput}
        />
        <View style={dynamicStyles.modalActions}>
          <Button onPress={onCancel} label="Отмена" variant="ghost" size="sm" />
          <Button onPress={onConfirm} label="Сохранить" variant="primary" size="sm" />
        </View>
      </View>
    </View>
  </Modal>
)
