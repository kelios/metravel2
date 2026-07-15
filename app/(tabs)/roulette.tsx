import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import Feather from '@expo/vector-icons/Feather';
import { usePathname } from 'expo-router';
import { useIsFocused } from 'expo-router';

import InstantSEO from '@/components/seo/LazyInstantSEO';
import ModernFilters from '@/components/listTravel/ModernFilters';
import RenderTravelItem from '@/components/listTravel/RenderTravelItem';
import UIButton from '@/components/ui/Button';
import type { Travel } from '@/types/types';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsive } from '@/hooks/useResponsive';
import { useRouletteLogic } from '@/components/roulette/useRoulette';
import { createStyles } from '@/components/roulette/styles';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { getTravelLabel } from '@/utils/pluralize';
import { buildCanonicalUrl, buildOgImageUrl, DEFAULT_OG_IMAGE_PATH } from '@/utils/seo';
import { translate as i18nT } from '@/i18n'


const MAP_BACKGROUND = require('../../assets/travel/roulette-map-bg.jpg') as ImageSourcePropType;
const COMPASS_BACKGROUND = require('../../assets/travel/roulette-compass-bg.jpg') as ImageSourcePropType;

const MAX_RESULTS = 3;
const PLACEHOLDER_SLOTS = [1, 2, 3] as const;

type Styles = ReturnType<typeof createStyles>;

// ---------------------------------------------------------------------------
// Компас + центральная кнопка (одинаков для desktop и mobile, разнятся стили)
// ---------------------------------------------------------------------------
type CompassDialProps = {
  styles: Styles;
  colors: ThemedColors;
  spinning: boolean;
  rotate: Animated.AnimatedInterpolation<string>;
  subtitle: string;
  onPress: () => void;
  wrapStyle: object;
  buttonStyle: object;
  iconSize: number;
};

const CompassDial = memo(function CompassDial({
  styles,
  colors,
  spinning,
  rotate,
  subtitle,
  onPress,
  wrapStyle,
  buttonStyle,
  iconSize,
}: CompassDialProps) {
  return (
    <View style={styles.rouletteCompassGroup}>
      <Animated.View style={[wrapStyle, spinning && { transform: [{ rotate }] }]}>
        <Image source={COMPASS_BACKGROUND} style={styles.rouletteCompassImage} resizeMode="cover" />
      </Animated.View>

      <Pressable
        style={buttonStyle}
        onPress={onPress}
        accessibilityLabel={spinning ? i18nT('shared:app.tabs.roulette.podbiraem_marshruty_631ed3d1') : i18nT('shared:app.tabs.roulette.krutit_ruletku_1e997580')}
        accessibilityRole="button"
      >
        <Feather name="compass" size={iconSize} color={colors.primaryDark} style={{ marginBottom: 4 }} />
        <Text style={styles.rouletteCompassButtonTitle}>
          {spinning ? i18nT('shared:app.tabs.roulette.krutim_7358efab') : i18nT('shared:app.tabs.roulette.sluchaynyy_marshrut_059a8a1d')}
        </Text>
        {!spinning && <Text style={styles.rouletteCompassButtonSubtitle}>{subtitle}</Text>}
      </Pressable>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Панель фильтров (сайдбар и модалка используют один и тот же блок)
// ---------------------------------------------------------------------------
type FiltersPanelProps = Pick<
  ReturnType<typeof useRouletteLogic>,
  'filter' | 'filterGroups' | 'handleFilterChange' | 'handleClearAll' | 'filtersLoading'
> & {
  resultsCount: number;
  onYearChange: (value: unknown) => void;
  onClose?: () => void;
  onApply?: () => void;
};

const FiltersPanel = memo(function FiltersPanel({
  filter,
  filterGroups,
  handleFilterChange,
  handleClearAll,
  filtersLoading,
  resultsCount,
  onYearChange,
  onClose,
  onApply,
}: FiltersPanelProps) {
  return (
    <ModernFilters
      filterGroups={filterGroups}
      selectedFilters={filter as never}
      onFilterChange={handleFilterChange}
      onClearAll={handleClearAll}
      resultsCount={resultsCount}
      isLoading={filtersLoading}
      year={filter.year}
      onYearChange={onYearChange}
      onClose={onClose}
      onApply={onApply}
      optionalHint
      embeddedSidebar={!onClose}
    />
  );
});

export default function RouletteScreen() {
  const pathname = usePathname();
  const isFocused = useIsFocused();
  const { isPhone, isLargePhone, width } = useResponsive();
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [isMounted, setIsMounted] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // На web (SSR) до гидрации всегда desktop-ветка, чтобы серверный и первый
  // клиентский рендер совпали. После маунта — обычная адаптивная логика.
  const layoutIsMobile = isPhone || isLargePhone;
  const isMobile = Platform.OS === 'web' && !isMounted ? false : layoutIsMobile;
  const insets = useSafeAreaInsets();
  // Clear the global bottom tab bar (BottomDock, absolute overlay ~56px + safe
  // area) so the last result card isn't hidden behind the footer on native.
  const resultsBottomInset = Platform.OS === 'web' ? 0 : 56 + insets.bottom + 16;

  const {
    filter,
    filterGroups,
    filtersSummary,
    activeFiltersCount,
    totalCount,
    isEmpty,
    result,
    spinning,
    handleSpin,
    handleClearAll,
    handleFilterChange,
    showLoading,
    onSelect,
    filtersLoading,
  } = useRouletteLogic();

  const onYearChange = useCallback((value: unknown) => onSelect('year', value), [onSelect]);
  const toggleFilters = useCallback(() => setShowFilters((prev) => !prev), []);
  const closeFilters = useCallback(() => setShowFilters(false), []);

  // --- Анимация вращения компаса -------------------------------------------
  const compassSpin = useRef(new Animated.Value(0)).current;
  const compassLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (spinning) {
      compassSpin.setValue(0);
      compassLoopRef.current = Animated.loop(
        Animated.timing(compassSpin, {
          toValue: 1,
          duration: 900,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
      );
      compassLoopRef.current.start();
    } else {
      compassLoopRef.current?.stop();
      compassSpin.setValue(0);
    }
    return () => compassLoopRef.current?.stop();
  }, [spinning, compassSpin]);

  const compassRotate = useMemo(
    () => compassSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }),
    [compassSpin],
  );

  // --- Поочерёдное появление карточек результата ---------------------------
  // Перезапускается на каждый новый набор результатов (включая «ещё варианты»),
  // т.к. result — новая ссылка после каждого spin'а.
  const cardAnims = useRef(
    Array.from({ length: MAX_RESULTS }, () => new Animated.Value(0)),
  ).current;

  useEffect(() => {
    if (result.length === 0) return;
    cardAnims.forEach((a) => a.setValue(0));
    Animated.stagger(
      120,
      cardAnims.map((a) =>
        Animated.timing(a, { toValue: 1, duration: 350, useNativeDriver: false }),
      ),
    ).start();
  }, [result, cardAnims]);

  const compassSubtitle = result.length > 0 ? i18nT('shared:app.tabs.roulette.esche_raz_c110bab5') : i18nT('shared:app.tabs.roulette.nazhmi_25dc94f5');

  return (
    <View style={styles.root}>
      {Platform.OS === 'web' && !isMobile && (
        <Image source={MAP_BACKGROUND} style={styles.rootBackgroundImage} resizeMode="cover" />
      )}
      {Platform.OS === 'web' && isMounted && isFocused && (
        <InstantSEO
          headKey="roulette"
          title={i18nT('seoStatic:root.roulette.title')}
          description={i18nT('seoStatic:root.roulette.description')}
          canonical={buildCanonicalUrl(pathname || '/roulette')}
          image={buildOgImageUrl(DEFAULT_OG_IMAGE_PATH)}
          ogType="website"
        />
      )}

      <View style={[styles.container, isMobile && styles.containerMobile]}>
        {!isMobile && (
          <View style={styles.sidebar}>
            <FiltersPanel
              filter={filter}
              filterGroups={filterGroups}
              handleFilterChange={handleFilterChange}
              handleClearAll={handleClearAll}
              filtersLoading={filtersLoading}
              resultsCount={totalCount}
              onYearChange={onYearChange}
            />
          </View>
        )}

        <View style={[styles.main, isMobile && styles.mainMobile]}>
          <View style={[styles.heroRow, isMobile && styles.heroRowMobile]}>
            <View style={[styles.heroTextBlock, isMobile && styles.heroTextBlockMobile]}>
              <Text style={styles.heroTitle}>{i18nT('shared:app.tabs.roulette.ne_znaesh_kuda_poehat_aa17da72')}</Text>
              <Text style={styles.heroSubtitle}>
                {isMobile
                  ? i18nT('shared:app.tabs.roulette.nazhmi_kompas_pokazhem_3_marshruta_f763a524')
                  : i18nT('shared:app.tabs.roulette.nazhmi_kompas_pokazhem_3_sluchaynyh_marshrut_51d75c58')}
              </Text>
            </View>
          </View>

          {isMobile && (
            <View style={[styles.topBar, styles.topBarMobile]}>
              <View style={styles.mobileTopRow}>
                <View style={styles.mobileFiltersBar}>
                  <Pressable
                    testID="mobile-filters-button"
                    style={styles.mobileFiltersButton}
                    onPress={toggleFilters}
                  >
                    <View style={styles.mobileFiltersHeaderRow}>
                      <Feather name="filter" size={14} color={colors.primaryDark} />
                      <Text style={styles.mobileFiltersLabel} numberOfLines={1}>
                        {i18nT('shared:app.tabs.roulette.filtry_value1_f0114db2', { value1: filtersSummary })}
                      </Text>
                    </View>
                  </Pressable>
                  {activeFiltersCount > 0 && (
                    <Pressable
                      testID="mobile-reset-filters"
                      style={styles.mobileFiltersResetButton}
                      onPress={handleClearAll}
                    >
                      <Feather name="x-circle" size={16} color={colors.primaryDark} />
                    </Pressable>
                  )}
                </View>

                {(spinning || result.length > 0) && (
                  <View style={styles.mobileSpinButton}>
                    <UIButton
                      label={spinning ? i18nT('shared:app.tabs.roulette.podbiraem_b82c6db6') : i18nT('shared:app.tabs.roulette.esche_a5b57985')}
                      onPress={handleSpin}
                      disabled={showLoading}
                    />
                  </View>
                )}
              </View>
            </View>
          )}

          <View style={[styles.resultsContainer, isMobile && styles.resultsContainerMobile]}>
            {showLoading && (
              <View style={styles.loaderBox}>
                <Animated.View style={{ transform: [{ rotate: compassRotate }] }}>
                  <Feather name="compass" size={40} color={colors.primaryDark} />
                </Animated.View>
                <Text style={[styles.loaderText, { marginTop: 12 }]}>{i18nT('shared:app.tabs.roulette.podbiraem_marshruty_def4478f')}</Text>
              </View>
            )}

            {!showLoading && isEmpty && (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>{i18nT('shared:app.tabs.roulette.nichego_ne_nashli_d74d63c5')}</Text>
                <Text style={styles.emptyText}>
                  {i18nT('shared:app.tabs.roulette.poprobuy_ubrat_chast_filtrov_ili_izmeni_zapr_355b9ced')}</Text>
              </View>
            )}

            {!showLoading && !isEmpty && (
              <View style={styles.cardsContainer}>
                {spinning && (
                  <View style={styles.overlaySpinner}>
                    <View style={styles.spinnerCircle}>
                      <Text style={styles.spinnerText}>{i18nT('shared:app.tabs.roulette.podbiraem_marshruty_def4478f')}</Text>
                    </View>
                  </View>
                )}

                {Platform.OS === 'web' && !isMobile ? (
                  <View style={styles.rouletteWrapper}>
                    <CompassDial
                      styles={styles}
                      colors={colors}
                      spinning={spinning}
                      rotate={compassRotate}
                      subtitle={compassSubtitle}
                      onPress={handleSpin}
                      wrapStyle={styles.rouletteCompassWrap}
                      buttonStyle={styles.rouletteCompassButton}
                      iconSize={22}
                    />

                    {result.length === 0 && totalCount > 0 && (
                      <>
                        <Text style={styles.poolHint}>
                          {i18nT('shared:app.tabs.roulette.sluchaynyy_vybor_iz_value1_value2_02b741a7', { value1: totalCount, value2: getTravelLabel(totalCount) })}
                        </Text>
                        <View style={styles.slotsRow}>
                          {PLACEHOLDER_SLOTS.map((slotIndex) => (
                            <View key={slotIndex} style={styles.slotCard}>
                              <Feather name="map-pin" size={24} color={colors.borderStrong} />
                              <Text style={styles.slotLabel}>{i18nT('shared:app.tabs.roulette.ideya_value1_68bcd3d7', { value1: slotIndex })}</Text>
                            </View>
                          ))}
                        </View>
                      </>
                    )}

                    {result.length > 0 && (
                      <View style={styles.rouletteCardsRow}>
                        {result.slice(0, MAX_RESULTS).map((item, index) => {
                          const anim = cardAnims[index];
                          return (
                            <Animated.View
                              key={String(item.id)}
                              style={[
                                styles.rouletteCard,
                                {
                                  opacity: anim,
                                  transform: [
                                    {
                                      translateY: anim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [28, 0],
                                      }),
                                    },
                                    {
                                      scale: anim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0.94, 1],
                                      }),
                                    },
                                  ],
                                },
                              ]}
                            >
                              <RenderTravelItem
                                item={item}
                                index={index}
                                isMobile={false}
                                isSuperuser={false}
                                isMetravel={false}
                                onDeletePress={undefined}
                                isFirst={index === 0}
                                selectable={false}
                                isSelected={false}
                                onToggle={undefined}
                                cardWidth={280}
                                viewportWidth={width}
                              />
                            </Animated.View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                ) : (
                  <>
                    {isMobile && result.length === 0 && (
                      <View style={styles.mobileRoulettePrompt}>
                        <CompassDial
                          styles={styles}
                          colors={colors}
                          spinning={spinning}
                          rotate={compassRotate}
                          subtitle={i18nT('shared:app.tabs.roulette.nazhmi_25dc94f5')}
                          onPress={handleSpin}
                          wrapStyle={styles.mobileRouletteCompassWrap}
                          buttonStyle={styles.mobileRouletteCompassButton}
                          iconSize={20}
                        />
                        {totalCount > 0 && (
                          <Text style={styles.poolHint}>
                            {i18nT('shared:app.tabs.roulette.sluchaynyy_vybor_iz_value1_value2_02b741a7', { value1: totalCount, value2: getTravelLabel(totalCount) })}
                          </Text>
                        )}
                      </View>
                    )}
                    <FlashList<Travel>
                      data={result as Travel[]}
                      keyExtractor={(item) => String(item.id)}
                      key="cols-1"
                      numColumns={1}
                      contentContainerStyle={[
                        styles.cardsGrid,
                        isMobile && styles.cardsGridMobile,
                        resultsBottomInset > 0 && { paddingBottom: resultsBottomInset },
                      ]}
                      {...({ estimatedItemSize: 420 } as any)}
                      renderItem={({ item, index }) => {
                        // Тот же поочерёдный «drop-in», что и на web-desktop, теперь и на
                        // mobile/native: карточки результата мягко выпадают сверху со
                        // stagger'ом (cardAnims перезапускается на каждый новый спин).
                        const anim = cardAnims[index] ?? cardAnims[cardAnims.length - 1];
                        return (
                          <Animated.View
                            style={[
                              styles.cardWrapper,
                              {
                                opacity: anim,
                                transform: [
                                  {
                                    translateY: anim.interpolate({
                                      inputRange: [0, 1],
                                      outputRange: [28, 0],
                                    }),
                                  },
                                  {
                                    scale: anim.interpolate({
                                      inputRange: [0, 1],
                                      outputRange: [0.94, 1],
                                    }),
                                  },
                                ],
                              },
                            ]}
                          >
                            <RenderTravelItem
                              item={item}
                              index={index}
                              isMobile={isMobile}
                              isSuperuser={false}
                              isMetravel={false}
                              onDeletePress={undefined}
                              isFirst={index === 0}
                              selectable={false}
                              isSelected={false}
                              onToggle={undefined}
                              viewportWidth={width}
                            />
                          </Animated.View>
                        );
                      }}
                    />
                  </>
                )}
              </View>
            )}
          </View>
        </View>
      </View>

      {isMobile && (
        <Modal visible={showFilters} animationType="slide" onRequestClose={closeFilters}>
          <View style={[styles.filtersModalShell, { paddingTop: insets.top }]}>
            <FiltersPanel
              filter={filter}
              filterGroups={filterGroups}
              handleFilterChange={handleFilterChange}
              handleClearAll={handleClearAll}
              filtersLoading={filtersLoading}
              resultsCount={totalCount}
              onYearChange={onYearChange}
              onClose={closeFilters}
              onApply={closeFilters}
            />
          </View>
        </Modal>
      )}
    </View>
  );
}
