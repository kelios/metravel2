import React from 'react'
import { Platform, Text, TextInput, View } from 'react-native'

import { Button } from '@/ui/paper'
import { EXIF_IMAGE_INPUT_ACCEPT } from '@/utils/exifGps'

import type { ManualPointPanelProps } from './types'

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
          accessibilityLabel="Добавить точку вручную"
        >
          Добавить точку вручную
        </Button>
      </View>

      {isVisible && (
        <View
          ref={panelRef}
          style={styles.manualPointCard}
          nativeID="travelwizard-route-manual-panel"
          testID="travel-wizard.step-route.manual.panel"
          accessibilityLabel="Панель добавления точки вручную"
        >
          {Platform.OS === 'web' && (
            <View style={styles.manualPhotoRow}>
              <Button
                mode="outlined"
                onPress={onPhotoPick}
                compact
                testID="travel-wizard.step-route.manual.photo.pick"
                accessibilityLabel="Определить координаты из фото"
              >
                Координаты из фото
              </Button>
              {state.photoPreviewUrl ? (
                <Button
                  mode="text"
                  onPress={onClearPhoto}
                  compact
                  testID="travel-wizard.step-route.manual.photo.clear"
                  accessibilityLabel="Убрать фото"
                >
                  Убрать фото
                </Button>
              ) : null}
              <input
                ref={fileInputRef}
                type="file"
                accept={EXIF_IMAGE_INPUT_ACCEPT}
                onChange={onPhotoSelected}
                style={styles.manualHiddenInput as any}
              />
              <Text style={styles.manualPhotoHint}>
                Фото прикрепится к точке и загрузится после автосохранения.
              </Text>
            </View>
          )}

          <View style={styles.manualCoordsWrapper}>
            <Text style={styles.manualPointLabel}>Координаты (lat, lng)</Text>
            <TextInput
              ref={coordsInputRef}
              value={state.coords}
              onChangeText={onCoordsChange}
              placeholder="49.609645, 18.845693"
              style={styles.manualPointInput}
              inputMode="text"
              testID="travel-wizard.step-route.manual.coords"
              accessibilityLabel="Координаты точки: широта, долгота"
            />
          </View>

          <View style={styles.manualPointInputsRow}>
            <View style={styles.manualPointInputWrapper}>
              <Text style={styles.manualPointLabel}>Широта</Text>
              <TextInput
                value={state.lat}
                onChangeText={onLatChange}
                placeholder="например 53.90"
                style={styles.manualPointInput}
                inputMode="decimal"
                testID="travel-wizard.step-route.manual.lat"
                accessibilityLabel="Широта"
              />
            </View>
            <View style={styles.manualPointInputWrapper}>
              <Text style={styles.manualPointLabel}>Долгота</Text>
              <TextInput
                value={state.lng}
                onChangeText={onLngChange}
                placeholder="например 27.56"
                style={styles.manualPointInput}
                inputMode="decimal"
                testID="travel-wizard.step-route.manual.lng"
                accessibilityLabel="Долгота"
              />
            </View>
          </View>

          <View style={styles.manualPointActionsRow}>
            <Button
              mode="contained"
              onPress={onAdd}
              compact
              testID="travel-wizard.step-route.manual.add"
              accessibilityLabel="Добавить точку"
            >
              Добавить
            </Button>
            <Button
              mode="text"
              onPress={onCancel}
              compact
              testID="travel-wizard.step-route.manual.cancel"
              accessibilityLabel="Отмена"
            >
              Отмена
            </Button>
          </View>
        </View>
      )}
    </>
  )
})
