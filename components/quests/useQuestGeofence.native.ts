// components/quests/useQuestGeofence.native.ts
// Starts OS geofencing around the UNFINISHED steps of the active quest while
// the quest screen is focused; stops on completion / blur / unmount.
//
// Best-effort and BUILD-SAFE: the underlying service no-ops when
// expo-task-manager / expo-location aren't in the bundle or permission is
// denied. Independent from useQuestReminder (which schedules a 24h "continue"
// reminder) — this fires the instant "you're here" notification on arrival.

import { useEffect, useRef } from 'react';
import { useIsFocused } from 'expo-router';

import {
  startQuestGeofencing,
  stopQuestGeofencing,
  type GeofenceStep,
} from '@/services/questGeofencing';

type QuestStepWithCoords = {
  id: string;
  title?: string;
  lat: number;
  lng: number;
};

type QuestGeofenceParams = {
  questId?: string;
  cityId?: string;
  title: string;
  steps: QuestStepWithCoords[];
  answers: Record<string, string>;
  allCompleted: boolean;
};

/** Build the geofence-region list from steps that aren't answered yet. */
function unfinishedRegions(
  steps: QuestStepWithCoords[],
  answers: Record<string, string>,
): GeofenceStep[] {
  return steps
    .map((step, i) => ({ step, index: i + 1 }))
    .filter(({ step }) => !answers[step.id])
    .map(({ step, index }) => ({
      id: step.id,
      lat: step.lat,
      lng: step.lng,
      index,
      title: step.title,
    }));
}

export function useQuestGeofence({
  questId,
  cityId,
  title,
  steps,
  answers,
  allCompleted,
}: QuestGeofenceParams): void {
  const isFocused = useIsFocused();

  // Latest inputs in a ref so the start effect doesn't re-run on every keystroke
  // (only on focus / completion / step-set change), yet reads fresh answers.
  const stateRef = useRef({ title, steps, answers });
  stateRef.current = { title, steps, answers };

  // Stable signature of which step ids are still unfinished — restart geofence
  // only when the set of pending points actually changes.
  const pendingKey = steps
    .filter((s) => !answers[s.id])
    .map((s) => s.id)
    .join('|');

  useEffect(() => {
    if (!questId || !cityId) return undefined;

    if (!isFocused || allCompleted) {
      void stopQuestGeofencing();
      return undefined;
    }

    const { title: t, steps: s, answers: a } = stateRef.current;
    const regions = unfinishedRegions(s, a);
    if (regions.length === 0) {
      void stopQuestGeofencing();
      return undefined;
    }

    void startQuestGeofencing(questId, cityId, t, regions);
    return undefined;
  }, [questId, cityId, isFocused, allCompleted, pendingKey]);

  // Unmount safety net — stop monitoring when leaving the quest entirely.
  useEffect(() => {
    return () => {
      void stopQuestGeofencing();
    };
  }, []);
}
