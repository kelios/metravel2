import { renderLocalizedText } from '@/i18n/richText'
// components/export/BookSettingsModal.native.tsx
// #2229: окно «Настройки фотоальбома» в приложениях. Тот же публичный контракт и
// те же поля `BookSettings`, что у окна сайта (`BookSettingsModal.tsx`, DOM-разметка);
// логика формы — общий `useBookSettingsForm`. Макет и решения —
// docs/design/book-settings-native.md.
import { useEffect, useState } from 'react'
import { Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import ModalSafeArea from '@/components/ui/ModalSafeArea'
import NativeModalFormShell from '@/components/ui/NativeModalFormShell.native'
import { translate as i18nT, translatePlural } from '@/i18n'

import GalleryLayoutSelector from './GalleryLayoutSelector'
import PresetSelector from './PresetSelector'
import ThemePreview, { type PdfThemeName } from './ThemePreview'
import {
  NativeChecklistFieldset,
  NativeModalFooter,
  RadioList,
  SwitchRow,
  useNativePartStyles,
} from './BookSettingsModal.native.parts'
import type { BookSettings } from './BookSettingsModal.types'
import { useBookSettingsForm } from './useBookSettingsForm'

export type { BookSettings, ChecklistSection } from './BookSettingsModal.types'
export type { PdfThemeName }

interface BookSettingsModalProps {
  visible: boolean
  onClose: () => void
  onSave: (settings: BookSettings) => void
  onPreview?: (settings: BookSettings) => void
  defaultSettings?: Partial<BookSettings>
  travelCount: number
  userName?: string
  mode?: 'save' | 'preview'
}

const sortOptions = (): Array<{ value: BookSettings['sortOrder']; label: string }> => [
  { value: 'manual', label: i18nT('profile:components.export.BookSettingsModal.kak_raspolozheno_v_spiske_vybora_c2ec73ee') },
  { value: 'date-desc', label: i18nT('profile:components.export.BookSettingsModal.snachala_novye_po_godu_71456114') },
  { value: 'date-asc', label: i18nT('profile:components.export.BookSettingsModal.snachala_starye_po_godu_3c9621e6') },
  { value: 'country', label: i18nT('profile:components.export.BookSettingsModal.po_strane_7e37bb82') },
  { value: 'alphabetical', label: i18nT('profile:components.export.BookSettingsModal.po_nazvaniyu_e17e92ac') },
]

const coverOptions = (isPremium: boolean): Array<{ value: BookSettings['coverType']; label: string }> => [
  { value: 'auto', label: i18nT('profile:components.export.BookSettingsModal.avtomaticheskaya_luchshee_foto_b3153151') },
  { value: 'first-photo', label: i18nT('profile:components.export.BookSettingsModal.pervoe_foto_pervogo_puteshestviya_d2effeb3') },
  { value: 'gradient', label: i18nT('profile:components.export.BookSettingsModal.gradient_11017575') },
  { value: 'custom', label: isPremium ? i18nT('profile:components.export.BookSettingsModal.svoe_izobrazhenie_5c69c342') : i18nT('profile:components.export.BookSettingsModal.svoe_izobrazhenie_premium_373d7f86') },
]

export default function BookSettingsModal({
  visible,
  onClose,
  onSave,
  onPreview,
  defaultSettings,
  travelCount,
}: BookSettingsModalProps) {
  const form = useBookSettingsForm({ visible, defaultSettings, onSave, onPreview, onClose })
  const { settings } = form
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [editing, setEditing] = useState(false)
  useEffect(() => { if (!visible) setEditing(false) }, [visible])
  const { colors, styles: partStyles } = useNativePartStyles()
  const styles = createStyles(colors)
  const subtitleLength = settings.subtitle?.length ?? 0

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={onClose}
    >
      <ModalSafeArea edges={Platform.OS === 'ios' ? ['bottom', 'left', 'right'] : undefined} testID="book-settings-native">
        <NativeModalFormShell
          active={visible}
          editing={editing}
          backgroundColor={colors.background}
          contentContainerStyle={styles.content}
          testID="book-settings-form"
          header={(
            <View style={styles.header}>
              <View style={styles.headerTitleRow}>
                <Text style={styles.title} accessibilityRole="header">
                  {i18nT('profile:components.export.BookSettingsModal.nastroyki_fotoalboma_e7ea523f')}
                </Text>
                {form.hasUnsavedChanges ? (
                  <Text style={styles.unsaved} accessibilityLabel={i18nT('profile:components.export.BookSettingsModal.u_vas_est_nesohranennye_izmeneniya_503e03aa')}>
                    {i18nT('profile:components.export.BookSettingsModal.ne_sohraneno_de358955')}
                  </Text>
                ) : null}
              </View>
              <Text style={partStyles.hint}>
                {renderLocalizedText(i18nT('profile:components.export.BookSettingsModal.vybrano_puteshestviy_nbsp_4b4623d9'), { value1: <Text style={styles.count}>{travelCount}</Text> })}</Text>
              <Text style={partStyles.hint}>
                {translatePlural(
                  'profile:components.export.BookSettingsModal.budet_sozdana_kniga_s_value1_puteshestviyami_a78b68c9',
                  travelCount,
                )}
              </Text>
            </View>
          )}
          footer={(
            <>
              {form.validationErrors.length > 0 ? (
                <View style={styles.errors} accessibilityRole="alert" testID="book-settings-errors">
                  <Text style={styles.errorTitle}>{i18nT('profile:components.export.BookSettingsModal.ispravte_oshibki_76b3c61b')}</Text>
                  {form.validationErrors.map((error) => (
                    <Text key={error} style={styles.errorText}>
                      {error}
                    </Text>
                  ))}
                </View>
              ) : null}

              <NativeModalFooter
                isSaving={form.isSaving}
                hasErrors={form.validationErrors.length > 0}
                showPreview={Boolean(onPreview)}
                onClose={onClose}
                onSave={() => void form.save()}
                onPreview={() => void form.preview()}
              />
            </>
          )}
        >
          <RadioList
            label={i18nT('profile:components.export.BookSettingsModal.poryadok_puteshestviy_v_knige_3740cd72')}
            options={sortOptions()}
            value={settings.sortOrder}
            onChange={(sortOrder) => form.updateSettings({ sortOrder })}
            testID="book-settings-sort"
          />

          <PresetSelector onPresetSelect={form.selectPreset} selectedPresetId={form.selectedPresetId} showCategories />

          <ThemePreview selectedTheme={settings.template} onThemeSelect={form.selectTheme} compact={false} />

          {settings.includeGallery ? (
            <GalleryLayoutSelector
              selectedLayout={settings.galleryLayout || 'grid'}
              onLayoutSelect={(galleryLayout) => form.updateGallery({ galleryLayout })}
              columns={settings.galleryColumns}
              onColumnsChange={(galleryColumns) => form.updateSettings({ galleryColumns })}
              photosPerPage={settings.galleryPhotosPerPage}
              onPhotosPerPageChange={(galleryPhotosPerPage) => form.updateSettings({ galleryPhotosPerPage })}
              twoPerPageLayout={settings.galleryTwoPerPageLayout}
              onTwoPerPageLayoutChange={(galleryTwoPerPageLayout) => form.updateSettings({ galleryTwoPerPageLayout })}
              showCaptions={settings.showCaptions}
              onShowCaptionsChange={(showCaptions) => form.updateSettings({ showCaptions })}
              captionPosition={settings.captionPosition}
              onCaptionPositionChange={(captionPosition) => form.updateGallery({ captionPosition })}
              spacing={settings.gallerySpacing}
              onSpacingChange={(gallerySpacing) => form.updateSettings({ gallerySpacing })}
            />
          ) : null}

          <Pressable
            onPress={() => setShowAdvanced((prev) => !prev)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showAdvanced }}
            accessibilityHint={
              showAdvanced
                ? i18nT('profile:components.export.BookSettingsModal.skryt_nastroyki_oblozhki_i_zagolovkov_d3b42861')
                : i18nT('profile:components.export.BookSettingsModal.pokazat_nastroyki_oblozhki_i_zagolovkov_a979398b')
            }
            style={styles.advancedToggle}
            testID="book-settings-advanced"
          >
            <Feather name={showAdvanced ? 'chevron-up' : 'chevron-down'} size={18} color={colors.text} />
            <Text style={styles.advancedText}>
              {showAdvanced ? i18nT('profile:components.export.BookSettingsModal.skryt_detalnye_nastroyki_00de2214') : i18nT('profile:components.export.BookSettingsModal.pokazat_detalnye_nastroyki_6805c889')}
            </Text>
          </Pressable>

          {showAdvanced ? (
            <View style={styles.advanced}>
              <View style={partStyles.block}>
                <Text style={partStyles.label}>
                  {i18nT('profile:components.export.BookSettingsModal.nazvanie_knigi_8e3417de')}
                  <Text style={styles.required}> *</Text>
                </Text>
                <TextInput
                  onFocus={() => setEditing(true)}
                  onBlur={() => setEditing(false)}
                  value={settings.title}
                  onChangeText={(title) => form.updateSettings({ title })}
                  placeholder={i18nT('profile:components.export.BookSettingsModal.moi_puteshestviya_1e06ca97')}
                  placeholderTextColor={colors.textMuted}
                  accessibilityLabel={i18nT('profile:components.export.BookSettingsModal.nazvanie_knigi_8e3417de')}
                  style={styles.input}
                  testID="book-settings-title"
                />
              </View>

              <View style={partStyles.block}>
                <Text style={partStyles.label}>{i18nT('profile:components.export.BookSettingsModal.podzagolovok_optsionalno_de116b87')}</Text>
                <TextInput
                  onFocus={() => setEditing(true)}
                  onBlur={() => setEditing(false)}
                  value={settings.subtitle || ''}
                  onChangeText={(subtitle) => form.updateSettings({ subtitle: subtitle || undefined })}
                  placeholder={i18nT('profile:components.export.BookSettingsModal.vospominaniya_2024_26790f52')}
                  placeholderTextColor={colors.textMuted}
                  accessibilityLabel={i18nT('profile:components.export.BookSettingsModal.podzagolovok_optsionalno_de116b87')}
                  style={[styles.input, form.hasSubtitleError && styles.inputError]}
                  testID="book-settings-subtitle"
                />
                <Text style={[partStyles.hint, form.hasSubtitleError && styles.errorText]}>
                  {subtitleLength}
                  {i18nT('profile:components.export.BookSettingsModal.150_simvolov_629dcb35')}
                </Text>
              </View>

              <RadioList
                label={i18nT('profile:components.export.BookSettingsModal.tip_oblozhki_7559bcbb')}
                options={coverOptions(form.isPremium)}
                value={settings.coverType}
                onChange={form.selectCoverType}
                testID="book-settings-cover"
              />

              <SwitchRow
                title={i18nT('profile:components.export.BookSettingsModal.vklyuchit_oglavlenie_3a5ca805')}
                hint={i18nT('profile:components.export.BookSettingsModal.s_miniatyurami_i_nomerami_stranits_0647b357')}
                value={settings.includeToc}
                onChange={(includeToc) => form.updateSettings({ includeToc })}
              />
            </View>
          ) : null}

          <NativeChecklistFieldset
            settings={settings}
            onToggleChecklists={form.toggleChecklists}
            onToggleSection={form.toggleChecklistSection}
          />
        </NativeModalFormShell>
      </ModalSafeArea>
    </Modal>
  )
}

const createStyles = (colors: ReturnType<typeof useNativePartStyles>['colors']) =>
  StyleSheet.create({
    header: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 12,
      gap: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    title: { fontSize: 20, fontWeight: '700', color: colors.text, flexShrink: 1 },
    unsaved: { fontSize: 12, fontWeight: '600', color: colors.warning },
    count: { fontWeight: '700', color: colors.primary },
    content: { padding: 16, gap: 24 },
    advancedToggle: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.border,
      paddingHorizontal: 16,
    },
    advancedText: { fontSize: 15, fontWeight: '600', color: colors.text },
    advanced: { gap: 20 },
    required: { color: colors.danger },
    input: {
      minHeight: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.surface,
    },
    inputError: { borderColor: colors.danger },
    errors: {
      marginHorizontal: 16,
      marginTop: 8,
      padding: 12,
      borderRadius: 12,
      backgroundColor: colors.dangerSoft,
      gap: 4,
    },
    errorTitle: { fontSize: 14, fontWeight: '700', color: colors.danger },
    errorText: { fontSize: 13, color: colors.danger },
  })
