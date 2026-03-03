// utils/shareTravel.ts
// AND-23: Native share utility for travel routes.
// Uses expo-sharing (native) or Web Share API (web) to share a travel link.

import { Platform, Share } from 'react-native';

const BASE_URL = 'https://metravel.by';

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
  const url = `${BASE_URL}/travel/${id}`;
  const message = description
    ? `${title}\n\n${description}\n\n${url}`
    : `${title}\n\n${url}`;

  try {
    if (Platform.OS === 'web') {
      // Web Share API
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title, text: description || title, url });
        return true;
      }
      // Fallback: copy to clipboard
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        return true;
      }
      return false;
    }

    // Native: React Native Share API
    const result = await Share.share(
      Platform.OS === 'ios'
        ? { message: title, url }
        : { message, title },
      { dialogTitle: `Поделиться маршрутом «${title}»` },
    );

    return result.action === Share.sharedAction;
  } catch {
    return false;
  }
}

