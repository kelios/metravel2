import React from 'react'
import { Platform, Pressable, Text, TextInput, View } from 'react-native'

import { Button } from '@/ui/paper'
import { EXIF_IMAGE_INPUT_ACCEPT } from '@/utils/exifGps'

import type { ManualPointPanelProps } from './types'
import { translate as i18nT } from '@/i18n'


export const ManualPointPanel = React.memo(function ManualPointPanel({
  isVisible,
  state,
  styles,
  fileInputRef,
  panelRef,
  coordsInputRef,
  onToggle,
  onPhotoPick,
  onPhotoSelected,
  onClearPhoto,
  onCoordsChange,
  onLatChange,
  onLngChange,
  onLatSignToggle,
  onLngSignToggle,
  onAdd,
  onCancel,
}: ManualPointPanelProps) {
  return (
    <>
      <View style={styles.manualPointRow}>
        <Button
          mode={isVisible ? 'contained' : 'outlined'}
          onPress={onToggle}
          compact
          testID="travel-wizard.step-route.manual.toggle"
          accessibilityLabel={i18nT('travel:components.travel.stepRoute.ManualPointPanel.dobavit_tochku_vruchnuyu_40e63392')}
        >
          {i18nT('travel:components.travel.stepRoute.ManualPointPanel.dobavit_tochku_vruchnuyu_40e63392')}</Button>
      </View>

      {isVisible && (
        <View
          ref={panelRef}
          style={styles.manualPointCard}
          nativeID="travelwizard-route-manual-panel"
          testID="travel-wizard.step-route.manual.panel"
          accessibilityLabel={i18nT('travel:components.travel.stepRoute.ManualPointPanel.panel_dobavleniya_tochki_vruchnuyu_b2c32b4c')}
        >
          {Platform.OS === 'web' && (
            <View style={styles.manualPhotoRow}>
              <Button
                mode="outlined"
                onPress={onPhotoPick}
                compact
                testID="travel-wizard.step-route.manual.photo.pick"
                accessibilityLabel={i18nT('travel:components.travel.stepRoute.ManualPointPanel.opredelit_koordinaty_iz_foto_d6734c3c')}
              >
                {i18nT('travel:components.travel.stepRoute.ManualPointPanel.koordinaty_iz_foto_a6c45365')}</Button>
              {state.photoPreviewUrl ? (
                <Button
                  mode="text"
                  onPress={onClearPhoto}
                  compact
                  testID="travel-wizard.step-route.manual.photo.clear"
                  accessibilityLabel={i18nT('travel:components.travel.stepRoute.ManualPointPanel.ubrat_foto_6dea5d6d')}
                >
                  {i18nT('travel:components.travel.stepRoute.ManualPointPanel.ubrat_foto_6dea5d6d')}</Button>
              ) : null}
              <input
                ref={fileInputRef}
                type="file"
                accept={EXIF_IMAGE_INPUT_ACCEPT}
                onChange={onPhotoSelected}
                style={styles.manualHiddenInput as any}
              />
              <Text style={styles.manualPhotoHint}>
                {i18nT('travel:components.travel.stepRoute.ManualPointPanel.foto_prikrepitsya_k_tochke_i_zagruzitsya_pos_1ebc5d67')}</Text>
            </View>
          )}

          <View style={styles.manualCoordsWrapper}>
            <Text style={styles.manualPointLabel}>{i18nT('travel:components.travel.stepRoute.ManualPointPanel.koordinaty_lat_lng_0d968244')}</Text>
            <TextInput
              ref={coordsInputRef}
              value={state.coords}
              onChangeText={onCoordsChange}
              placeholder="49.609645, 18.845693"
              style={styles.manualPointInput}
              inputMode="text"
              testID="travel-wizard.step-route.manual.coords"
              accessibilityLabel={i18nT('travel:components.travel.stepRoute.ManualPointPanel.koordinaty_tochki_shirota_dolgota_f56c6427')}
            />
          </View>

          <View style={styles.manualPointInputsRow}>
            <View style={styles.manualPointInputWrapper}>
              <Text style={styles.manualPointLabel}>{i18nT('travel:components.travel.stepRoute.ManualPointPanel.shirota_8b33238d')}</Text>
              <View style={styles.manualPointInputWithSignRow}>
                <TextInput
                  value={state.lat}
                  onChangeText={onLatChange}
                  placeholder={i18nT('travel:components.travel.stepRoute.ManualPointPanel.naprimer_53_90_0a8513b6')}
                  style={[styles.manualPointInput, styles.manualPointInputFlex]}
                  inputMode="decimal"
                  testID="travel-wizard.step-route.manual.lat"
                  accessibilityLabel={i18nT('travel:components.travel.stepRoute.ManualPointPanel.shirota_8b33238d')}
                />
                <Pressable
                  onPress={onLatSignToggle}
                  style={styles.manualSignButton}
                  testID="travel-wizard.step-route.manual.lat.sign"
                  accessibilityRole="button"
                  accessibilityLabel={i18nT('travel:components.travel.stepRoute.ManualPointPanel.smenit_znak_shiroty_c1a1e2f0')}
                >
                  <Text style={styles.manualSignButtonLabel}>±</Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.manualPointInputWrapper}>
              <Text style={styles.manualPointLabel}>{i18nT('travel:components.travel.stepRoute.ManualPointPanel.dolgota_910791d5')}</Text>
              <View style={styles.manualPointInputWithSignRow}>
                <TextInput
                  value={state.lng}
                  onChangeText={onLngChange}
                  placeholder={i18nT('travel:components.travel.stepRoute.ManualPointPanel.naprimer_27_56_ad119976')}
                  style={[styles.manualPointInput, styles.manualPointInputFlex]}
                  inputMode="decimal"
                  testID="travel-wizard.step-route.manual.lng"
                  accessibilityLabel={i18nT('travel:components.travel.stepRoute.ManualPointPanel.dolgota_910791d5')}
                />
                <Pressable
                  onPress={onLngSignToggle}
                  style={styles.manualSignButton}
                  testID="travel-wizard.step-route.manual.lng.sign"
                  accessibilityRole="button"
                  accessibilityLabel={i18nT('travel:components.travel.stepRoute.ManualPointPanel.smenit_znak_dolgoty_d2b2f3a1')}
                >
                  <Text style={styles.manualSignButtonLabel}>±</Text>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.manualPointActionsRow}>
            <Button
              mode="contained"
              onPress={onAdd}
              compact
              testID="travel-wizard.step-route.manual.add"
              accessibilityLabel={i18nT('travel:components.travel.stepRoute.ManualPointPanel.dobavit_tochku_9c2004af')}
            >
              {i18nT('travel:components.travel.stepRoute.ManualPointPanel.dobavit_307674c7')}</Button>
            <Button
              mode="text"
              onPress={onCancel}
              compact
              testID="travel-wizard.step-route.manual.cancel"
              accessibilityLabel={i18nT('travel:components.travel.stepRoute.ManualPointPanel.otmena_b2a62e12')}
            >
              {i18nT('travel:components.travel.stepRoute.ManualPointPanel.otmena_b2a62e12')}</Button>
          </View>
        </View>
      )}
    </>
  )
})
