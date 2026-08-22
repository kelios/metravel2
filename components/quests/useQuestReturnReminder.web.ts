// components/quests/useQuestReturnReminder.web.ts
// Локальных уведомлений на web нет — возвратное напоминание (#1484) там живёт
// только как e-mail на стороне бэкенда.

import { useEffect } from 'react';

import { rememberQuestFinish } from '@/utils/questReturnVisit';
import type { QuestReturnReminderParams } from './questReturnReminderTypes';

export function useQuestReturnReminder({
  ownerId,
  questId,
  cityId,
  cityName,
  completionFinishedAt,
}: QuestReturnReminderParams): void {
  useEffect(() => {
    if (!ownerId || !questId || completionFinishedAt == null) return;
    void rememberQuestFinish({ ownerId, questId, cityId, cityName, finishedAt: completionFinishedAt });
  }, [ownerId, questId, cityId, cityName, completionFinishedAt]);
}
