// utils/shareTravel.ts
// AND-23: Native share utility for travel routes.
// Uses expo-sharing (native) or Web Share API (web) to share a travel link.

import { Platform } from 'react-native';
import { buildCanonicalUrl } from '@/utils/seo';
import { translate as i18nT } from '@/i18n'
import { buildTravelPath } from '@/utils/routePaths'
import { shareOrCopy } from '@/utils/shareOrCopy';


interface ShareTravelParams {
  /** Travel ID or slug */
  id: string | number;
  /** Travel title */
  title: string;
  /** Optional description/meta */
  description?: string;
}

/**
 * AND-23: Share a travel route via native Share Sheet.
 *
 * - On Android/iOS: uses RN Share API (native share sheet with preview)
 * - On web: uses Web Share API (if available), otherwise copies to clipboard
 */
export async function shareTravel({ id, title, description }: ShareTravelParams): Promise<boolean> {
  const safeId = String(id ?? '').trim();
  if (!safeId) return false;
  const path = buildTravelPath(safeId);
  if (!path) return false;
  const url = buildCanonicalUrl(path);
  const message = description
    ? `${title}\n\n${description}\n\n${url}`
    : `${title}\n\n${url}`;

  const outcome = await shareOrCopy({
    web: { title, text: description || title, url },
    native: Platform.OS === 'ios' ? { message: title, url } : { message, title },
    nativeOptions: { dialogTitle: i18nT('shared:utils.shareTravel.podelitsya_marshrutom_value1_3d1ef4de', { value1: title }) },
    copyText: url,
  });
  return outcome === 'shared' || outcome === 'copied';
}
