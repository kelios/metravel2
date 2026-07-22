import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Feather from '@expo/vector-icons/Feather'

import Button from '@/components/ui/Button'
import MultiSelectField from '@/components/forms/MultiSelectField'
import PhotoUploadWithPreview from '@/components/travel/PhotoUploadWithPreview'
import { WIZARD_KEYBOARD_BEHAVIOR } from '@/components/travel/upsert/wizardKeyboard'
import { createPointCategory } from '@/api/misc'
import { isPointCategoryCreateEnabled } from '@/config/featureFlags'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import type { MarkerData } from '@/types/types'
import { translate as i18nT } from '@/i18n'

// Адрес точки на бэке — varchar(100). Режем на входе, а не молча на сохранении.
const MAX_ADDRESS_LENGTH = 100

export interface PointEditorSheetProps {
  visible: boolean
  marker: MarkerData | null
  index: number
  categoryTravelAddress: { id: number | string; name: string }[]
  onSave: (index: number, payload: { address: string; categories: number[]; image: string | null }) => void
  onRemove: (index: number) => void
  onClose: () => void
}

/**
 * #1040 — Полный редактор точки маршрута для native (Android).
 *
 * Раньше редактор точки жил только в web-only `components/map/EditMarkerModal`
 * (react-dom portal), поэтому на телефоне нельзя было задать КАТЕГОРИИ и ФОТО
 * точки — а без категорий бэкенд не пускает маршрут на модерацию. Здесь тот же
 * набор полей на кроссплатформенных примитивах (MultiSelectField →
 * SimpleMultiSelect, PhotoUploadWithPreview с веткой expo-image-picker).
 * Переиспользует i18n-ключи существующего web-редактора.
 */
export const PointEditorSheet = React.memo(function PointEditorSheet({
  visible,
  marker,
  index,
  categoryTravelAddress,
  onSave,
  onRemove,
  onClose,
}: PointEditorSheetProps) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  const [address, setAddress] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [image, setImage] = useState<string>('')
  const [extraCategories, setExtraCategories] = useState<{ id: string; name: string }[]>([])
  const [confirmingRemove, setConfirmingRemove] = useState(false)

  // Синхронизация с открытой точкой (в т.ч. при переключении между точками).
  useEffect(() => {
    if (!visible || !marker) return
    setAddress(marker.address || '')
    setCategories(Array.isArray(marker.categories) ? marker.categories.map((c) => String(c)) : [])
    setImage(marker.image || '')
    setExtraCategories([])
    setConfirmingRemove(false)
  }, [visible, marker, index])

  const categoryItems = useMemo(() => {
    const base = (categoryTravelAddress || []).map((cat) => ({ ...cat, id: String(cat.id) }))
    const seen = new Set(base.map((c) => c.id))
    return [...base, ...extraCategories.filter((c) => !seen.has(c.id))]
  }, [categoryTravelAddress, extraCategories])

  const handleCreateCategory = useCallback(async (name: string): Promise<string> => {
    const created = await createPointCategory(name)
    const idStr = String(created.id)
    setExtraCategories((prev) => (prev.some((c) => c.id === idStr) ? prev : [...prev, { id: idStr, name: created.name }]))
    return idStr
  }, [])

  const handleSave = useCallback(() => {
    onSave(index, {
      address: address.trim().slice(0, MAX_ADDRESS_LENGTH),
      categories: categories.map((c) => Number(c)).filter((n) => Number.isFinite(n)),
      image: image || null,
    })
    onClose()
  }, [address, categories, image, index, onClose, onSave])

  if (!visible || !marker) return null

  const coordsLabel = `${Number(marker.lat).toFixed(5)}, ${Number(marker.lng).toFixed(5)}`

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        <KeyboardAvoidingView style={styles.flex} behavior={WIZARD_KEYBOARD_BEHAVIOR}>
          <View style={styles.header}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {i18nT('map:components.map.EditMarkerModal.tochka_35020a41')}
              {index + 1}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel={i18nT('map:components.map.EditMarkerModal.otmena_0a02aca0')}
              testID="travel-wizard.point-editor.close"
            >
              <Feather name="x" size={20} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.helper}>
              {i18nT('map:components.map.EditMarkerModal.opishite_mesto_tak_chtoby_vy_sami_cherez_god_1d45d9bf')}
            </Text>

            <View style={styles.coordsRow}>
              <Feather name="map-pin" size={14} color={colors.textMuted} />
              <Text style={styles.coordsText}>{coordsLabel}</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>
                {i18nT('map:components.map.EditMarkerModal.adres_tochki_cfb17459')}
              </Text>
              <TextInput
                value={address}
                onChangeText={(value) => setAddress(value.slice(0, MAX_ADDRESS_LENGTH))}
                maxLength={MAX_ADDRESS_LENGTH}
                style={styles.input}
                placeholder={i18nT('map:components.map.EditMarkerModal.naprimer_parkovka_u_ozera_sucha_b5fd5cc9')}
                placeholderTextColor={colors.textMuted}
                testID="travel-wizard.point-editor.address"
              />
              <Text style={styles.hint}>
                {i18nT('map:components.map.EditMarkerModal.mozhno_ostavit_adres_iz_karty_ili_sokratit_d_67e7e4c3')}
                {address.length}/{MAX_ADDRESS_LENGTH})
              </Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>
                {i18nT('map:components.map.EditMarkerModal.kategorii_tochki_cb4d4962')}
              </Text>
              <MultiSelectField
                items={categoryItems}
                value={categories}
                onChange={(selected) =>
                  setCategories(Array.isArray(selected) ? selected.map((s) => String(s)) : [])
                }
                labelField="name"
                valueField="id"
                allowCreate={isPointCategoryCreateEnabled()}
                onCreateItem={handleCreateCategory}
                createLabel={i18nT('map:components.map.EditMarkerModal.dobavit_kategoriyu_bb7b37c2')}
                placeholder={i18nT('map:components.map.EditMarkerModal.vyberite_de6e6bdc')}
                testID="travel-wizard.point-editor.categories"
              />
              <Text style={styles.hint}>
                {i18nT('map:components.map.EditMarkerModal.vyberite_kategorii_kotorye_opisyvayut_etu_to_ec75aa9d')}
              </Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>
                {i18nT('map:components.map.EditMarkerModal.izobrazhenie_tochki_d9618978')}
              </Text>
              {marker.id != null ? (
                <>
                  <PhotoUploadWithPreview
                    collection="travelImageAddress"
                    idTravel={String(marker.id)}
                    oldImage={image}
                    onUpload={setImage}
                    placeholder={i18nT('map:components.map.EditMarkerModal.peretaschite_foto_tochki_marshruta_3a234cc4')}
                    maxSizeMB={10}
                  />
                  <Text style={styles.hint}>
                    {i18nT('map:components.map.EditMarkerModal.foto_pomozhet_puteshestvennikam_uznat_mesto__e45440f7')}
                  </Text>
                </>
              ) : (
                <Text style={styles.hint}>
                  {i18nT('map:components.map.EditMarkerModal.snachala_sohranite_marshrut_zatem_otkroyte_t_4fff3196')}
                </Text>
              )}
            </View>

            <View style={styles.removeBlock}>
              {confirmingRemove ? (
                <View style={styles.removeConfirm}>
                  <Text style={styles.removeConfirmText}>
                    {i18nT('map:components.map.EditMarkerModal.udalit_tochku_value1_iz_marshruta_eto_deystv_229ad7bd', {
                      value1: address || marker.address || i18nT('map:components.map.EditMarkerModal.etu_tochku_054e1134'),
                    })}
                  </Text>
                  <View style={styles.removeConfirmActions}>
                    <Button
                      variant="ghost"
                      label={i18nT('map:components.map.EditMarkerModal.otmena_0a02aca0')}
                      onPress={() => setConfirmingRemove(false)}
                      fullWidth
                    />
                    <Button
                      variant="danger"
                      label={i18nT('map:components.map.EditMarkerModal.udalit_tochku_b058b974')}
                      onPress={() => {
                        onRemove(index)
                        onClose()
                      }}
                      fullWidth
                      testID="travel-wizard.point-editor.remove-confirm"
                    />
                  </View>
                </View>
              ) : (
                <Button
                  variant="danger-outline"
                  label={i18nT('map:components.map.EditMarkerModal.udalit_tochku_b058b974')}
                  icon={<Feather name="trash-2" size={16} color={colors.danger} />}
                  onPress={() => setConfirmingRemove(true)}
                  fullWidth
                  testID="travel-wizard.point-editor.remove"
                />
              )}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Button
              variant="primary"
              label={i18nT('map:components.map.EditMarkerModal.sohranit_4853bb8f')}
              onPress={handleSave}
              fullWidth
              testID="travel-wizard.point-editor.save"
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  )
})

export default PointEditorSheet

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      paddingVertical: DESIGN_TOKENS.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      flex: 1,
      fontSize: DESIGN_TOKENS.typography.sizes.lg,
      fontWeight: '700',
      color: colors.text,
    },
    closeButton: {
      minWidth: DESIGN_TOKENS.touchTarget.minHeight,
      minHeight: DESIGN_TOKENS.touchTarget.minHeight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      padding: DESIGN_TOKENS.spacing.md,
      gap: DESIGN_TOKENS.spacing.lg,
      paddingBottom: DESIGN_TOKENS.spacing.xxl,
    },
    helper: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.textMuted,
      lineHeight: 20,
    },
    coordsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
    },
    coordsText: {
      flex: 1,
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.textMuted,
    },
    field: { gap: DESIGN_TOKENS.spacing.xs },
    label: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '600',
      color: colors.text,
    },
    input: {
      minHeight: DESIGN_TOKENS.touchTarget.minHeight,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: DESIGN_TOKENS.radii.md,
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      paddingVertical: DESIGN_TOKENS.spacing.sm,
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      color: colors.text,
      backgroundColor: colors.surface,
    },
    hint: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.textMuted,
      lineHeight: 16,
    },
    removeBlock: { marginTop: DESIGN_TOKENS.spacing.md },
    removeConfirm: {
      gap: DESIGN_TOKENS.spacing.sm,
      padding: DESIGN_TOKENS.spacing.md,
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 1,
      borderColor: colors.danger,
    },
    removeConfirmText: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.text,
      lineHeight: 20,
    },
    removeConfirmActions: { gap: DESIGN_TOKENS.spacing.sm },
    footer: {
      padding: DESIGN_TOKENS.spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
  })
