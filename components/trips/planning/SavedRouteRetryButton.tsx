// components/trips/planning/SavedRouteRetryButton.tsx
// #2065: одна и та же кнопка «Повторить» на обеих поверхностях сохранённого
// маршрута (шапка карты — web/native, строка итога — mobile web). Видимость,
// cooldown и вызов мутации считает `useSavedRouteRetry`; этот компонент —
// только рендер уже готового состояния.
import React from 'react';
import Feather from '@expo/vector-icons/Feather';

import Button from '@/components/ui/Button';
import type { SavedRouteRetryState } from '@/components/trips/planning/useSavedRouteRetry';
import { useThemedColors } from '@/hooks/useTheme';
import { translate as i18nT } from '@/i18n';

interface Props {
  retry: SavedRouteRetryState | null | undefined;
  testID: string;
}

export default function SavedRouteRetryButton({ retry, testID }: Props) {
  const colors = useThemedColors();
  if (!retry?.visible) return null;

  return (
    <Button
      label={i18nT('map:components.MapPage.RoutingStatus.povtorit_a4d0f601')}
      accessibilityLabel={i18nT('map:components.MapPage.RoutingStatus.povtorit_postroenie_marshruta_8f17d9ea')}
      onPress={retry.onPress}
      disabled={retry.disabled}
      loading={retry.pending}
      variant="danger-outline"
      size="sm"
      icon={<Feather name="refresh-cw" size={13} color={colors.danger} />}
      testID={testID}
    />
  );
}
