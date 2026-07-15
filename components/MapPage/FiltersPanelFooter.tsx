import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import Button from '@/components/ui/Button';
import { useThemedColors } from '@/hooks/useTheme';
import { getPlaceLabel } from '@/utils/pluralize';
import { translate as i18nT } from '@/i18n'


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
    ? i18nT('map:components.MapPage.FiltersPanelFooter.spisok_value1_value2_a33fbeca', { value1: totalPoints, value2: getPlaceLabel(totalPoints) })
    : i18nT('map:components.MapPage.FiltersPanelFooter.spisok_mest_f24a46c4')

  const routeHelperText = React.useMemo(() => {
    if (mode !== 'route' || canBuildRoute) return null;
    if (!startAddress && !endAddress) return i18nT('map:components.MapPage.FiltersPanelFooter.ukazhite_tochku_starta_i_finisha_f45fa99f');
    if (!startAddress) return i18nT('map:components.MapPage.FiltersPanelFooter.ukazhite_tochku_starta_c5e75b16');
    if (!endAddress) return i18nT('map:components.MapPage.FiltersPanelFooter.ukazhite_tochku_finisha_30a0813c');
    return i18nT('map:components.MapPage.FiltersPanelFooter.dobavte_start_i_finish_c32c2290');
  }, [canBuildRoute, endAddress, mode, startAddress]);

  if (showMobileRadiusFooter) {
    return (
      <View style={styles.stickyFooter} testID="filters-panel-footer">
        <View style={styles.footerButtons}>
          {!hideFooterReset && (
            <Button
              label={i18nT('map:components.MapPage.FiltersPanelFooter.sbrosit_0abc4036')}
              testID="filters-reset-button"
              onPress={onReset}
              accessibilityLabel={i18nT('map:components.MapPage.FiltersPanelFooter.sbrosit_filtry_fc81efcc')}
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
              accessibilityLabel={i18nT('map:components.MapPage.FiltersPanelFooter.otkryt_spisok_mest_ca60a07e')}
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
            label={i18nT('map:components.MapPage.FiltersPanelFooter.sbrosit_0abc4036')}
            testID="filters-reset-button"
            onPress={() => {
              if (mode === 'route' && !routePointsLength) return;
              onReset();
            }}
            disabled={mode === 'route' && !routePointsLength}
            accessibilityLabel={i18nT('map:components.MapPage.FiltersPanelFooter.sbrosit_0abc4036')}
            variant="outline"
            style={styles.ctaButton}
          />
        )}

        {onBuildRoute && mode === 'route' && (
          <Button
            label={routingLoading ? i18nT('map:components.MapPage.FiltersPanelFooter.stroim_marshrut_27b96e27') : ctaLabel}
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
            accessibilityLabel={routingLoading ? i18nT('map:components.MapPage.FiltersPanelFooter.stroim_marshrut_podozhdite_d4bd595d') : i18nT('map:components.MapPage.FiltersPanelFooter.postroit_marshrut_87c4a292')}
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
