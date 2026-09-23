// components/trips/planning/RouteOrderSuggestion.tsx
// #1899: «Предложить оптимальный порядок» в шаге «Точки маршрута». Порядок
// предлагает сервер; черновик меняется только по «Применить», а в поездку
// ничего не пишется до обычного сохранения маршрута.
import React from 'react';
import Feather from '@expo/vector-icons/Feather';
import { Text, View } from 'react-native';

import type { RoutePoint } from '@/api/plannedTrips';
import { ROUTE_ORDER_MAX_POINTS } from '@/api/routeOrderOptimization';
import Button from '@/components/ui/Button';
import type { ThemedColors } from '@/hooks/useTheme';
import { formatInteger } from '@/i18n/format';
import { useTranslation } from '@/i18n/LocaleProvider';
import type { TranslationKey } from '@/i18n/resources';
import type { createStyles } from './RouteBuilder.styles';
import { shouldGroupRouteByDay } from './routePointDays';
import type { RouteOrderAvailability, RouteOrderErrorKind } from './routePointOrder';
import {
  useRouteOrderSuggestion,
  type RouteOrderSuggestionTarget,
} from './useRouteOrderSuggestion';

type RouteBuilderStyles = ReturnType<typeof createStyles>;

interface Props {
  styles: RouteBuilderStyles;
  colors: ThemedColors;
  route: RoutePoint[];
  target: RouteOrderSuggestionTarget;
}

const UNAVAILABLE_HINT_KEYS: Partial<Record<RouteOrderAvailability, TranslationKey>> = {
  tooFew: 'tripsStatic:plan.orderSuggestion.hint.tooFew',
  tooMany: 'tripsStatic:plan.orderSuggestion.hint.tooMany',
  needCoordinates: 'tripsStatic:plan.orderSuggestion.hint.needCoordinates',
};

const ERROR_KEYS: Record<RouteOrderErrorKind, TranslationKey> = {
  offline: 'tripsStatic:plan.orderSuggestion.error.offline',
  timeout: 'tripsStatic:plan.orderSuggestion.error.timeout',
  authRequired: 'tripsStatic:plan.orderSuggestion.error.authRequired',
  invalidRequest: 'tripsStatic:plan.orderSuggestion.error.invalidRequest',
  rateLimited: 'tripsStatic:plan.orderSuggestion.error.rateLimited',
  profileUnsupported: 'tripsStatic:plan.orderSuggestion.error.profileUnsupported',
  incomplete: 'tripsStatic:plan.orderSuggestion.error.incomplete',
  unavailable: 'tripsStatic:plan.orderSuggestion.error.unavailable',
};

export default function RouteOrderSuggestion({ styles, colors, route, target }: Props) {
  const { t } = useTranslation();
  const { availability, status, errorKind, rows, request, apply, dismiss } =
    useRouteOrderSuggestion(route, target);

  if (availability === 'hidden') return null;

  const unavailableHintKey = UNAVAILABLE_HINT_KEYS[availability];
  const fixedEndsHint = t('tripsStatic:plan.orderSuggestion.hint.fixedEnds');

  return (
    <View style={styles.orderSuggestion} testID="route-order-suggestion">
      {status === 'preview' ? (
        <View style={styles.editForm} testID="route-order-preview">
          <Text style={styles.label} accessibilityRole="header">
            {t('tripsStatic:plan.orderSuggestion.preview.title')}
          </Text>
          <Text style={styles.hint}>
            {fixedEndsHint} {t('tripsStatic:plan.orderSuggestion.preview.notAppliedYet')}
          </Text>
          {shouldGroupRouteByDay(route) ? (
            <Text style={styles.hint} testID="route-order-preview-days-hint">
              {t('tripsStatic:plan.orderSuggestion.preview.daysHint')}
            </Text>
          ) : null}
          {rows.map((row) => (
            <View
              key={row.key}
              style={styles.orderPreviewRow}
              testID={`route-order-preview-row-${row.position - 1}`}
            >
              <Text style={styles.pointOrder}>{formatInteger(row.position)}</Text>
              <Text style={styles.orderPreviewName} numberOfLines={1}>
                {row.name}
              </Text>
              {row.moved ? (
                <Text style={styles.orderPreviewWas}>
                  {t('tripsStatic:plan.orderSuggestion.preview.was', {
                    position: formatInteger(row.previousPosition),
                  })}
                </Text>
              ) : null}
            </View>
          ))}
          <View style={styles.editActions}>
            <Button
              label={t('tripsStatic:plan.orderSuggestion.apply')}
              onPress={apply}
              size="sm"
              icon={<Feather name="check" size={16} color={colors.textOnPrimary} />}
              testID="route-order-apply"
            />
            <Button
              label={t('tripsStatic:plan.orderSuggestion.dismiss')}
              onPress={dismiss}
              variant="ghost"
              size="sm"
              testID="route-order-dismiss"
            />
          </View>
        </View>
      ) : (
        // #2053: в колонке телефона (288–332 px) подпись не влезает в строку —
        // она переносится на вторую, а не обрезается многоточием.
        <Button
          label={t('tripsStatic:plan.orderSuggestion.action')}
          onPress={request}
          variant="secondary"
          size="sm"
          labelNumberOfLines={2}
          icon={<Feather name="shuffle" size={16} color={colors.text} />}
          loading={status === 'pending'}
          disabled={availability !== 'ready' || status === 'pending'}
          accessibilityHint={fixedEndsHint}
          testID="route-order-suggest"
        />
      )}
      {unavailableHintKey ? (
        <Text style={styles.hint} testID="route-order-hint">
          {t(unavailableHintKey, { max: formatInteger(ROUTE_ORDER_MAX_POINTS) })}
        </Text>
      ) : null}
      {status === 'unchanged' || status === 'applied' ? (
        <Text style={styles.hint} accessibilityLiveRegion="polite" testID="route-order-notice">
          {t(
            status === 'applied'
              ? 'tripsStatic:plan.orderSuggestion.applied'
              : 'tripsStatic:plan.orderSuggestion.unchanged',
          )}
        </Text>
      ) : null}
      {errorKind ? (
        <Text
          style={styles.errorText}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          testID="route-order-error"
        >
          {t(ERROR_KEYS[errorKind])}
        </Text>
      ) : null}
    </View>
  );
}
