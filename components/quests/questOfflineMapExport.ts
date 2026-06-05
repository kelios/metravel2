import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { buildGpx, downloadTextFileWeb } from '@/utils/routeExport';

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
  const fileBase = title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/^-+|-+$/g, '');

  const file = buildGpx({
    name: title,
    description: 'Точки квеста Metravel для импорта в офлайн-карту.',
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
    dialogTitle: 'Сохранить точки в офлайн-карту',
    UTI: 'public.xml',
  });

  return true;
}
