// components/quests/useQuestReturnReminder.native.ts
// Одно локальное напоминание через 7 дней после засчитанного прохождения
// (#1484): «Вы прошли <квест>. Рядом есть ещё N». Разрешение не запрашивается —
// напоминание ставится только тем, кто уведомления уже разрешил.

import { useEffect } from 'react';

import {
  cancelQuestReturnReminder,
  scheduleQuestReturnReminder,
} from '@/services/notifications';
import {
  markQuestReturnReminderScheduled,
  rememberQuestFinish,
} from '@/utils/questReturnVisit';

import type { QuestReturnReminderParams } from './questReturnReminderTypes';

export function useQuestReturnReminder({
  ownerId,
  questId,
  cityId,
  cityName,
  questTitle,
  questCompleted,
  remainingCount,
  completionFinishedAt,
}: QuestReturnReminderParams): void {
  useEffect(() => {
    if (!ownerId || !questId || !cityId || !questCompleted || completionFinishedAt == null) return;
    void (async () => {
      const record = await rememberQuestFinish({
        ownerId,
        questId,
        cityId,
        cityName,
        finishedAt: completionFinishedAt,
      });
      if (!record) return;
      if (remainingCount <= 0) {
        await cancelQuestReturnReminder(ownerId, questId);
        return;
      }
      if (record.reminderScheduledAt) return;
      const scheduled = await scheduleQuestReturnReminder(
        ownerId,
        questId,
        questTitle,
        cityId,
        remainingCount,
      );
      if (scheduled) await markQuestReturnReminderScheduled(record, Date.now());
    })();
  }, [ownerId, questId, cityId, cityName, questCompleted, questTitle, remainingCount, completionFinishedAt]);
}
