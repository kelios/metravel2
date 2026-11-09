import { searchInputAccessibilityProps } from '@/utils/webProps'
import React from 'react'
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { PointFilters } from '@/components/UserPoints/PointFilters'
import Button from '@/components/ui/Button'
import Chip from '@/components/ui/Chip'
import { useScreenHeader } from '@/components/layout/ScreenHeaderContext'
import IconButton from '@/components/ui/IconButton'
import SegmentedControl from '@/components/MapPage/SegmentedControl'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import type { PointFilters as PointFiltersType } from '@/types/userPoints'

import type { PointsListStyles } from './types'
import { translate as i18nT } from '@/i18n'
import { formatInteger } from '@/i18n/format'


type ViewMode = 'list' | 'map'

type ActiveFilterChip = {
  key: string
  label: string
}

/**
 * Содержимое вкладки «Фильтры» панели «Мои точки» (#3134, макет —
 * `docs/design/userpoints-panel.md`). Раньше вкладка называлась «Фильтры
 * карты», но самих фильтров не содержала: промо «Случайный выбор», второй
 * переключатель Карта/Список, второе поле поиска и кнопка «Показать фильтры»,
 * которая только разворачивала их ниже (повтор #489). Теперь:
 * счётчики → действия экрана → активные фильтры → сами фильтры, всегда
 * развёрнутые. Поле поиска здесь показывается только в отдельном режиме
 * списка на широком web (`showSearch`), где нет шапки списка со своим полем.
 */
type PointsListHeaderProps = {
  styles: PointsListStyles
  colors: {
    text: string
    textMuted: string
    textOnPrimary: string
  }
  isMobile: boolean
  total: number
  found: number

  hasActiveFilters: boolean
  onResetFilters: () => void

  activeFilterChips: ActiveFilterChip[]
  onRemoveFilterChip: (key: string) => void

  /** Режим раскладки широкого web: карта с панелью или список во всю ширину. */
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  hideViewToggle?: boolean

  canShowMapSettings: boolean
  showMapSettings: boolean
  onToggleMapSettings: () => void
  showingRecommendations: boolean

  onOpenActions: () => void
  onOpenRecommendations: () => void

  /** Поле поиска внутри шапки — только там, где нет шапки списка со своим полем. */
  showSearch?: boolean
  searchQuery?: string
  onSearch?: (text: string) => void

  filters: PointFiltersType
  onFilterChange: (newFilters: PointFiltersType) => void

  presets?: Array<{ id: string; label: string }>
  activePresetId?: string | null
  onPresetChange?: (presetId: string | null) => void

  siteCategoryOptions: Array<{ id: string; name: string }>
  availableColors?: string[]
}

/** Сколько точек нужно для «Случайного выбора». */
const RECOMMENDATION_MIN_POINTS = 3

export const PointsListHeader: React.FC<PointsListHeaderProps> = ({
  styles,
  colors,
  isMobile,
  total,
  found,
  hasActiveFilters,
  onResetFilters,
  activeFilterChips,
  onRemoveFilterChip,
  viewMode,
  onViewModeChange,
  hideViewToggle,
  canShowMapSettings,
  showMapSettings,
  onToggleMapSettings,
  showingRecommendations,
  onOpenActions,
  onOpenRecommendations,
  showSearch = false,
  searchQuery = '',
  onSearch,
  filters,
  onFilterChange,
  presets,
  activePresetId,
  onPresetChange,
  siteCategoryOptions,
  availableColors,
}) => {
  const themed = useThemedColors();
  const local = React.useMemo(() => createLocalStyles(themed), [themed]);
  useScreenHeader({
    title: i18nT('map:components.MapPage.Map.PlacePopupCard.index.moi_tochki_9e5ac9a2'),
    info: [
      i18nT('map:components.UserPoints.PointsListHeader.upravlyayte_sohranennymi_mestami_56ebb898'),
      i18nT('map:components.UserPoints.PointsListHeader.filtruyte_tochki_nastraivayte_kartu_ili_nazh_d60229ee'),
    ],
  });
  const canRecommend = total >= RECOMMENDATION_MIN_POINTS;
  const recommendationLabel = showingRecommendations
    ? i18nT('map:components.UserPoints.PointsListHeader.vybrat_drugie_sluchaynye_77185bc2')
    : i18nT('map:components.UserPoints.PointsListHeader.vybrat_3_sluchaynye_tochki_4ddd9506');
  // Одна строка подсказки вместо промо-блока с заголовком и абзацем (#3134).
  const recommendationHint = !canRecommend
    ? i18nT('map:components.UserPoints.PointsListHeader.sohranite_hotya_by_3_tochki_i_knopka_sluchay_73f1dd95')
    : showingRecommendations
      ? i18nT('map:components.UserPoints.PointsListHeader.pokazany_3_sluchaynye_tochki_iz_vashih_sohra_2b2a3228')
      : i18nT('map:components.UserPoints.PointsListHeader.ne_reshili_kuda_poehat_sluchayno_vyberem_3_t_a7b29b4f');
  // Переключатель раскладки широкого web. Подписи называют раскладку, а не
  // «Карта/Список»: иначе он читался как дубль вкладок панели и мобильного
  // таб-бара (#3134).
  const viewModeOptions = React.useMemo(
    () => [
      { key: 'map', label: i18nT('map:components.UserPoints.PointsListHeader.s_kartoy_11e00dcb'), icon: 'map' },
      { key: 'list', label: i18nT('map:components.UserPoints.PointsListHeader.tolko_spisok_432a899d'), icon: 'list' },
    ],
    [],
  );

  return (
    <View style={styles.header}>
      <View style={local.summaryCard}>
        <View style={local.statsGrid}>
          <View style={[styles.statPill, local.statCard]}>
            <Text style={styles.statPillLabel}>{i18nT('map:components.UserPoints.PointsListHeader.vsego_f6d5c240')}</Text>
            <Text style={[styles.statPillValue, local.statValue]}>{formatInteger(total || 0)}</Text>
          </View>
          <View style={[styles.statPill, local.statCard]}>
            <Text style={styles.statPillLabel}>{i18nT('map:components.UserPoints.PointsListHeader.naydeno_3670717b')}</Text>
            <Text style={[styles.statPillValue, local.statValue]}>{formatInteger(found || 0)}</Text>
          </View>
        </View>

        {!hideViewToggle ? (
          <View style={local.viewModeControl}>
            <SegmentedControl
              options={viewModeOptions}
              value={viewMode}
              onChange={(key) => onViewModeChange(key as ViewMode)}
              accessibilityLabel={i18nT('map:components.UserPoints.PointsListHeader.rezhim_otobrazheniya_tochek_3cfbac2e')}
              compact
            />
          </View>
        ) : null}

        {/*
          Действия экрана — один ряд подписанных кнопок во всю ширину на любой
          платформе (#1414: подпись обязательна, иконки здесь не «говорящие»).
        */}
        <View style={local.actionsGrid}>
          <IconButton
            icon={<Feather name="shuffle" size={18} color={colors.text} />}
            label={recommendationLabel}
            onPress={onOpenRecommendations}
            disabled={!canRecommend}
            active={showingRecommendations}
            size="sm"
            testID="userpoints-recommendations-open"
            showLabel
            style={local.actionButton}
          />
          <Text style={local.actionHint}>{recommendationHint}</Text>

          <IconButton
            icon={<Feather name="settings" size={18} color={colors.text} />}
            label={i18nT('map:components.UserPoints.PointsListHeader.upravlenie_tochkami_f2146a1d')}
            onPress={onOpenActions}
            size="sm"
            testID="userpoints-actions-open"
            showLabel
            style={local.actionButton}
          />

          {canShowMapSettings ? (
            <IconButton
              icon={<Feather name="sliders" size={18} color={colors.text} />}
              label={showMapSettings ? i18nT('map:components.UserPoints.PointsListHeader.skryt_nastroyki_karty_10b1129b') : i18nT('map:components.UserPoints.PointsListHeader.pokazat_nastroyki_karty_b3396a43')}
              onPress={onToggleMapSettings}
              active={showMapSettings}
              size="sm"
              testID="userpoints-map-settings-toggle"
              showLabel
              style={local.actionButton}
            />
          ) : null}
        </View>
      </View>

      {showSearch && onSearch ? (
        <View style={local.searchBlock}>
          <View style={local.searchField}>
            <Feather name="search" size={16} color={colors.textMuted} />
            <TextInput
              {...searchInputAccessibilityProps()}
              style={[styles.searchInput, local.searchInput]}
              placeholder={i18nT('map:components.UserPoints.PointsListHeader.poisk_po_nazvaniyu_adresu_opisaniyu_i_kategorii_2d8497d1')}
              value={searchQuery}
              onChangeText={onSearch}
              placeholderTextColor={colors.textMuted}
              accessibilityLabel={i18nT('map:components.UserPoints.PointsListHeader.poisk_po_tochkam_f76d0d0d')}
              testID="userpoints-header-search"
            />
          </View>
        </View>
      ) : null}

      <View style={styles.headerDivider} />

      {hasActiveFilters ? (
        <View style={local.activeFiltersBlock} testID="userpoints-active-filters">
          <View style={local.activeFiltersHeaderRow}>
            <Text style={[styles.subtitle, local.activeFiltersLabel]}>{i18nT('map:components.UserPoints.PointsListHeader.aktivnye_filtry_62c0a188')}</Text>
            {isMobile ? (
              <IconButton
                icon={<Feather name="x" size={18} color={colors.text} />}
                label={i18nT('map:components.UserPoints.PointsListHeader.sbrosit_filtry_dae77a88')}
                onPress={onResetFilters}
                size="sm"
                testID="userpoints-header-reset-filters"
              />
            ) : (
              <Button
                label={i18nT('map:components.UserPoints.PointsListHeader.sbrosit_8b57afc9')}
                onPress={onResetFilters}
                accessibilityLabel={i18nT('map:components.UserPoints.PointsListHeader.sbrosit_filtry_dae77a88')}
                size="sm"
                variant="secondary"
                testID="userpoints-header-reset-filters"
              />
            )}
          </View>

          <View style={local.activeFiltersChipsRow}>
            {activeFilterChips.map((chip) => (
              <Chip
                key={chip.key}
                label={chip.label}
                onPress={() => onRemoveFilterChip(chip.key)}
                testID={`userpoints-filter-chip-${chip.key}`}
                selected
              />
            ))}
          </View>
        </View>
      ) : null}

      <View testID="userpoints-filters-inline">
        <PointFilters
          filters={filters}
          onChange={onFilterChange}
          siteCategoryOptions={siteCategoryOptions}
          availableColors={availableColors}
          presets={presets}
          activePresetId={activePresetId}
          onPresetChange={onPresetChange}
        />
      </View>
    </View>
  )
}

/** Минимальная ширина плитки статистики — четыре в ряд на 440 px панели. */
const STAT_CARD_MIN_WIDTH = 104
/** Переключатель «С картой / Только список» не сжимается уже двух подписей. */
const VIEW_MODE_CONTROL_MIN_WIDTH = 176

const createLocalStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  summaryCard: {
    marginBottom: DESIGN_TOKENS.spacing.md,
    padding: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.lg,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: DESIGN_TOKENS.spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DESIGN_TOKENS.spacing.xs,
  },
  statCard: {
    minWidth: STAT_CARD_MIN_WIDTH,
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderColor: colors.borderLight,
  },
  statValue: {
    fontSize: DESIGN_TOKENS.typography.scale.body.fontSize,
  },
  actionsGrid: {
    gap: DESIGN_TOKENS.spacing.sm,
  },
  viewModeControl: {
    minWidth: VIEW_MODE_CONTROL_MIN_WIDTH,
    flexGrow: 1,
    flexShrink: 1,
  },
  // Раскладка ряда действий одна на всех поверхностях: строка во всю ширину с
  // иконкой и подписью слева (mobile parity, `docs/RULES.md`). Полная ширина
  // снимает вопрос обрезания подписи на длинных BE/PL/UK.
  actionButton: {
    marginHorizontal: 0,
    width: '100%',
    justifyContent: 'flex-start',
  },
  actionHint: {
    fontSize: DESIGN_TOKENS.typography.scale.caption.fontSize,
    lineHeight: DESIGN_TOKENS.typography.scale.caption.lineHeight,
    color: colors.textMuted,
    marginTop: -DESIGN_TOKENS.spacing.xxs,
  },
  searchBlock: {
    marginBottom: DESIGN_TOKENS.spacing.sm,
  },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: colors.boxShadows.light,
        } as any)
      : null),
  },
  searchInput: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: 'transparent',
    paddingLeft: 0,
    paddingRight: 0,
  },
  activeFiltersBlock: {
    marginBottom: DESIGN_TOKENS.spacing.md,
    padding: DESIGN_TOKENS.spacing.sm,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: DESIGN_TOKENS.radii.md,
  },
  activeFiltersHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  activeFiltersLabel: {
    fontSize: DESIGN_TOKENS.typography.scale.caption.fontSize,
    fontWeight: '500' as any,
    color: colors.textMuted,
    marginBottom: 0,
  },
  activeFiltersChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DESIGN_TOKENS.spacing.xs,
    marginTop: DESIGN_TOKENS.spacing.xs,
  },
})
