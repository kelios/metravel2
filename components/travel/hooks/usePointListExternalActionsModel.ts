import { useCallback } from 'react';
import { Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { openExternalUrl } from '@/utils/externalLinks';

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
  const onCopy = useCallback(async (coordStr: string) => {
    try {
      if (Platform.OS === 'web' && (navigator as any)?.clipboard) {
        await (navigator as any).clipboard.writeText(coordStr);
      } else {
        await Clipboard.setStringAsync(coordStr);
      }
    } catch {
      return;
    }
  }, []);

  const onShare = useCallback(async (coordStr: string) => {
    const mapUrl = buildMapUrl(coordStr);
    const text = `Координаты: ${coordStr}`;

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
