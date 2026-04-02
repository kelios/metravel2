import React from 'react';
import { Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import Button from '@/components/ui/Button';
import { useThemedColors } from '@/hooks/useTheme';

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

const getPlacesLabel = (count: number) => {
  const absCount = Math.abs(count);
  const mod10 = absCount % 10;
  const mod100 = absCount % 100;

  if (mod10 === 1 && mod100 !== 11) return `${count} место`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} места`;
  return `${count} мест`;
};

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
  const mobileRadiusLabel =
    totalPoints > 0 ? `Показать ${totalPoints > 999 ? '999+' : totalPoints}` : 'Ничего не найдено';

  if (showMobileRadiusFooter) {
    return (
      <View style={styles.stickyFooter} testID="filters-panel-footer">
        <View style={styles.mobileFooterSummary}>
          <Text style={styles.mobileFooterSummaryTitle} testID="filters-mobile-summary-text">
            {totalPoints > 0 ? `${getPlacesLabel(totalPoints)} на карте` : 'Места не найдены'}
          </Text>
          <Text style={styles.mobileFooterSummaryHint}>
            {totalPoints > 0
              ? 'Фильтры уже применены. Можно сразу открыть подходящие точки списком.'
              : 'Попробуйте увеличить радиус или сбросить часть фильтров.'}
          </Text>
        </View>
        <View style={styles.footerButtons}>
          {!hideFooterReset && (
            <Button
              label="Сбросить"
              testID="filters-reset-button"
              onPress={onReset}
              accessibilityLabel="Сбросить"
              variant="outline"
              style={styles.ctaButton}
            />
          )}
          {onOpenList ? (
            <Button
              label={mobileRadiusLabel}
              testID="filters-mobile-results-button"
              icon={<Feather name="list" size={16} color={totalPoints > 0 ? colors.textOnPrimary : colors.textMuted} />}
              onPress={() => {
                if (totalPoints <= 0) return;
                onOpenList();
              }}
              disabled={totalPoints <= 0}
              accessibilityLabel="Открыть список мест"
              style={[
                styles.ctaButton,
                styles.ctaPrimary,
                totalPoints <= 0 && styles.ctaPrimaryDisabled,
              ]}
            />
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.stickyFooter} testID="filters-panel-footer">
      {!canBuildRoute && mode === 'route' && (
        <Text style={styles.helperText}>
          Добавьте старт и финиш — кнопка «Построить маршрут» станет активной
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
            icon={<Feather name="navigation" size={16} color={canBuildRoute && !routingLoading ? colors.textOnPrimary : colors.textMuted} />}
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
