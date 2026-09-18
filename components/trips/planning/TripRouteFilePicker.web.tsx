import React, { useCallback, useEffect, useRef } from 'react';
import { View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import ToolActionsRow, { type ToolAction } from '@/components/ui/ToolActionsRow';
import { useThemedColors } from '@/hooks/useTheme';
import { translate as i18nT } from '@/i18n';
import type {
  PickedTripRouteFileUpload,
  TripRouteFilePickerProps,
} from './TripRouteFilePicker.types';

type Props = TripRouteFilePickerProps & {
  compact?: boolean;
  renderToolbar?: (action: ToolAction, extra: React.ReactNode) => React.ReactNode;
};

/**
 * На web выбранный `File` живёт в памяти вкладки и освобождается сборщиком —
 * освобождать нечего. Симметричный экспорт нужен, чтобы панель импорта не знала
 * платформу (#1496).
 */
export const releasePickedTripRouteUpload = async (
  _upload: PickedTripRouteFileUpload | null | undefined,
): Promise<void> => {};

function TripRouteFilePicker({
  label,
  maxBytes,
  disabled = false,
  loading = false,
  onPicked,
  onError,
  onBusyChange,
  compact,
  renderToolbar,
  testID = 'trip-route-import-picker',
}: Props) {
  const colors = useThemedColors();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => () => {
    requestIdRef.current += 1;
  }, []);

  const handlePress = useCallback(() => {
    requestIdRef.current += 1;
    inputRef.current?.click();
  }, []);

  const handleChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0] ?? null;
    const requestId = ++requestIdRef.current;
    let busyRaised = false;

    try {
      if (!file) return;
      onBusyChange?.(true);
      busyRaised = true;
      if (file.size > maxBytes) {
        onError('tooLarge');
        return;
      }
      const text = await file.text();
      if (requestId !== requestIdRef.current) return;
      onPicked({
        name: file.name,
        size: file.size,
        text,
        upload: { kind: 'web', file },
      });
    } catch {
      if (requestId === requestIdRef.current) onError('read');
    } finally {
      if (busyRaised && requestId === requestIdRef.current) onBusyChange?.(false);
      input.value = '';
    }
  }, [maxBytes, onBusyChange, onError, onPicked]);

  const action: ToolAction = {
    key: 'import-route',
    label,
    compactLabel: i18nT('tripsStatic:route.importCompact'),
    icon: <Feather name="upload" size={18} color={colors.text} />,
    onPress: handlePress,
    disabled: disabled || loading,
    loading,
    testID,
  };
  const extra = React.createElement('input', {
    ref: inputRef,
    type: 'file',
    accept: '.gpx,.kml',
    onChange: handleChange,
    'aria-label': label,
    'data-testid': `${testID}-input`,
    style: { display: 'none' },
  });

  if (renderToolbar) {
    return <View>{renderToolbar(action, extra)}</View>;
  }

  return (
    <View>
      {extra}
      <ToolActionsRow actions={[action]} compact={compact} />
    </View>
  );
}

export default React.memo(TripRouteFilePicker);
