// components/quests/useQuestReminder.native.ts
// Schedules a local "continue your quest" reminder when the user leaves a
// quest with progress but hasn't finished it; cancels on completion / re-entry.
// Best-effort: silently skipped if notification permission is denied.

import { useEffect, useRef } from 'react';
import { useIsFocused } from 'expo-router';

import { scheduleQuestReminder, cancelQuestReminder } from '@/services/notifications';

type QuestReminderParams = {
  questId?: string;
  cityId?: string;
  title: string;
  completedCount: number;
  totalCount: number;
  allCompleted: boolean;
};

export function useQuestReminder({
  questId,
  cityId,
  title,
  completedCount,
  totalCount,
  allCompleted,
}: QuestReminderParams): void {
  const isFocused = useIsFocused();

  // Keep latest progress in a ref so the unmount/blur cleanup reads fresh values
  // without re-subscribing on every answer.
  const stateRef = useRef({ completedCount, totalCount, allCompleted, title });
  stateRef.current = { completedCount, totalCount, allCompleted, title };

  // On focus / completion: cancel any pending reminder (user is here / done — don't nag).
  useEffect(() => {
    if (!questId) return;
    if (isFocused || allCompleted) {
      void cancelQuestReminder(questId);
    }
  }, [questId, isFocused, allCompleted]);

  // On leaving the screen (blur or unmount): if started-but-unfinished, schedule.
  useEffect(() => {
    if (!questId || !cityId) return;
    if (isFocused) return undefined;

    // Effect runs when isFocused flips to false → schedule using fresh ref state.
    const { completedCount: done, totalCount: total, allCompleted: finished, title: questTitle } =
      stateRef.current;
    if (!finished && done > 0 && total > 0) {
      void scheduleQuestReminder(questId, questTitle, done, total, `${cityId}/${questId}`);
    }
    return undefined;
  }, [questId, cityId, isFocused]);

  // Unmount safety net (navigating away that doesn't toggle focus first).
  useEffect(() => {
    return () => {
      if (!questId || !cityId) return;
      const { completedCount: done, totalCount: total, allCompleted: finished, title: questTitle } =
        stateRef.current;
      if (!finished && done > 0 && total > 0) {
        void scheduleQuestReminder(questId, questTitle, done, total, `${cityId}/${questId}`);
      }
    };
  }, [questId, cityId]);
}
