import React, { memo, useEffect, useMemo, useRef } from 'react';
import { Platform, Pressable, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import UIButton from '@/components/ui/Button';
import ProgressIndicator from '@/components/ui/ProgressIndicator';
import { createStyles } from './listTravelStyles';
import { useThemedColors } from '@/hooks/useTheme';
import { getTravelLabel } from '@/utils/pluralize';
import { translate as i18nT } from '@/i18n'


function WebTextButton({
  label,
  onPress,
  accessibilityLabel,
  style,
}: {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<TextStyle>;
}) {
  const isWeb = Platform.OS === 'web';
  const ref = useRef<any>(null);

  useEffect(() => {
    if (!isWeb) return;

    const node = ref.current;
    if (!node || typeof node.addEventListener !== 'function') return;

    const handleActivate = (event: Event) => {
      event.preventDefault?.();
      event.stopPropagation?.();
      onPress();
    };

    node.addEventListener('click', handleActivate);
    node.addEventListener('touchend', handleActivate, { passive: false });

    return () => {
      node.removeEventListener('click', handleActivate);
      node.removeEventListener('touchend', handleActivate);
    };
  }, [isWeb, onPress]);

  if (Platform.OS !== 'web') {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label}>
        <Text style={style}>{label}</Text>
      </Pressable>
    );
  }

  return React.createElement(
    'div',
    {
      ref,
      role: 'button',
      tabIndex: 0,
      'aria-label': accessibilityLabel ?? label,
      onKeyDown: (e: KeyboardEvent) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        e.stopPropagation();
        onPress();
      },
      style: { cursor: 'pointer' },
    },
    <Text style={style}>{label}</Text>,
  );
}

export const ExportBar = memo(function ExportBar({
  isMobile,
  selectedCount,
  allCount,
  onToggleSelectAll,
  onClearSelection,
  onSave,
  onSettings,
  isGenerating,
  progress,
  settingsSummary,
  hasSelection,
  styles,
}: {
  isMobile: boolean;
  selectedCount: number;
  allCount: number;
  onToggleSelectAll: () => void;
  onClearSelection: () => void;
  onSave: () => void;
  onSettings: () => void;
  isGenerating?: boolean;
  progress?: number;
  settingsSummary: string;
  hasSelection: boolean;
  styles?: ReturnType<typeof createStyles>;
}) {
  const colors = useThemedColors();
  const resolvedStyles = useMemo(() => styles ?? createStyles(colors), [colors, styles]);
  const asViewStyle = (style: unknown): StyleProp<ViewStyle> => style as StyleProp<ViewStyle>;
  const asTextStyle = (style: unknown): StyleProp<TextStyle> => style as StyleProp<TextStyle>;
  const selectionText = selectedCount
    ? i18nT('travel:components.listTravel.ExportBar.vybrano_value1_value2_327f88e4', { value1: selectedCount, value2: getTravelLabel(selectedCount) })
    : i18nT('travel:components.listTravel.ExportBar.vyberite_puteshestviya_dlya_eksporta_11714f42');

  return (
    <View
      style={[
        asViewStyle(resolvedStyles.exportBar),
        isMobile ? asViewStyle(resolvedStyles.exportBarMobile) : null,
        Platform.OS === 'web' && isMobile ? asViewStyle(resolvedStyles.exportBarMobileWeb) : null,
      ]}
    >
      <View style={asViewStyle(resolvedStyles.exportBarInfo)}>
        <Text style={asTextStyle(resolvedStyles.exportBarInfoTitle)}>{selectionText}</Text>
        <View style={asViewStyle(resolvedStyles.exportBarMetaRow)}>
          <Text style={asTextStyle(resolvedStyles.exportBarInfoSubtitle)}>
            {hasSelection ? i18nT('travel:components.listTravel.ExportBar.nastroyki_value1_bcafaa11', { value1: settingsSummary }) : i18nT('travel:components.listTravel.ExportBar.vyberite_hotya_by_odno_puteshestvie_chtoby_v_fcdf9817')}
          </Text>
          <View style={asViewStyle(resolvedStyles.exportBarInfoActions)}>
            <WebTextButton
              label={selectedCount === allCount && allCount > 0 ? i18nT('travel:components.listTravel.ExportBar.snyat_vydelenie_21dd14eb') : i18nT('travel:components.listTravel.ExportBar.vybrat_vse_b2fb9a88')}
              onPress={onToggleSelectAll}
              accessibilityLabel={selectedCount === allCount && allCount > 0 ? i18nT('travel:components.listTravel.ExportBar.snyat_vydelenie_21dd14eb') : i18nT('travel:components.listTravel.ExportBar.vybrat_vse_b2fb9a88')}
              style={asTextStyle(resolvedStyles.linkButton)}
            />
            {hasSelection && (
              <WebTextButton
                label={i18nT('travel:components.listTravel.ExportBar.ochistit_vybor_a741d985')}
                onPress={onClearSelection}
                accessibilityLabel={i18nT('travel:components.listTravel.ExportBar.ochistit_vybor_a741d985')}
                style={asTextStyle(resolvedStyles.linkButton)}
              />
            )}
            {hasSelection && (
              <WebTextButton
                label={i18nT('travel:components.listTravel.ExportBar.nastroyki_0e34bddd')}
                onPress={onSettings}
                accessibilityLabel={i18nT('travel:components.listTravel.ExportBar.nastroyki_eksporta_3ff51289')}
                style={asTextStyle(resolvedStyles.linkButton)}
              />
            )}
          </View>
        </View>
      </View>

      <View style={[asViewStyle(resolvedStyles.exportBarButtons), isMobile ? asViewStyle(resolvedStyles.exportBarButtonsMobile) : null]}>
        <UIButton
          label={isGenerating ? i18nT('travel:components.listTravel.ExportBar.generatsiya_value1_1e676e2e', { value1: progress || 0 }) : i18nT('travel:components.listTravel.ExportBar.sohranit_pdf_2e27b211')}
          onPress={onSave}
          disabled={!hasSelection || isGenerating}
        />
      </View>

      {isGenerating && Platform.OS === 'web' && (
        <View style={asViewStyle(resolvedStyles.progressWrapper)}>
          <ProgressIndicator
            progress={progress ?? 0}
            stage={
              (progress ?? 0) < 30
                ? i18nT('travel:components.listTravel.ExportBar.podgotovka_dannyh_d7a192a7')
                : (progress ?? 0) < 60
                  ? i18nT('travel:components.listTravel.ExportBar.generatsiya_soderzhimogo_abb73696')
                  : (progress ?? 0) < 90
                    ? i18nT('travel:components.listTravel.ExportBar.obrabotka_izobrazheniy_acb78bcd')
                    : i18nT('travel:components.listTravel.ExportBar.sozdanie_pdf_6caef798')
            }
            message={
              (progress ?? 0) < 30
                ? i18nT('travel:components.listTravel.ExportBar.proverka_vybrannyh_puteshestviy_b6802281')
                : (progress ?? 0) < 60
                  ? i18nT('travel:components.listTravel.ExportBar.formirovanie_maketa_f84b0971')
                  : (progress ?? 0) < 90
                    ? i18nT('travel:components.listTravel.ExportBar.optimizatsiya_izobrazheniy_2ff24de8')
                    : i18nT('travel:components.listTravel.ExportBar.finalnaya_obrabotka_2e24337d')
            }
            showPercentage={true}
          />
        </View>
      )}
    </View>
  );
});
