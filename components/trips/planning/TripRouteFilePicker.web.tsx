import React, { useCallback, useEffect, useRef } from 'react';
import { View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import ToolActionsRow from '@/components/ui/ToolActionsRow';
import { useThemedColors } from '@/hooks/useTheme';
import type {
  PickedTripRouteFileUpload,
  TripRouteFilePickerProps,
} from './TripRouteFilePicker.types';

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
  testID = 'trip-route-import-picker',
}: TripRouteFilePickerProps) {
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

  return (
    <View>
      {React.createElement('input', {
        ref: inputRef,
        type: 'file',
        accept: '.gpx,.kml',
        onChange: handleChange,
        'aria-label': label,
        'data-testid': `${testID}-input`,
        style: { display: 'none' },
      })}
      <ToolActionsRow
        actions={[{
          key: 'import-route',
          label,
          icon: <Feather name="upload" size={18} color={colors.text} />,
          onPress: handlePress,
          disabled: disabled || loading,
          loading,
          testID,
        }]}
      />
    </View>
  );
}

export default React.memo(TripRouteFilePicker);
