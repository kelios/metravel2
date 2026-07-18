import React, { useCallback, useState } from 'react'
import { Alert, Pressable, Text, TextInput, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { useThemedColors } from '@/hooks/useTheme'
import type { MarkerData } from '@/types/types'
import { translate as i18nT } from '@/i18n'

type NativePointListProps = {
  markers: MarkerData[]
  // Персистящий колбэк (updateMarkers + saveRoute) — правки сохраняются сразу,
  // как на web: удаление/переупорядочивание/переименование точки не теряются при
  // перезагрузке до автосейва.
  onChange: (markers: MarkerData[]) => void
}

const HIT = { top: 6, bottom: 6, left: 6, right: 6 }

// Управление точками маршрута на native (Android): web-карта с редактируемым списком
// доступна только в браузере, поэтому в приложении показываем компактный список
// добавленных точек с просмотром координат, переименованием, изменением порядка и
// удалением. Иначе точки добавляются «вслепую» без возможности их поправить.
export const NativePointList = React.memo(function NativePointList({
  markers,
  onChange,
}: NativePointListProps) {
  const colors = useThemedColors()
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [draftAddress, setDraftAddress] = useState('')

  const move = useCallback(
    (index: number, dir: -1 | 1) => {
      const target = index + dir
      if (target < 0 || target >= markers.length) return
      const next = markers.slice()
      const tmp = next[index]
      next[index] = next[target]
      next[target] = tmp
      onChange(next)
    },
    [markers, onChange],
  )

  const remove = useCallback(
    (index: number) => {
      Alert.alert(
        i18nT('travel:components.travel.stepRoute.NativePointList.removeTitle'),
        i18nT('travel:components.travel.stepRoute.NativePointList.removeMessage'),
        [
          { text: i18nT('travel:components.travel.stepRoute.NativePointList.cancel'), style: 'cancel' },
          {
            text: i18nT('travel:components.travel.stepRoute.NativePointList.delete'),
            style: 'destructive',
            onPress: () => onChange(markers.filter((_, i) => i !== index)),
          },
        ],
        { cancelable: true },
      )
    },
    [markers, onChange],
  )

  const startEdit = useCallback(
    (index: number) => {
      setEditingIndex(index)
      setDraftAddress(markers[index]?.address ?? '')
    },
    [markers],
  )

  const commitEdit = useCallback(
    (index: number) => {
      setEditingIndex(null)
      const value = draftAddress.trim()
      if ((markers[index]?.address ?? '') === value) return
      const next = markers.map((m, i) => (i === index ? { ...m, address: value } : m))
      onChange(next)
    },
    [draftAddress, markers, onChange],
  )

  if (!markers.length) return null

  const iconBtn = (
    name: React.ComponentProps<typeof Feather>['name'],
    label: string,
    onPress: () => void,
    disabled = false,
    danger = false,
  ) => (
    <Pressable
      onPress={disabled ? undefined : onPress}
      hitSlop={HIT}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => ({
        minWidth: 44,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: danger ? colors.danger : colors.border,
        backgroundColor: colors.surface,
        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
      })}
    >
      <Feather name={name} size={18} color={danger ? colors.danger : colors.text} />
    </Pressable>
  )

  return (
    <View style={{ marginTop: 12, gap: 8 }} testID="travel-wizard.step-route.native-point-list">
      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
        {i18nT('travel:components.travel.stepRoute.NativePointList.title')} · {markers.length}
      </Text>

      {markers.map((m, index) => (
        <View
          key={m.id ?? `pt-${index}`}
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            padding: 10,
            gap: 8,
            backgroundColor: colors.surface,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: colors.textOnPrimary, fontSize: 12, fontWeight: '700' }}>{index + 1}</Text>
            </View>

            {editingIndex === index ? (
              <TextInput
                value={draftAddress}
                onChangeText={setDraftAddress}
                onBlur={() => commitEdit(index)}
                onSubmitEditing={() => commitEdit(index)}
                autoFocus
                placeholder={i18nT('travel:components.travel.stepRoute.NativePointList.editAddressPlaceholder')}
                placeholderTextColor={colors.textMuted}
                style={{
                  flex: 1,
                  minHeight: 40,
                  color: colors.text,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.primary,
                  paddingVertical: 4,
                }}
                accessibilityLabel={i18nT('travel:components.travel.stepRoute.NativePointList.editAddressPlaceholder')}
              />
            ) : (
              <Text style={{ flex: 1, color: colors.text, fontSize: 14 }} numberOfLines={2}>
                {m.address?.trim() ||
                  `${i18nT('travel:components.travel.stepRoute.NativePointList.pointFallback')} ${index + 1}`}
              </Text>
            )}
          </View>

          <Text style={{ color: colors.textMuted, fontSize: 12 }}>
            {Number(m.lat).toFixed(5)}, {Number(m.lng).toFixed(5)}
          </Text>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            {iconBtn(
              'arrow-up',
              i18nT('travel:components.travel.stepRoute.NativePointList.moveUp'),
              () => move(index, -1),
              index === 0,
            )}
            {iconBtn(
              'arrow-down',
              i18nT('travel:components.travel.stepRoute.NativePointList.moveDown'),
              () => move(index, 1),
              index === markers.length - 1,
            )}
            {iconBtn(
              'edit-2',
              i18nT('travel:components.travel.stepRoute.NativePointList.edit'),
              () => startEdit(index),
            )}
            <View style={{ flex: 1 }} />
            {iconBtn(
              'trash-2',
              i18nT('travel:components.travel.stepRoute.NativePointList.delete'),
              () => remove(index),
              false,
              true,
            )}
          </View>
        </View>
      ))}
    </View>
  )
})
