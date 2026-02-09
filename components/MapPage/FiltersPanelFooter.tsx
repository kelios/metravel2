import React from 'react';
import { Text, View } from 'react-native';
import Button from '@/components/ui/Button';

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
  totalPoints,
  onOpenList,
}) => {
  const showMobileApply = isMobile && mode === 'radius';
  const safeTotalPoints = typeof totalPoints === 'number' ? totalPoints : 0;
  const canOpenList = typeof onOpenList === 'function' && safeTotalPoints > 0;

  return (
    <View style={styles.stickyFooter} testID="filters-panel-footer">
      {showMobileApply ? (
        <View style={styles.footerButtons}>
          {!hideFooterReset && (
            <Button
              label="Сбросить"
              testID="filters-reset-button"
              onPress={() => {
                onReset();
              }}
              accessibilityLabel="Сбросить"
              variant="outline"
              style={[styles.ctaButton, { flex: 1 } as any]}
            />
          )}

          <Button
            label={safeTotalPoints > 0 ? `Показать ${safeTotalPoints} мест` : 'Ничего не найдено'}
            testID="filters-show-results-button"
            onPress={() => {
              if (!canOpenList) return;
              onOpenList?.();
            }}
            disabled={!canOpenList}
            accessibilityLabel={safeTotalPoints > 0 ? `Показать ${safeTotalPoints} мест` : 'Ничего не найдено'}
            variant="primary"
            style={[styles.ctaButton, { flex: 1 } as any]}
          />
        </View>
      ) : (
        <>
          {typeof totalPoints === 'number' && totalPoints > 0 && (
            <Text style={styles.footerPreview} testID="footer-results-preview">
              Найдено {totalPoints} мест
            </Text>
          )}
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
                onPress={() => {
                  if (!canBuildRoute || routingLoading) return;
                  onBuildRoute();
                }}
                disabled={!canBuildRoute || routingLoading}
                accessibilityLabel="Построить маршрут"
                style={styles.ctaButton}
              />
            )}
          </View>
        </>
      )}
    </View>
  );
};

export default React.memo(FiltersPanelFooter);
