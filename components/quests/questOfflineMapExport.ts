import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { buildGpx, downloadTextFileWeb } from '@/utils/routeExport';
import { transliterate } from '@/utils/routeExport/normalize';
import type { LngLat } from '@/utils/routeExport';

import type { QuestStep } from './types';
import {
  buildQuestWalkingRouteGeometry,
  closeQuestRouteLoop,
  getQuestRoutePoints,
  type QuestRouteGeometrySource,
} from './questRouteGeometry';
import { translate as i18nT } from '@/i18n'


export type QuestOfflineMapPoint = Pick<QuestStep, 'lat' | 'lng'> & {
  title?: string;
  location?: string;
};

export type QuestOfflineMapExportOptions = {
  title: string;
  steps: QuestOfflineMapPoint[];
  routeTrack?: LngLat[];
  routeSource?: QuestRouteGeometrySource;
  requireRoutedTrack?: boolean;
  /** Кольцевой квест (тег `loop`): трек замыкается сегментом «финиш → старт». */
  closeLoop?: boolean;
};

// Точки для построения ТРЕКА (с замыканием кольца); waypoint-маркеры в файлах
// всегда строятся из исходных шагов без точки-дубля старта.
const getRouteTrackPoints = (
  steps: QuestOfflineMapPoint[],
  closeLoop?: boolean,
) => {
  const points = getQuestRoutePoints(steps);
  return closeLoop ? closeQuestRouteLoop(points) : points;
};

export const getQuestOfflineMapPoints = (steps: QuestOfflineMapPoint[]) =>
  getQuestRoutePoints(steps);

export const buildQuestOfflineMapGpx = ({
  title,
  steps,
  routeTrack,
  routeSource,
  closeLoop,
}: QuestOfflineMapExportOptions) => {
  const points = getQuestOfflineMapPoints(steps);
  const waypointTrack = getRouteTrackPoints(steps, closeLoop)
    .map((point) => [point.lng, point.lat] as LngLat);
  const routedTrack = Array.isArray(routeTrack) && routeTrack.length >= 2
    ? routeTrack
    : null;
  const fileBase = transliterate(title)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/^-+|-+$/g, '');

  const file = buildGpx({
    name: title,
    description: routedTrack && routeSource === 'routed'
      ? i18nT('quests:components.quests.questOfflineMapExport.peshiy_marshrut_kvesta_metravel_postroennyy__c574db7d')
      : i18nT('quests:components.quests.questOfflineMapExport.tochki_kvesta_metravel_gpx_dlya_importa_v_of_d4cd350a'),
    track: routedTrack ?? waypointTrack,
    waypoints: points.map((point, index) => ({
      name: point.title || point.location || i18nT('quests:components.quests.QuestFullMap.pointFallback', { value1: index + 1 }),
      description: point.location,
      coordinates: [point.lng, point.lat],
    })),
  });

  return {
    ...file,
    filename: `${fileBase || 'quest-offline-map'}.gpx`,
  };
};

export const buildQuestOfflineMapGeoJSON = ({
  title,
  steps,
  routeTrack,
  routeSource,
  closeLoop,
}: QuestOfflineMapExportOptions) => {
  const points = getQuestOfflineMapPoints(steps);
  const waypointTrack = getRouteTrackPoints(steps, closeLoop)
    .map((point) => [point.lng, point.lat] as LngLat);
  const track = Array.isArray(routeTrack) && routeTrack.length >= 2 ? routeTrack : waypointTrack;
  const source = routeTrack && routeSource ? routeSource : 'direct';

  return JSON.stringify(
    {
      type: 'FeatureCollection',
      features: [
        ...points.map((point, index) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [point.lng, point.lat] },
          properties: { order: index + 1, title: point.title || i18nT('quests:components.quests.QuestFullMap.pointFallback', { value1: index + 1 }) },
        })),
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: track,
          },
          properties: {
            name: title || i18nT('quests:components.quests.questOfflineMapExport.defaultRouteTitle'),
            routeSource: source,
            approximate: source !== 'routed',
          },
        },
      ],
    },
    null,
    2,
  );
};

const resolveRoutedTrackForExport = async (
  options: QuestOfflineMapExportOptions,
): Promise<Pick<QuestOfflineMapExportOptions, 'routeTrack' | 'routeSource'> | null> => {
  if (Array.isArray(options.routeTrack) && options.routeTrack.length >= 2) {
    return {
      routeTrack: options.routeTrack,
      routeSource: options.routeSource ?? 'routed',
    };
  }

  const points = getRouteTrackPoints(options.steps, options.closeLoop);
  if (points.length < 2) return {};

  const result = await buildQuestWalkingRouteGeometry(points);
  if (result.source !== 'routed') return null;

  return {
    routeTrack: result.track,
    routeSource: result.source,
  };
};

export async function exportQuestOfflineMap(options: QuestOfflineMapExportOptions): Promise<boolean> {
  const points = getQuestOfflineMapPoints(options.steps);
  if (points.length === 0) return false;

  const requireRoutedTrack = options.requireRoutedTrack ?? true;
  const routed = requireRoutedTrack ? await resolveRoutedTrackForExport(options) : null;
  if (requireRoutedTrack && routed == null) return false;

  const file = buildQuestOfflineMapGpx({ ...options, ...(routed ?? {}) });

  if (Platform.OS === 'web') {
    downloadTextFileWeb(file);
    return true;
  }

  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir || !(await Sharing.isAvailableAsync())) return false;

  const fileUri = `${cacheDir}${file.filename}`;
  await FileSystem.writeAsStringAsync(fileUri, file.content);
  await Sharing.shareAsync(fileUri, {
    mimeType: file.mimeType,
    dialogTitle: i18nT('quests:components.quests.questOfflineMapExport.otkryt_tochki_kvesta_gpx_v_oflayn_kartah_10507e0d'),
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

  const requireRoutedTrack = options.requireRoutedTrack ?? true;
  const routed = requireRoutedTrack ? await resolveRoutedTrackForExport(options) : null;
  if (requireRoutedTrack && routed == null) return false;

  const file = buildQuestOfflineMapGpx({ ...options, ...(routed ?? {}) });

  if (Platform.OS !== 'web') {
    return exportQuestOfflineMap({ ...options, ...(routed ?? {}) });
  }

  if (typeof navigator !== 'undefined' && typeof File !== 'undefined') {
    const nav = navigator as WebShareNavigator;
    const shareFile = new File([file.content], file.filename, { type: file.mimeType });
    if (nav.canShare?.({ files: [shareFile] }) && nav.share) {
      try {
        await nav.share({
          files: [shareFile],
          title: i18nT('quests:components.quests.questOfflineMapExport.tochki_kvesta_gpx_8959135b'),
          text: i18nT('quests:components.quests.questOfflineMapExport.otkroyte_fayl_v_oflayn_kartah_organic_maps_m_477bcbf6'),
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
