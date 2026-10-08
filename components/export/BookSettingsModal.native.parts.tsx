// components/export/BookSettingsModal.native.parts.tsx
// #2229: нативные части окна «Настройки фотоальбома» — вместо `<select>`,
// `<input type="checkbox">` и `<button>` web-окна (`BookSettingsModal.parts.tsx`).
// Подписи — те же ключи, что у сайта.
import React, { useMemo } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'

import Button from '@/components/ui/Button'
import Chip from '@/components/ui/Chip'
import { Toggle } from '@/components/ui/Toggle'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'

import { CHECKLIST_OPTIONS } from './BookSettingsModal.constants'
import type { BookSettings, ChecklistSection } from './BookSettingsModal.types'

type Colors = ReturnType<typeof useThemedColors>

export function useNativePartStyles() {
  const colors = useThemedColors()
  return { colors, styles: useMemo(() => createStyles(colors), [colors]) }
}

/** Выбор одного варианта: строки-радиокнопки во всю ширину, не ниже 44 pt. */
export function RadioList<T extends string>({
  label,
  options,
  value,
  onChange,
  testID,
}: {
  label: string
  options: Array<{ value: T; label: string }>
  value: T
  onChange: (value: T) => void
  testID?: string
}) {
  const { styles } = useNativePartStyles()
  return (
    <View style={styles.block} accessibilityRole="radiogroup" accessibilityLabel={label} testID={testID}>
      <Text style={styles.label}>{label}</Text>
      {options.map((option) => {
        const selected = option.value === value
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={option.label}
            style={[styles.radioRow, selected && styles.radioRowSelected]}
          >
            <View style={[styles.radioDot, selected && styles.radioDotSelected]}>
              {selected ? <View style={styles.radioDotInner} /> : null}
            </View>
            <Text style={styles.radioText}>{option.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

/** Строка с переключателем: вся строка — одна цель касания с ролью switch. */
export function SwitchRow({
  title,
  hint,
  value,
  onChange,
}: {
  title: string
  hint?: string
  value: boolean
  onChange: (value: boolean) => void
}) {
  const { styles } = useNativePartStyles()
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={title}
      accessibilityHint={hint}
      style={styles.switchRow}
    >
      <View style={styles.switchText}>
        <Text style={styles.switchTitle}>{title}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <Toggle value={value} onValueChange={onChange} presentational />
    </Pressable>
  )
}

export function NativeChecklistFieldset({
  settings,
  onToggleChecklists,
  onToggleSection,
}: {
  settings: BookSettings
  onToggleChecklists: (enabled: boolean) => void
  onToggleSection: (section: ChecklistSection) => void
}) {
  const { styles } = useNativePartStyles()
  return (
    <View style={styles.block}>
      <Text style={styles.label}>
        {i18nT('profile:components.export.BookSettingsModal_parts.chek_listy_puteshestvennika_1c0b0340')}
      </Text>
      <SwitchRow
        title={i18nT('profile:components.export.BookSettingsModal_parts.dobavit_v_pdf_db5eee9c')}
        hint={i18nT('profile:components.export.BookSettingsModal_parts.standartnye_spiski_dlya_pechati_ekipirovka_e_237f6a52')}
        value={settings.includeChecklists}
        onChange={onToggleChecklists}
      />
      {settings.includeChecklists ? (
        <View style={styles.chips}>
          {CHECKLIST_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={settings.checklistSections.includes(option.value)}
              onPress={() => onToggleSection(option.value)}
              testID={`book-settings-checklist-${option.value}`}
            />
          ))}
        </View>
      ) : null}
    </View>
  )
}

export function NativeModalFooter({
  isSaving,
  hasErrors,
  showPreview,
  onClose,
  onSave,
  onPreview,
}: {
  isSaving: boolean
  hasErrors: boolean
  showPreview: boolean
  onClose: () => void
  onSave: () => void
  onPreview: () => void
}) {
  const { styles } = useNativePartStyles()
  const blocked = isSaving || hasErrors
  return (
    <View style={styles.footer} testID="book-settings-footer">
      <Button
        label={i18nT('profile:components.export.BookSettingsModal_parts.otmena_7c664a0f')}
        variant="outline"
        onPress={onClose}
        fullWidth
        labelNumberOfLines={0}
        labelStyle={styles.footerLabel}
        style={styles.footerButton}
        testID="book-settings-cancel"
      />
      {showPreview ? (
        <Button
          label={i18nT('profile:components.export.BookSettingsModal_parts.prevyu_8a8a2b33')}
          accessibilityLabel={i18nT('profile:components.export.BookSettingsModal_parts.predvaritelnyy_prosmotr_pdf_9de23958')}
          variant="outline"
          onPress={onPreview}
          disabled={blocked}
          fullWidth
          labelNumberOfLines={0}
          labelStyle={styles.footerLabel}
          style={styles.footerButton}
          testID="book-settings-preview"
        />
      ) : null}
      <Button
        label={
          isSaving
            ? i18nT('profile:components.export.BookSettingsModal_parts.sozdanie_14bbb42e')
            : i18nT('profile:components.export.BookSettingsModal_parts.sohranit_pdf_513469e1')
        }
        accessibilityLabel={i18nT('profile:components.export.BookSettingsModal_parts.sohranit_i_sozdat_pdf_48d80cbb')}
        variant="primary"
        onPress={onSave}
        disabled={blocked}
        loading={isSaving}
        fullWidth
        labelNumberOfLines={0}
        labelStyle={styles.footerLabel}
        style={styles.footerButton}
        testID="book-settings-save"
      />
    </View>
  )
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    block: { gap: 8 },
    label: { fontSize: 15, fontWeight: '700', color: colors.text },
    hint: { fontSize: 13, color: colors.textMuted },
    radioRow: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    radioRowSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    radioDot: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioDotSelected: { borderColor: colors.primary },
    radioDotInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
    radioText: { flex: 1, fontSize: 15, color: colors.text },
    switchRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12 },
    switchText: { flex: 1, gap: 2 },
    switchTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    footer: {
      // The iPad pageSheet can also be narrow: intrinsic stacked actions keep
      // translated labels readable without relying on the screen width.
      flexDirection: 'column',
      flexShrink: 0,
      gap: DESIGN_TOKENS.spacing.xs,
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      paddingVertical: DESIGN_TOKENS.spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
    footerButton: { minHeight: Platform.OS === 'android' ? 48 : 44 },
    footerLabel: { textAlign: 'center' },
  })
