import React from 'react';
import { Pressable, Text, View } from 'react-native';

interface FiltersPanelFooterProps {
  styles: any;
  mode: 'radius' | 'route';
  canBuildRoute: boolean;
  routePointsLength: number;
  routingLoading?: boolean;
  ctaLabel: string;
  hideFooterReset: boolean;
  onReset: () => void;
  onBuildRoute?: () => void;
}

const FiltersPanelFooter: React.FC<FiltersPanelFooterProps> = ({
  styles,
  mode,
  canBuildRoute,
  routePointsLength,
  routingLoading,
  ctaLabel,
  hideFooterReset,
  onReset,
  onBuildRoute,
}) => {
  return (
    <View style={styles.stickyFooter} testID="filters-panel-footer">
      {!canBuildRoute && mode === 'route' && (
        <Text style={styles.helperText}>
          Добавьте старт и финиш — кнопка «Построить маршрут» станет активной
        </Text>
      )}
      <View style={styles.footerButtons}>
        {!hideFooterReset && (
          <Pressable
            testID="filters-reset-button"
            style={[
              styles.ctaButton,
              styles.ctaOutline,
              mode === 'route' && !routePointsLength && styles.ctaDisabled,
            ]}
            onPress={() => {
              if (mode === 'route' && !routePointsLength) return;
              onReset();
            }}
            disabled={mode === 'route' && !routePointsLength}
            accessibilityRole="button"
            accessibilityLabel="Сбросить"
            accessibilityState={{ disabled: mode === 'route' && !routePointsLength }}
          >
            <Text style={styles.ctaOutlineText}>Сбросить</Text>
          </Pressable>
        )}

        {onBuildRoute && mode === 'route' && (
          <Pressable
            testID="filters-build-route-button"
            style={[styles.ctaButton, styles.ctaPrimary, (!canBuildRoute || routingLoading) && styles.ctaDisabled]}
            onPress={() => {
              if (!canBuildRoute || routingLoading) return;
              onBuildRoute();
            }}
            disabled={!canBuildRoute || routingLoading}
            accessibilityRole="button"
            accessibilityLabel="Построить маршрут"
            accessibilityState={{ disabled: !canBuildRoute || routingLoading }}
          >
            <Text style={styles.ctaPrimaryText}>{ctaLabel}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
};

export default React.memo(FiltersPanelFooter);
