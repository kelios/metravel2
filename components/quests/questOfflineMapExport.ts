import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { buildGpx, downloadTextFileWeb } from '@/utils/routeExport';
import { transliterate } from '@/utils/routeExport/normalize';

import type { QuestStep } from './types';

export type QuestOfflineMapPoint = Pick<QuestStep, 'lat' | 'lng'> & {
  title?: string;
  location?: string;
};

export type QuestOfflineMapExportOptions = {
  title: string;
  steps: QuestOfflineMapPoint[];
};

export const getQuestOfflineMapPoints = (steps: QuestOfflineMapPoint[]) =>
  steps.filter((step) => Number.isFinite(step.lat) && Number.isFinite(step.lng) && (step.lat !== 0 || step.lng !== 0));

export const buildQuestOfflineMapGpx = ({ title, steps }: QuestOfflineMapExportOptions) => {
  const points = getQuestOfflineMapPoints(steps);
  const fileBase = transliterate(title)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/^-+|-+$/g, '');

  const file = buildGpx({
    name: title,
    description: 'Точки квеста Metravel (GPX) для импорта в офлайн-карты (Organic Maps, Maps.me).',
    track: points.map((point) => [point.lng, point.lat]),
    waypoints: points.map((point, index) => ({
      name: point.title || point.location || `Точка ${index + 1}`,
      description: point.location,
      coordinates: [point.lng, point.lat],
    })),
  });

  return {
    ...file,
    filename: `${fileBase || 'quest-offline-map'}.gpx`,
  };
};

export async function exportQuestOfflineMap(options: QuestOfflineMapExportOptions): Promise<boolean> {
  const points = getQuestOfflineMapPoints(options.steps);
  if (points.length === 0) return false;

  const file = buildQuestOfflineMapGpx(options);

  if (Platform.OS === 'web') {
    downloadTextFileWeb(file);
    return true;
  }

  const cacheDir =
    (FileSystem as { cacheDirectory?: string }).cacheDirectory ??
    String((FileSystem as any).Paths?.cache?.uri ?? '');

  if (!cacheDir || !(await Sharing.isAvailableAsync())) return false;

  const fileUri = `${cacheDir}${file.filename}`;
  await FileSystem.writeAsStringAsync(fileUri, file.content);
  await Sharing.shareAsync(fileUri, {
    mimeType: file.mimeType,
    dialogTitle: 'Открыть точки квеста (GPX) в офлайн-картах',
    UTI: 'com.topografix.gpx',
  });

  return true;
}

type WebShareNavigator = Navigator & {
  share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
  canShare?: (data: { files?: File[] }) => boolean;
};

export async function openQuestOfflineMapInApp(options: QuestOfflineMapExportOptions): Promise<boolean> {
  const points = getQuestOfflineMapPoints(options.steps);
  if (points.length === 0) return false;

  const file = buildQuestOfflineMapGpx(options);

  if (Platform.OS !== 'web') {
    return exportQuestOfflineMap(options);
  }

  if (typeof navigator !== 'undefined' && typeof File !== 'undefined') {
    const nav = navigator as WebShareNavigator;
    const shareFile = new File([file.content], file.filename, { type: file.mimeType });
    if (nav.canShare?.({ files: [shareFile] }) && nav.share) {
      try {
        await nav.share({
          files: [shareFile],
          title: 'Точки квеста (GPX)',
          text: 'Откройте файл в офлайн-картах (Organic Maps, Maps.me).',
        });
        return true;
      } catch {
        // Пользователь отменил шеринг или системное «Поделиться» недоступно — падаем на скачивание.
      }
    }
  }

  downloadTextFileWeb(file);
  return true;
}
