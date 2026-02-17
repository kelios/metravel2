import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, Text, View, Pressable, Image, Animated, Easing } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import Feather from '@expo/vector-icons/Feather';
import { usePathname } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';

import InstantSEO from '@/components/seo/LazyInstantSEO';
import ModernFilters from '@/components/listTravel/ModernFilters';
import RenderTravelItem from '@/components/listTravel/RenderTravelItem';
import UIButton from '@/components/ui/Button';
import type { Travel } from '@/types/types';

import { useResponsive } from '@/hooks/useResponsive';
import { useRouletteLogic } from '@/components/roulette/useRoulette';
import { createStyles } from '@/components/roulette/styles';
import { useThemedColors } from '@/hooks/useTheme';

export default function RouletteScreen() {
  const pathname = usePathname();
  const isFocused = useIsFocused();
  const { isPhone, isLargePhone, width } = useResponsive();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // On web with SSR we must avoid changing layout branches (mobile vs desktop)
  // between server render and the first client render.
  const isMobile =
    Platform.OS === 'web'
      ? (isMounted ? isPhone || isLargePhone : false)
      : isPhone || isLargePhone;
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const {
    filter,
    filterGroups,
    filtersSummary,
    activeFiltersCount,
    travels,
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

  const { buildCanonicalUrl, buildOgImageUrl, DEFAULT_OG_IMAGE_PATH } = require('@/utils/seo');

  const title = 'Случайный маршрут | Metravel';
  const description = 'Не знаешь, куда поехать? Подбери фильтры — и мы случайно предложим три маршрута под твои пожелания.';

  // Фоновые изображения (карта и компас) из корневого assets/travel
  // Относительный путь: from app/(tabs)/roulette.tsx -> ../../assets/travel/
  const mapBackground = require('../../assets/travel/roulette-map-bg.jpg');
  const compassBackground = require('../../assets/travel/roulette-compass-bg.jpg');

  const [showFilters, setShowFilters] = useState(false);

  // Compass spin animation
  const compassSpin = useRef(new Animated.Value(0)).current;
  const compassSpinRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (spinning) {
      compassSpin.setValue(0);
      compassSpinRef.current = Animated.loop(
        Animated.timing(compassSpin, {
          toValue: 1,
          duration: 1200,
          easing: Easing.linear,
          useNativeDriver: Platform.OS !== 'web',
        }),
      );
      compassSpinRef.current.start();
    } else {
      compassSpinRef.current?.stop();
      compassSpin.setValue(0);
    }
    return () => { compassSpinRef.current?.stop(); };
  }, [spinning, compassSpin]);

  const compassRotate = compassSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Stagger animation for result cards
  const cardAnims = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;
  const prevResultLen = useRef(0);

  useEffect(() => {
    if (result.length > 0 && prevResultLen.current === 0) {
      cardAnims.forEach(a => a.setValue(0));
      Animated.stagger(120, cardAnims.map(a =>
        Animated.timing(a, {
          toValue: 1,
          duration: 350,
          useNativeDriver: Platform.OS !== 'web',
        }),
      )).start();
    }
    prevResultLen.current = result.length;
  }, [result.length, cardAnims]);

  return (
    <View style={styles.root}>
      {Platform.OS === 'web' && (
        <Image
          source={mapBackground}
          style={styles.rootBackgroundImage}
          resizeMode="cover"
        />
      )}
      {Platform.OS === 'web' && isMounted && isFocused && (
        <InstantSEO
          headKey="roulette"
          title={title}
          description={description}
          canonical={buildCanonicalUrl(pathname || '/roulette')}
          image={buildOgImageUrl(DEFAULT_OG_IMAGE_PATH)}
          ogType="website"
        />
      )}
      <View style={[styles.container, isMobile && styles.containerMobile]}>
        {!isMobile && (
          <View style={styles.sidebar}>
            <ModernFilters
              filterGroups={filterGroups}
              selectedFilters={filter as any}
              onFilterChange={handleFilterChange}
              onClearAll={handleClearAll}
              resultsCount={travels.length}
              isLoading={filtersLoading}
              year={filter.year}
              onYearChange={(value) => onSelect('year', value)}
            />
          </View>
        )}

        <View style={[styles.main, isMobile && styles.mainMobile]}>
          <View style={[styles.heroRow, isMobile && styles.heroRowMobile]}>
            <View style={styles.heroTextBlock}>
              <Text style={styles.heroTitle}>Не знаешь, куда поехать?</Text>
              <Text style={styles.heroSubtitle}>
                {isMobile
                  ? 'Выбери фильтры и нажми «Подобрать» — покажем 3 маршрута.'
                  : 'Подбери фильтры — и мы случайно предложим три маршрута под твои пожелания.'}
              </Text>
            </View>
            {!isMobile && (
              <View style={styles.heroButtonBlock}>
                <UIButton
                  label={spinning ? 'Подбираем маршруты…' : (result.length > 0 ? 'Подобрать ещё варианты' : 'Подобрать маршруты')}
                  onPress={handleSpin}
                  disabled={showLoading}
                />
              </View>
            )}
          </View>

          <View style={[styles.topBar, isMobile && styles.topBarMobile]}>
            {isMobile && (
              <View style={styles.mobileTopRow}>
                <View style={styles.mobileFiltersBar}>
                  <Pressable
                    testID="mobile-filters-button"
                    style={styles.mobileFiltersButton}
                    onPress={() => setShowFilters((prev) => !prev)}
                  >
                    <View style={styles.mobileFiltersHeaderRow}>
                      <Feather name="filter" size={14} color={colors.primary} />
                      <Text style={styles.mobileFiltersLabel} numberOfLines={1}>
                        {`Фильтры: ${filtersSummary}`}
                      </Text>
                    </View>
                  </Pressable>
                  {activeFiltersCount > 0 && (
                    <Pressable
                      testID="mobile-reset-filters"
                      style={styles.mobileFiltersResetButton}
                      onPress={handleClearAll}
                    >
                      <Feather name="x-circle" size={16} color={colors.primary} />
                    </Pressable>
                  )}
                </View>

                <View style={styles.mobileSpinButton}>
                  <UIButton
                    label={spinning
                      ? 'Подбираем…'
                      : (result.length > 0 ? 'Ещё' : 'Подобрать')}
                    onPress={handleSpin}
                    disabled={showLoading}
                  />
                </View>
              </View>
            )}
          </View>

          <View style={[styles.resultsContainer, isMobile && styles.resultsContainerMobile]}>
            {showLoading && (
              <View style={styles.loaderBox}>
                <Animated.View style={{ transform: [{ rotate: compassRotate }] }}>
                  <Feather name="compass" size={40} color={colors.primary} />
                </Animated.View>
                <Text style={[styles.loaderText, { marginTop: 12 }]}>Подбираем маршруты…</Text>
              </View>
            )}

            {!showLoading && isEmpty && (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>Ничего не нашли</Text>
                <Text style={styles.emptyText}>
                  Попробуй убрать часть фильтров или измени запрос.
                </Text>
              </View>
            )}

            {!showLoading && !isEmpty && result.length === 0 && travels.length > 0 && (
              <View style={styles.hintBox}>
                <Text style={styles.hintTitle}>Готов к случайному путешествию?</Text>
                <Text style={styles.hintText}>
                  Настрой фильтры слева и нажми «Подобрать маршруты», чтобы получить три идеи поездок.
                </Text>
              </View>
            )}

            {!showLoading && !isEmpty && (
              <View style={styles.cardsContainer}>
                {spinning && (
                  <View style={styles.overlaySpinner}>
                    <View style={styles.spinnerCircle}>
                      <Text style={styles.spinnerText}>Подбираем маршруты…</Text>
                    </View>
                  </View>
                )}
                {Platform.OS === 'web' && !isMobile ? (
                  <View style={styles.rouletteWrapper}>
                    {/* Компас + кнопка */}
                    <View style={styles.rouletteCompassGroup}>
                      <Animated.View
                        style={[
                          styles.rouletteCompassWrap,
                          spinning && { transform: [{ rotate: compassRotate }] },
                        ]}
                      >
                        <Image
                          source={compassBackground}
                          style={styles.rouletteCompassImage}
                          resizeMode="cover"
                        />
                      </Animated.View>

                      <Pressable
                        style={styles.rouletteCompassButton}
                        onPress={handleSpin}
                        accessibilityLabel={spinning ? 'Подбираем маршруты' : 'Крутить рулетку'}
                        accessibilityRole="button"
                      >
                        <Feather name="compass" size={22} color={colors.primary} style={{ marginBottom: 4 }} />
                        <Text style={styles.rouletteCompassButtonTitle}>
                          {spinning ? 'Крутим…' : 'Случайный маршрут'}
                        </Text>
                        {!spinning && (
                          <Text style={styles.rouletteCompassButtonSubtitle}>
                            {result.length > 0 ? 'Ещё раз' : 'Нажми'}
                          </Text>
                        )}
                      </Pressable>
                    </View>

                    {/* Три карточки в ряд */}
                    {result.length > 0 && (
                      <View style={styles.rouletteCardsRow}>
                        {result.slice(0, 3).map((item, index) => (
                          <Animated.View
                            key={String(item.id)}
                            style={[
                              styles.rouletteCard,
                              {
                                opacity: cardAnims[index] ?? 1,
                                transform: [{
                                  translateY: (cardAnims[index] ?? new Animated.Value(1)).interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [20, 0],
                                  }),
                                }],
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
                        ))}
                      </View>
                    )}
                  </View>
                ) : (
                  <FlashList<Travel>
                    data={result as Travel[]}
                    keyExtractor={(item) => String(item.id)}
                    key="cols-1"
                    numColumns={1}
                    contentContainerStyle={[styles.cardsGrid, isMobile && styles.cardsGridMobile]}
                    {...({ estimatedItemSize: 420 } as any)}
                    renderItem={({ item, index }) => (
                      <View style={styles.cardWrapper}>
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
                      </View>
                    )}
                  />
                )}
              </View>
            )}
          </View>
        </View>
      </View>

      {isMobile && (
        <Modal
          visible={showFilters}
          animationType="slide"
          onRequestClose={() => setShowFilters(false)}
        >
          <View style={{ flex: 1, backgroundColor: colors.background }}>
            <ModernFilters
              filterGroups={filterGroups}
              selectedFilters={filter as any}
              onFilterChange={handleFilterChange}
              onClearAll={handleClearAll}
              resultsCount={travels.length}
              isLoading={filtersLoading}
              year={filter.year}
              onYearChange={(value) => onSelect('year', value)}
              onClose={() => setShowFilters(false)}
              onApply={() => setShowFilters(false)}
            />
          </View>
        </Modal>
      )}
    </View>
  );
}
