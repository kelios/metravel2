// api/questsShare.ts
// Слой share-карточек РЕЗУЛЬТАТА квеста ([INV2-02], тикет борда #1472). Зеркалит
// контракт share-карточек достижений (api/achievementsShare.ts, #382): создаём
// карточку → { share_token, image_url, story_image_url, public_url, expires_at }.
// Картинку-диплом (1200×630 для OG и 1080×1920 для сторис) и публичную страницу
// результата рисует и раздаёт СЕРВЕР — тот же генератор, что и у достижений
// (переиспользование по постановке #1472, не второй параллельный). Пока бэкенд-
// эндпоинт `/quests/result-cards/` не задеплоен, в DEV отдаём тот же мок-фолбэк,
// что и у достижений; в проде до готовности BE карточка недоступна, и лист
// шаринга деградирует до шаринга ссылки на квест (см. ShareQuestResultSheet).

import { apiClient, ApiError } from '@/api/client';
import { resolveDevMockFlag } from '@/utils/devMockFlags';
import { devWarn } from '@/utils/logger';
import { getSiteBaseUrl } from '@/utils/seo';
import type { QuestResultUtm } from '@/utils/questResultShare';

export interface CreateQuestResultCardInput {
  /** Числовой id квеста — ключ, по которому сервер берёт данные квеста. */
  questId: number;
  /** Slug квеста — для кампании UTM и человекочитаемого имени файла. */
  questSlug: string;
  /** Необязательное имя героя на дипломе. Пустое — генерация не падает (#1472). */
  heroName?: string;
  /** Сколько точек пройдено и сколько всего — для строки на дипломе. */
  pointsDone: number;
  pointsTotal: number;
  /** Момент завершения (epoch ms) — для даты на дипломе. */
  finishedAt?: number | null;
  utm?: QuestResultUtm;
}

/** Нормализованная карточка результата (camelCase). */
export interface QuestResultCard {
  shareToken: string;
  /** OG-картинка 1200×630 (превью в мессенджерах и для скачивания). */
  imageUrl: string;
  /** Вертикальная картинка 1080×1920 для Instagram Stories. Пусто — нет отдельной. */
  storyImageUrl: string;
  /** Публичная страница результата `/quests/result/<id>`. null — ещё не включена. */
  publicUrl: string | null;
  expiresAt: string | null;
}

interface QuestResultCardDto {
  share_token?: string | null;
  image_url?: string | null;
  story_image_url?: string | null;
  public_url?: string | null;
  expires_at?: string | null;
}

const mapQuestResultCard = (dto: QuestResultCardDto): QuestResultCard => ({
  shareToken: dto.share_token ?? '',
  imageUrl: dto.image_url ?? '',
  storyImageUrl: dto.story_image_url ?? '',
  publicUrl: dto.public_url ?? null,
  expiresAt: dto.expires_at ?? null,
});

// ── Мок-фолбэк (до готовности BE `/quests/result-cards/`) ────────────────────
// Тот же контракт и та же дисциплина, что и у достижений: под флагом или при
// 404/501/0 в DEV. resolveDevMockFlag бросает в проде, если флаг случайно включат.

const USE_MOCK = resolveDevMockFlag({
  name: 'EXPO_PUBLIC_QUEST_SHARE_MOCK',
  value: process.env.EXPO_PUBLIC_QUEST_SHARE_MOCK,
});

const shouldFallbackToMock = (error: unknown): boolean => {
  if (USE_MOCK) return true;
  if (!__DEV__) return false;
  return error instanceof ApiError && [0, 404, 501].includes(error.status);
};

/** Dev-мок: og-плейсхолдер сайта вместо серверного диплома + мок-URL результата. */
const buildMockQuestResultCard = (
  input: CreateQuestResultCardInput,
): QuestResultCard => {
  const base = getSiteBaseUrl();
  return {
    shareToken: `mock-${input.questId}`,
    imageUrl: `${base}/og-image.jpg`,
    storyImageUrl: `${base}/og-image.jpg`,
    publicUrl: `${base}/quests/result/mock-${input.questId}`,
    expiresAt: null,
  };
};

/**
 * Создаёт карточку-диплом результата квеста. Возвращает image_url/story_image_url
 * (для скачивания и нативного шаринга) и public_url (страница результата с og).
 * UTM прокидываются в тело, чтобы сервер вшил их в og:url карточки; FE-атрибуция
 * дополнительно навешивает UTM на публичный URL при копировании/шаринге.
 *
 * Важно: карточка — это УЛУЧШЕНИЕ. Вызывающий (ShareQuestResultSheet) обязан
 * пережить отказ и остаться работоспособным на шаринге ссылки, поэтому здесь
 * ошибка пробрасывается наверх, а не маскируется пустой карточкой.
 */
export async function createQuestResultCard(
  input: CreateQuestResultCardInput,
): Promise<QuestResultCard> {
  if (USE_MOCK) return buildMockQuestResultCard(input);

  const body = {
    quest_id: input.questId,
    quest_slug: input.questSlug,
    points_done: input.pointsDone,
    points_total: input.pointsTotal,
    ...(input.heroName ? { hero_name: input.heroName } : {}),
    ...(input.finishedAt ? { finished_at: Math.round(input.finishedAt / 1000) } : {}),
    ...(input.utm ? { utm: input.utm } : {}),
  };

  try {
    const dto = await apiClient.post<QuestResultCardDto>(
      '/quests/result-cards/',
      body,
    );
    return mapQuestResultCard(dto);
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[quests] result-card → mock fallback');
      return buildMockQuestResultCard(input);
    }
    throw error;
  }
}
