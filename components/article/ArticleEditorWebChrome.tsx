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
import { translate as i18nT } from '@/i18n'


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
    showLabel={false}
    showTooltip={!isCompactViewport}
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
                ? i18nT('shared:components.article.ArticleEditorWebChrome.zagruzka_izobrazheniya_761ff261')
                : isManualSaving
                  ? i18nT('shared:components.article.ArticleEditorWebChrome.sohranenie_d02351eb')
                  : i18nT('shared:components.article.ArticleEditorWebChrome.sohranit_puteshestvie_4f9a9f2f')
            }
            size={isCompactViewport ? 'sm' : 'md'}
            style={dynamicStyles.btn}
            showLabel={false}
            showTooltip={!isCompactViewport}
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
        <Text style={dynamicStyles.modalTitle}>{i18nT('shared:components.article.ArticleEditorWebChrome.vstavit_yakor_3097efbe')}</Text>
        <Text style={dynamicStyles.modalDescription}>
          {i18nT('shared:components.article.ArticleEditorWebChrome.identifikator_naprimer_day_3_1da8b82b')}</Text>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          placeholder={i18nT('shared:components.article.ArticleEditorWebChrome.day_3_49087a34')}
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          style={dynamicStyles.modalInput}
        />
        <View style={dynamicStyles.modalActions}>
          <Button onPress={onCancel} label={i18nT('shared:components.article.ArticleEditorWebChrome.otmena_2b1f8ee3')} variant="ghost" size="sm" />
          <Button onPress={onConfirm} label={i18nT('shared:components.article.ArticleEditorWebChrome.vstavit_db7090ed')} variant="primary" size="sm" />
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
        <Text style={dynamicStyles.modalTitle}>{i18nT('shared:components.article.ArticleEditorWebChrome.ssylka_f84e3543')}</Text>
        <Text style={dynamicStyles.modalDescription}>
          {i18nT('shared:components.article.ArticleEditorWebChrome.url_naprimer_https_example_com_a732e899')}</Text>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          placeholder={i18nT('shared:components.article.ArticleEditorWebChrome.https_58b02aae')}
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          style={dynamicStyles.modalInput}
        />
        <View style={dynamicStyles.modalActions}>
          <Button onPress={onCancel} label={i18nT('shared:components.article.ArticleEditorWebChrome.otmena_2b1f8ee3')} variant="ghost" size="sm" />
          <Button onPress={onConfirm} label={i18nT('shared:components.article.ArticleEditorWebChrome.sohranit_59531924')} variant="primary" size="sm" />
        </View>
      </View>
    </View>
  </Modal>
)
