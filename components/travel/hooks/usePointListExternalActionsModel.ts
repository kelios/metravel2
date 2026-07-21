import { useCallback } from 'react';
import { Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { openExternalUrl } from '@/utils/externalLinks';
import { showToast } from '@/utils/toast';
import { translate as i18nT } from '@/i18n'


type PointLike = {
  articleUrl?: string;
  urlTravel?: string;
};

export function usePointListExternalActionsModel({
  baseUrl,
  buildMapUrl,
  openExternal,
}: {
  baseUrl?: string;
  buildMapUrl: (coordStr: string) => string;
  openExternal: (url: string) => void | Promise<void>;
}) {
  // Копирование — «немое» действие: без тоста непонятно, сработал ли тап.
  // Тексты берём те же, что у карточки точки на карте, чтобы фидбек был единым.
  const onCopy = useCallback(async (coordStr: string) => {
    try {
      if (Platform.OS === 'web' && (navigator as any)?.clipboard) {
        await (navigator as any).clipboard.writeText(coordStr);
      } else {
        await Clipboard.setStringAsync(coordStr);
      }
      void showToast({
        type: 'success',
        text1: i18nT('map:components.UserPoints.UserPointsMapPointMarker.koordinaty_skopirovany_9794ecb0'),
        text2: coordStr,
        position: 'bottom',
        visibilityTime: 2000,
      });
    } catch {
      void showToast({
        type: 'error',
        text1: i18nT('map:components.UserPoints.UserPointsMapPointMarker.ne_udalos_skopirovat_koordinaty_251cf34d'),
        position: 'bottom',
      });
    }
  }, []);

  const onShare = useCallback(async (coordStr: string) => {
    const mapUrl = buildMapUrl(coordStr);
    const text = i18nT('travel:components.travel.hooks.usePointListExternalActionsModel.koordinaty_value1_66e86e9f', { value1: coordStr });

    const tgDeepLinks = [
      `tg://msg_url?url=${encodeURIComponent(mapUrl)}&text=${encodeURIComponent(text)}`,
      `tg://share?text=${encodeURIComponent(`${text}\n${mapUrl}`)}`,
    ];

    if (Platform.OS !== 'web') {
      for (const deeplink of tgDeepLinks) {
        try {
          const opened = await openExternalUrl(deeplink, {
            allowedProtocols: ['http:', 'https:', 'tg:'],
          });
          if (opened) {
            return;
          }
        } catch {
          continue;
        }
      }
    }

    const webShare = `https://t.me/share/url?url=${encodeURIComponent(mapUrl)}&text=${encodeURIComponent(text)}`;
    await openExternal(webShare);
  }, [buildMapUrl, openExternal]);

  const onOpenMap = useCallback((coordStr: string) => {
    const url = buildMapUrl(coordStr);
    if (url) {
      void openExternal(url);
    }
  }, [buildMapUrl, openExternal]);

  const onOpenArticle = useCallback((point: PointLike) => {
    const url = String(point.articleUrl || point.urlTravel || baseUrl || '').trim();
    if (!url) return;
    void openExternal(url);
  }, [baseUrl, openExternal]);

  return {
    onCopy,
    onOpenArticle,
    onOpenMap,
    onShare,
  };
}
