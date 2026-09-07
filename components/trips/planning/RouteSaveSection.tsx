// components/trips/planning/RouteSaveSection.tsx
// Главное действие панели маршрута: кнопка сохранения, её подсказка и ошибка
// сохранения. Вынесено из RouteBuilder.tsx (#1825) дословно — та же лесенка
// подписей `routeBuilderCta`, те же testID.
import React from 'react';
import { Text, View } from 'react-native';

import { routeBuilderCta } from '@/components/trips/planning/routeBuilderCta';
import Button from '@/components/ui/Button';
import type { createStyles } from './RouteBuilder.styles';
import type { createRoutePanelStyles } from './routePanelStyles';

type RouteBuilderStyles = ReturnType<typeof createStyles>;
type RoutePanelStyles = ReturnType<typeof createRoutePanelStyles>;

interface Props {
  styles: RouteBuilderStyles;
  panelStyles: RoutePanelStyles;
  pointCount: number;
  savedPointCount: number;
  hasUnsavedChanges: boolean;
  hasPendingOriginal: boolean;
  /** PUT маршрута или отправка оригинала ещё летят. */
  routeSavePending: boolean;
  /** Перестроение маршрута ещё летит: кнопку оно тоже гасит. */
  transportPending: boolean;
  error: string | null;
  onSave: () => void;
}

// #1491: главное действие панели. Подписи — общая лесенка с /map
// («Добавьте старт и финиш» → «Построить маршрут» → «Пересчитать маршрут»),
// а сама кнопка появляется только когда есть несохранённые правки: постоянная
// «Сохранить маршрут» не отличала «правки ждут» от «всё уже на сервере».
export default function RouteSaveSection({
  styles,
  panelStyles,
  pointCount,
  savedPointCount,
  hasUnsavedChanges,
  hasPendingOriginal,
  routeSavePending,
  transportPending,
  error: visibleRouteSaveError,
  onSave,
}: Props) {
  const cta = routeBuilderCta({
    pointCount,
    savedPointCount,
    hasUnsavedChanges,
    hasPendingOriginal,
    pending: routeSavePending || transportPending,
  });

  return cta.visible ? (
    <View style={panelStyles.ctaBlock}>
      <Button
        label={cta.label}
        onPress={onSave}
        loading={routeSavePending}
        disabled={cta.disabled}
        fullWidth
        testID="route-builder-save"
      />
      {cta.hint ? (
        <Text style={panelStyles.stepHint} testID="route-builder-save-hint">
          {cta.hint}
        </Text>
      ) : null}
      {visibleRouteSaveError ? (
        <Text
          style={styles.errorText}
          accessibilityLiveRegion="assertive"
          testID="route-builder-save-error"
        >
          {visibleRouteSaveError}
        </Text>
      ) : null}
    </View>
  ) : null;
}
