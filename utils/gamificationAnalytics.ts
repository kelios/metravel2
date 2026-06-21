// utils/gamificationAnalytics.ts
// Единый слой трекинга геймификации-2 (FE-gamification2-analytics). Типизированные
// обёртки над sendAnalyticsEvent — вызываются из компонентов/хуков один раз на событие,
// чтобы не дублировать вызовы. Покрывают KPI спринта (earners %, D7/D30 retention).
// Согласие на аналитику проверяется внутри sendAnalyticsEvent.

import { sendAnalyticsEvent } from '@/utils/analytics';
import type { ActivityKind, CharacterPathSlug } from '@/api/gamification';

/** Получен бейдж первооткрывателя места. */
export const trackPlaceFirstBadgeEarned = (params: {
  placeId: number;
  placeName: string;
  date: string;
}): void => {
  void sendAnalyticsEvent('place_first_badge_earned', {
    place_id: params.placeId,
    place_name: params.placeName,
    discovered_at: params.date,
  });
};

/** Повышение уровня в линейке прогрессии. */
export const trackProgressionLevelUp = (params: {
  lineSlug: string;
  activityKind: ActivityKind;
  newLevel: number;
}): void => {
  void sendAnalyticsEvent('progression_level_up', {
    line_slug: params.lineSlug,
    activity_kind: params.activityKind,
    new_level: params.newLevel,
  });
};

/** Выбран путь развития персонажа. */
export const trackPathChosen = (params: {
  pathSlug: CharacterPathSlug;
  characterLevel: number;
}): void => {
  void sendAnalyticsEvent('path_chosen', {
    path_slug: params.pathSlug,
    character_level: params.characterLevel,
  });
};

/** Просмотрен блок персонажа в профиле. */
export const trackCharacterBlockViewed = (params: {
  context: 'own' | 'public';
  pendingChoice: boolean;
}): void => {
  void sendAnalyticsEvent('character_block_viewed', {
    context: params.context,
    pending_choice: params.pendingChoice,
  });
};

// ── Шаринг достижений (Sprint 12, #458) ──────────────────────────────────────
// Атрибуция вирусной петли. Payload без PII: только id/slug/канал достижения.

/** Открыт лист «Поделиться» на медали/награде. */
export const trackBadgeShareOpened = (params: {
  achievementId: number;
  slug: string;
  isRare: boolean;
  context: 'profile' | 'detail' | 'card';
}): void => {
  void sendAnalyticsEvent('badge_share_opened', {
    achievement_id: params.achievementId,
    achievement_slug: params.slug,
    is_rare: params.isRare,
    context: params.context,
  });
};

/** Пользователь поделился медалью в конкретном канале. */
export const trackBadgeShared = (params: {
  achievementId: number;
  slug: string;
  channel: string;
  template: 'default' | 'rare';
}): void => {
  void sendAnalyticsEvent('badge_shared', {
    achievement_id: params.achievementId,
    achievement_slug: params.slug,
    channel: params.channel,
    template: params.template,
  });
};

/** Клик по расшаренной карточке (открытие публичной ссылки достижения). */
export const trackShareCardClick = (params: {
  achievementId: number;
  slug: string;
  channel: string;
}): void => {
  void sendAnalyticsEvent('share_card_click', {
    achievement_id: params.achievementId,
    achievement_slug: params.slug,
    channel: params.channel,
  });
};
