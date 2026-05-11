import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
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
  startAddress?: string;
  endAddress?: string;
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
  startAddress,
  endAddress,
}) => {
  const colors = useThemedColors();
  const showMobileRadiusFooter = isMobile && mode === 'radius';
  const canOpenList = typeof onOpenList === 'function' && totalPoints > 0;
  const mobileOpenListLabel = totalPoints > 0
    ? `Список мест · ${totalPoints}`
    : 'Список мест'

  const routeHelperText = React.useMemo(() => {
    if (mode !== 'route' || canBuildRoute) return null;
    if (!startAddress && !endAddress) return 'Укажите точку старта и финиша';
    if (!startAddress) return 'Укажите точку старта';
    if (!endAddress) return 'Укажите точку финиша';
    return 'Добавьте старт и финиш';
  }, [canBuildRoute, endAddress, mode, startAddress]);

  if (showMobileRadiusFooter) {
    return (
      <View style={styles.stickyFooter} testID="filters-panel-footer">
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
              label={mobileOpenListLabel}
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
      {routeHelperText ? (
        <Text style={styles.helperText}>{routeHelperText}</Text>
      ) : null}
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
            label={routingLoading ? 'Строим маршрут…' : ctaLabel}
            testID="filters-build-route-button"
            icon={
              routingLoading
                ? <ActivityIndicator size="small" color={colors.textMuted} />
                : (
                  <Feather
                    name="navigation"
                    size={16}
                    color={
                      canBuildRoute && !routingLoading
                        ? colors.textOnPrimary
                        : colors.textMuted
                    }
                  />
                )
            }
            onPress={() => {
              if (!canBuildRoute || routingLoading) return;
              onBuildRoute();
            }}
            disabled={!canBuildRoute || routingLoading}
            accessibilityLabel={routingLoading ? 'Строим маршрут, подождите' : 'Построить маршрут'}
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
