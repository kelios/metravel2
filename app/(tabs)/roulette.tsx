import React, { useMemo, useState } from 'react';
import { Modal, Platform, Text, View, Pressable, FlatList, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { usePathname } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';

import InstantSEO from '@/components/seo/InstantSEO';
import ModernFilters from '@/components/listTravel/ModernFilters';
import RenderTravelItem from '@/components/listTravel/RenderTravelItem';
import UIButton from '@/components/ui/Button';

import { useResponsive } from '@/hooks/useResponsive';
import { useRouletteLogic } from '@/components/roulette/useRoulette';
import { createStyles } from '@/components/roulette/styles';
import { useThemedColors } from '@/hooks/useTheme';

export default function RouletteScreen() {
  const pathname = usePathname();
  const isFocused = useIsFocused();
  const { isPhone, isLargePhone } = useResponsive();
  const isMobile = isPhone || isLargePhone;
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
  } = useRouletteLogic();

  const SITE = process.env.EXPO_PUBLIC_SITE_URL || 'https://metravel.by';
  const canonical = useMemo(() => `${SITE}${pathname || '/roulette'}`, [SITE, pathname]);

  const title = 'Случайный маршрут | Metravel';
  const description = 'Не знаешь, куда поехать? Подбери фильтры — и мы случайно предложим три маршрута под твои пожелания.';

  // Фоновые изображения (карта и компас) из корневого assets/travel
  // Относительный путь: from app/(tabs)/roulette.tsx -> ../../assets/travel/
  const mapBackground = require('../../assets/travel/roulette-map-bg.jpg');
  const compassBackground = require('../../assets/travel/roulette-compass-bg.jpg');

  const [showFilters, setShowFilters] = useState(false);

  return (
    <View style={styles.root}>
      {Platform.OS === 'web' && (
        <Image
          source={mapBackground}
          style={styles.rootBackgroundImage}
          resizeMode="cover"
        />
      )}
      {isFocused && Platform.OS === 'web' && (
        <InstantSEO
          headKey="roulette"
          title={title}
          description={description}
          canonical={canonical}
          image={`${SITE}/og-preview.jpg`}
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
                <Text style={styles.loaderText}>Подбираем маршруты…</Text>
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
                    <View style={styles.rouletteCircle}>
                      {/* Фон-компас внутри круга на web */}
                      <Image
                        source={compassBackground}
                        style={styles.rouletteCompassImage}
                        resizeMode="cover"
                      />

                      {result.slice(0, 3).map((item, index) => (
                        <View
                          key={String(item.id)}
                          style={[
                            styles.rouletteCard,
                            index === 0 && styles.rouletteCardTop,
                            index === 1 && styles.rouletteCardLeft,
                            index === 2 && styles.rouletteCardRight,
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
                            isSingle
                            selectable={false}
                            isSelected={false}
                            onToggle={undefined}
                          />
                        </View>
                      ))}

                      <Pressable style={styles.rouletteCenter} onPress={handleSpin}>
                        <Text style={styles.rouletteCenterTitle}>Случайный маршрут</Text>
                        <Text style={styles.rouletteCenterSubtitle}>
                          {result.length > 0
                            ? `Выбрано ${result.length} маршрута`
                            : 'Нажми, чтобы подобрать маршруты'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <FlatList
                    data={result}
                    keyExtractor={(item) => String(item.id)}
                    key="cols-1"
                    numColumns={1}
                    contentContainerStyle={[styles.cardsGrid, isMobile && styles.cardsGridMobile]}
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
