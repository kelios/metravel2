import React, { useCallback, useEffect, useRef } from 'react';
import { View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import ToolActionsRow, { type ToolAction } from '@/components/ui/ToolActionsRow';
import { useThemedColors } from '@/hooks/useTheme';
import type {
  PickedTripRouteFileUpload,
  TripRouteFilePickerProps,
} from './TripRouteFilePicker.types';

type Props = TripRouteFilePickerProps & {
  /** Кнопка занимает ряд целиком (блок «Файл маршрута», #2053). */
  fill?: boolean;
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
  fill,
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

  // Импорт подписан полной подписью на любой ширине: icon-only кнопка была
  // непонятна (#1789), а короткое «Импорт» в сжатом ряду обрезалось (#2053).
  return (
    <View>
      {extra}
      <ToolActionsRow actions={[action]} compact={false} fill={fill} />
    </View>
  );
}

export default React.memo(TripRouteFilePicker);
