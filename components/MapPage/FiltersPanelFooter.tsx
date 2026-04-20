import React from 'react';
import { Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import Button from '@/components/ui/Button';
import { useThemedColors } from '@/hooks/useTheme';

const getPlacesLabel = (count: number) => {
  const absCount = Math.abs(count);
  const mod10 = absCount % 10;
  const mod100 = absCount % 100;

  if (mod10 === 1 && mod100 !== 11) return `${count} место`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} места`;
  return `${count} мест`;
};

interface FiltersPanelFooterProps {
  styles: any;
  isMobile: boolean;
  mode: 'radius' | 'route';
  canBuildRoute: boolean;
  routePointsLength: number;
  routingLoading?: boolean;
  ctaLabel: string;
  hideFooterReset: boolean;
  onReset: () => void;
  onBuildRoute?: () => void;
  totalPoints?: number;
  onOpenList?: () => void;
}

const FiltersPanelFooter: React.FC<FiltersPanelFooterProps> = ({
  styles,
  isMobile,
  mode,
  canBuildRoute,
  routePointsLength,
  routingLoading,
  ctaLabel,
  hideFooterReset,
  onReset,
  onBuildRoute,
  totalPoints = 0,
  onOpenList,
}) => {
  const colors = useThemedColors();
  const showMobileRadiusFooter = isMobile && mode === 'radius';
  const canOpenList = typeof onOpenList === 'function';
  const mobileSummaryTitle =
    totalPoints > 0 ? `Найдено ${getPlacesLabel(totalPoints)}` : 'Пока ничего не найдено';
  const mobileSummaryHint =
    totalPoints > 0
      ? 'Откройте список или продолжайте двигать карту, чтобы уточнить выбор.'
      : 'Измените фильтры или радиус, чтобы увидеть подходящие места.';

  if (showMobileRadiusFooter) {
    return (
      <View style={styles.stickyFooter} testID="filters-panel-footer">
        <View style={styles.mobileFooterSummary}>
          <Text style={styles.mobileFooterSummaryTitle}>{mobileSummaryTitle}</Text>
          <Text style={styles.mobileFooterSummaryHint}>{mobileSummaryHint}</Text>
        </View>
        <View style={styles.footerButtons}>
          {!hideFooterReset && (
            <Button
              label="Сбросить"
              testID="filters-reset-button"
              onPress={onReset}
              accessibilityLabel="Сбросить фильтры"
              variant="outline"
              style={styles.ctaButton}
            />
          )}
          {canOpenList && (
            <Button
              label={totalPoints > 0 ? `Показать ${totalPoints}` : 'Открыть список'}
              testID="filters-open-list-button"
              icon={<Feather name="list" size={16} color={colors.textOnPrimary} />}
              onPress={onOpenList}
              accessibilityLabel="Открыть список мест"
              style={[styles.ctaButton, styles.ctaPrimary]}
            />
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.stickyFooter} testID="filters-panel-footer">
      {!canBuildRoute && mode === 'route' && (
        <Text style={styles.helperText}>
          Добавьте старт и финиш, и кнопка маршрута станет активной.
        </Text>
      )}
      <View style={styles.footerButtons}>
        {!hideFooterReset && (
          <Button
            label="Сбросить"
            testID="filters-reset-button"
            onPress={() => {
              if (mode === 'route' && !routePointsLength) return;
              onReset();
            }}
            disabled={mode === 'route' && !routePointsLength}
            accessibilityLabel="Сбросить"
            variant="outline"
            style={styles.ctaButton}
          />
        )}

        {onBuildRoute && mode === 'route' && (
          <Button
            label={ctaLabel}
            testID="filters-build-route-button"
            icon={
              <Feather
                name="navigation"
                size={16}
                color={canBuildRoute && !routingLoading ? colors.textOnPrimary : colors.textMuted}
              />
            }
            onPress={() => {
              if (!canBuildRoute || routingLoading) return;
              onBuildRoute();
            }}
            disabled={!canBuildRoute || routingLoading}
            accessibilityLabel="Построить маршрут"
            style={[
              styles.ctaButton,
              styles.ctaPrimary,
              (!canBuildRoute || routingLoading) && styles.ctaPrimaryDisabled,
            ]}
          />
        )}
      </View>
    </View>
  );
};

export default React.memo(FiltersPanelFooter);
