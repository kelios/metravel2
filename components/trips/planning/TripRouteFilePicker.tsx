import React, { useCallback, useEffect, useRef } from 'react';
import { View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

import ToolActionsRow from '@/components/ui/ToolActionsRow';
import { useThemedColors } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n/LocaleProvider';
import type {
  PickedTripRouteFileUpload,
  TripRouteFilePickerProps,
} from './TripRouteFilePicker.types';

// Файл, выбранный document-picker'ом, живёт во временной копии, которую пикер
// удаляет сразу после чтения. Фазе 2 (#1496) он нужен дольше: тот же файл
// уходит на бэкенд как оригинал маршрута. Поэтому выбранный файл переносится в
// собственный подкаталог кэша, а панель импорта освобождает его через
// `releasePickedTripRouteUpload`, когда импорт применён или отменён.
const IMPORT_CACHE_DIR = 'trip-route-import/';
let importCacheSequence = 0;

const safeFileName = (name: string): string => {
  const base = name.split(/[\\/]/).pop() ?? '';
  const cleaned = base.replace(/[^\w.-]+/g, '_').replace(/^\.+/, '');
  return cleaned || 'route-file';
};

const guessMimeType = (name: string): string | undefined => {
  const ext = name.toLowerCase().split('.').pop();
  if (ext === 'gpx') return 'application/gpx+xml';
  if (ext === 'kml') return 'application/vnd.google-earth.kml+xml';
  return undefined;
};

/** Удаляет кэш-копию выбранного файла. Безопасна для повторного вызова. */
export const releasePickedTripRouteUpload = async (
  upload: PickedTripRouteFileUpload | null | undefined,
): Promise<void> => {
  if (upload?.kind !== 'native') return;
  await FileSystem.deleteAsync(upload.uri, { idempotent: true }).catch(() => undefined);
};

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
  const { t } = useTranslation();
  const requestIdRef = useRef(0);

  useEffect(() => () => {
    requestIdRef.current += 1;
  }, []);

  const handlePress = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    let temporaryUri: string | null = null;
    let retainedUri: string | null = null;
    let busyRaised = false;

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
      busyRaised = true;

      if (size != null && size > maxBytes) {
        onError('tooLarge');
        return;
      }

      const text = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      if (requestId !== requestIdRef.current) return;

      const name = String(asset.name ?? 'route-file').trim() || 'route-file';
      const cacheDir = String(FileSystem.cacheDirectory ?? '');
      if (!cacheDir) throw new Error('Route import cache is unavailable');
      // Без стабильной копии оригинал не пережил бы этот же `finally` и загружать
      // на бэкенд было бы нечего.
      // Имя уникально не только внутри одного picker instance: две панели или
      // повторный выбор `route.gpx` не должны перетирать файл, право владения
      // которым уже перешло RouteBuilder до следующего сохранения.
      const targetUri = `${cacheDir}${IMPORT_CACHE_DIR}${Date.now()}-${++importCacheSequence}-${safeFileName(name)}`;
      await FileSystem.makeDirectoryAsync(`${cacheDir}${IMPORT_CACHE_DIR}`, {
        intermediates: true,
      }).catch(() => undefined);
      retainedUri = targetUri;
      await FileSystem.copyAsync({ from: uri, to: targetUri });
      if (requestId !== requestIdRef.current) {
        return;
      }

      onPicked({
        name,
        size,
        text,
        upload: {
          kind: 'native',
          uri: targetUri,
          name,
          mimeType: guessMimeType(name),
        },
      });
      // После callback кэш-копией владеет вызывающий компонент.
      retainedUri = null;
    } catch {
      if (requestId === requestIdRef.current) onError('read');
    } finally {
      if (busyRaised && requestId === requestIdRef.current) onBusyChange?.(false);
      if (retainedUri) {
        await FileSystem.deleteAsync(retainedUri, { idempotent: true }).catch(() => undefined);
      }
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
          compactLabel: t('tripsStatic:route.importCompact'),
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
