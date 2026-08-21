import React, { useCallback, useEffect, useRef } from 'react';
import { View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

import ToolActionsRow from '@/components/ui/ToolActionsRow';
import { useThemedColors } from '@/hooks/useTheme';
import type { TripRouteFilePickerProps } from './TripRouteFilePicker.types';

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
  const requestIdRef = useRef(0);

  useEffect(() => () => {
    requestIdRef.current += 1;
  }, []);

  const handlePress = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    let temporaryUri: string | null = null;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/gpx+xml', 'application/vnd.google-earth.kml+xml', 'text/xml', '*/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const uri = String(asset.uri ?? '');
      const size = typeof asset.size === 'number' ? asset.size : null;
      const cacheDirectory = String(FileSystem.cacheDirectory ?? '');
      if (cacheDirectory && uri.startsWith(cacheDirectory)) temporaryUri = uri;
      if (requestId !== requestIdRef.current) return;

      onBusyChange?.(true);

      if (size != null && size > maxBytes) {
        onError('tooLarge');
        return;
      }

      const text = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      if (requestId !== requestIdRef.current) return;

      onPicked({
        name: String(asset.name ?? 'route-file').trim() || 'route-file',
        size,
        text,
      });
    } catch {
      if (requestId === requestIdRef.current) onError('read');
    } finally {
      if (requestId === requestIdRef.current) onBusyChange?.(false);
      if (temporaryUri) {
        await FileSystem.deleteAsync(temporaryUri, { idempotent: true }).catch(() => undefined);
      }
    }
  }, [maxBytes, onBusyChange, onError, onPicked]);

  return (
    <View>
      <ToolActionsRow
        actions={[{
          key: 'import-route',
          label,
          icon: <Feather name="upload" size={18} color={colors.text} />,
          onPress: () => { void handlePress(); },
          disabled: disabled || loading,
          loading,
          testID,
        }]}
      />
    </View>
  );
}

export default React.memo(TripRouteFilePicker);
