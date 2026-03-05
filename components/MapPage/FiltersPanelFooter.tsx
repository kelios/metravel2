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
  totalPoints: _totalPoints,
  onOpenList: _onOpenList,
}) => {
  const colors = useThemedColors();
  const showMobileApply = isMobile && mode === 'radius';

  if (showMobileApply) return null;

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
            style={[styles.ctaButton, styles.ctaPrimary]}
          />
        )}
      </View>
    </View>
  );
};

export default React.memo(FiltersPanelFooter);
