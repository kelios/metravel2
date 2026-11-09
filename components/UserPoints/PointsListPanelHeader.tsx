import React from 'react'
import { TextInput, View, Text as RNText } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import IconButton from '@/components/ui/IconButton'
import { translate as i18nT } from '@/i18n'
import { searchInputAccessibilityProps } from '@/utils/webProps'

import type { createLocalStyles } from './PointsListGrid.styles'

type LocalStyles = ReturnType<typeof createLocalStyles>

type Props = {
  localStyles: LocalStyles
  themedColors: { text: string; textMuted: string; textOnPrimary: string }
  searchQuery: string
  onSearch: (text: string) => void
  onOpenActions?: () => void
  hasFilters: boolean
  onResetFilters: () => void
  showingRecommendations: boolean
  onRefreshRecommendations: () => void
  onCloseRecommendations: () => void
  currentLocation: { lat?: number | null; lng?: number | null } | null
  isLocating: boolean
  onLocateMe: () => void
}

/**
 * Шапка списка в панели «Моих точек»: поиск, «Управление точками», сброс
 * фильтров, строка рекомендаций (#3135: вынесена из `PointsListGrid`).
 * Рисуется элементом в `ListHeaderComponent`, а не функцией: FlashList делает
 * `createElement(функция)`, и новая identity колбэка ремаунтила бы поле поиска
 * на каждом символе (#3133).
 */
export const PointsListPanelHeader: React.FC<Props> = ({
  localStyles,
  themedColors,
  searchQuery,
  onSearch,
  onOpenActions,
  hasFilters,
  onResetFilters,
  showingRecommendations,
  onRefreshRecommendations,
  onCloseRecommendations,
  currentLocation,
  isLocating,
  onLocateMe,
}) => (
  <>
    <View style={localStyles.listControlsRow}>
      <TextInput
        {...searchInputAccessibilityProps()}
        style={localStyles.listSearchInput}
        value={searchQuery}
        onChangeText={onSearch}
        placeholder={i18nT('map:components.UserPoints.PointsListGrid.poisk_po_nazvaniyu_adresu_opisaniyu_i_kategorii_bd6ebf74')}
        placeholderTextColor={themedColors.textMuted}
        accessibilityLabel={i18nT('map:components.UserPoints.PointsListGrid.poisk_po_nazvaniyu_adresu_opisaniyu_i_kategorii_bd6ebf74')}
        testID="userpoints-list-search"
      />

      <View style={localStyles.listControlsActions}>
        {/*
          #3134: над списком — только то, чего нет во вкладке «Фильтры»
          одним нажатием: «Управление точками» с подписью на любой ширине
          (иконка-шестерёнка не «говорящая», #1414) и «Сбросить фильтры»
          только когда фильтры активны. Вход в фильтры один: вкладка панели.
        */}
        {onOpenActions ? (
          <IconButton
            icon={<Feather name="settings" size={16} color={themedColors.text} />}
            label={i18nT('map:components.UserPoints.PointsListGrid.upravlenie_tochkami_fcf804c2')}
            onPress={onOpenActions}
            size="sm"
            testID="userpoints-actions-open"
            showLabel
          />
        ) : null}

        {hasFilters ? (
          <IconButton
            icon={<Feather name="rotate-ccw" size={16} color={themedColors.text} />}
            label={i18nT('map:components.UserPoints.PointsListGrid.sbrosit_filtry_811750be')}
            onPress={onResetFilters}
            size="sm"
            testID="userpoints-list-reset-filters"
            showLabel
          />
        ) : null}
      </View>
    </View>

    {showingRecommendations ? (
      <View style={localStyles.recommendationsHeader}>
        <RNText style={localStyles.recommendationsTitle}>{i18nT('map:components.UserPoints.PointsListGrid.3_sluchaynye_tochki_iz_vashih_24a90489')}</RNText>
        <View style={localStyles.recommendationsActions}>
          <IconButton
            icon={<Feather name="refresh-cw" size={16} color={themedColors.text} />}
            label={i18nT('map:components.UserPoints.PointsListGrid.obnovit_335ad256')}
            onPress={onRefreshRecommendations}
            size="sm"
            showLabel
          />
          <IconButton
            icon={<Feather name="x" size={16} color={themedColors.textOnPrimary} />}
            label={i18nT('map:components.UserPoints.PointsListGrid.vse_tochki_2d6d6b49')}
            onPress={onCloseRecommendations}
            size="sm"
            active
            showLabel
          />
        </View>
      </View>
    ) : null}
    {/* PERM-3: геолокации нет — маршрутов к точкам тоже; просим её по кнопке, а не при загрузке. */}
    {showingRecommendations && !currentLocation ? (
      <View style={localStyles.recommendationsLocationRow} testID="userpoints-recommendations-need-location">
        <RNText style={localStyles.recommendationsLocationHint}>
          {i18nT('map:components.UserPoints.PointsListGrid.recommendationsNeedLocation')}
        </RNText>
        <IconButton
          icon={<Feather name="crosshair" size={16} color={themedColors.text} />}
          label={i18nT('map:components.UserPoints.PointsListGrid.recommendationsLocateCta')}
          onPress={onLocateMe}
          disabled={isLocating}
          size="sm"
          showLabel
          testID="userpoints-recommendations-locate"
        />
      </View>
    ) : null}
  </>
)
