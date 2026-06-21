// api/achievementsShare.ts
// Слой share-карточек достижений (Sprint 12 «Шаринг достижений», тикеты борда
// #382/#384). Контракт зеркалит FE-API-контракт #382: create share-card →
// { share_token, image_url, public_url, expires_at }. Пока BE-badge-share-card
// (#382) не задеплоен — отдаём dev-мок тем же фолбэком, что и остальные ачивки
// (api/achievements.ts). Мок-карточка достаточна для прогона share-flow в превью;
// прод-Done требует реального image_url с таргета (см. Task Contract #384).

import { apiClient, ApiError } from '@/api/client';
import { devWarn } from '@/utils/logger';
import { getSiteBaseUrl } from '@/utils/seo';

export type ShareCardTemplate = 'default' | 'rare';

export interface ShareCardUtm {
  source?: string;
  medium?: string;
  campaign?: string;
}

export interface CreateShareCardInput {
  achievementId: number;
  template?: ShareCardTemplate;
  utm?: ShareCardUtm;
}

/** Нормализованная share-карточка (camelCase). */
export interface ShareCard {
  shareToken: string;
  imageUrl: string;
  /** Публичный URL достижения (#383). null, если per-medal URL ещё не включён. */
  publicUrl: string | null;
  expiresAt: string | null;
}

interface ShareCardDto {
  share_token?: string | null;
  image_url?: string | null;
  public_url?: string | null;
  expires_at?: string | null;
}

const mapShareCard = (dto: ShareCardDto): ShareCard => ({
  shareToken: dto.share_token ?? '',
  imageUrl: dto.image_url ?? '',
  publicUrl: dto.public_url ?? null,
  expiresAt: dto.expires_at ?? null,
});

// ── Мок-фолбэк (до готовности BE #382) ──────────────────────────────────────
// Тот же контракт, что и в api/achievements.ts: под флагом или при 404/501/0 в DEV.

const USE_MOCK = process.env.EXPO_PUBLIC_ACHIEVEMENTS_MOCK === 'true';

const shouldFallbackToMock = (error: unknown): boolean => {
  if (USE_MOCK) return true;
  if (!__DEV__) return false;
  return error instanceof ApiError && [0, 404, 501].includes(error.status);
};

/** Dev-мок: статичный плейсхолдер карточки + публичный URL по id достижения. */
const buildMockShareCard = (input: CreateShareCardInput): ShareCard => {
  const base = getSiteBaseUrl();
  return {
    shareToken: `mock-${input.achievementId}`,
    // Карточку рисует сервер (#382) — в моке отдаём og-плейсхолдер сайта.
    imageUrl: `${base}/og-image.jpg`,
    publicUrl: `${base}/achievements/${input.achievementId}`,
    expiresAt: null,
  };
};

/**
 * Создаёт share-карточку достижения. Возвращает image_url (для скачивания/нативного
 * шаринга) и public_url (для копирования прямой ссылки). UTM прокидываются в тело,
 * чтобы сервер мог вшить их в og:url карточки; FE-атрибуция (#458) дополнительно
 * навешивает UTM на сам публичный URL при копировании/шаринге.
 */
export async function createShareCard(
  input: CreateShareCardInput,
): Promise<ShareCard> {
  if (USE_MOCK) return buildMockShareCard(input);

  const body = {
    achievement_id: input.achievementId,
    ...(input.template ? { template: input.template } : {}),
    ...(input.utm ? { utm: input.utm } : {}),
  };

  try {
    const dto = await apiClient.post<ShareCardDto>(
      '/achievements/share-cards/',
      body,
    );
    return mapShareCard(dto);
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[achievements] share-card → mock fallback');
      return buildMockShareCard(input);
    }
    throw error;
  }
}
