// services/questGeofencing.native.ts
// Geofencing for quests: registers OS geofence regions around the unfinished
// steps of the active quest. On region ENTER → instant local notification
// ("Вы на месте — откройте загадку"); tap deep-links to the quest.
//
// BUILD-SAFE: the current dev-client ships WITHOUT expo-task-manager. Both
// expo-task-manager AND expo-location are loaded via guarded require — if a
// module isn't in the bundle, every export silently no-ops (never throws), so
// neither the native nor the web bundle breaks. Real device verification comes
// after a new EAS build that adds expo-task-manager.

import { devWarn } from '@/utils/logger';
import { presentLocalQuestNotification } from '@/services/notifications';
import { translate as i18nT } from '@/i18n'


export type GeofenceStep = {
  id: string;
  lat: number;
  lng: number;
  index: number; // 1-based step number for the notification body
  title?: string;
};

const TASK_NAME = 'metravel-quest-geofencing';
const GEOFENCE_RADIUS_M = 50;
const MAX_REGIONS = 20; // OS limit (iOS = 20 monitored regions; Android similar)

// --- Guarded native-module loaders ---------------------------------------
// expo-task-manager is NOT installed yet (added by a later EAS build), so its
// types aren't available — model the slice we use as a local interface. The
// require is guarded: missing module → null → every export no-ops.

type GeofenceTaskBody = {
  data?: { eventType: number; region?: { identifier?: string } };
  error?: { message: string } | null;
};

type TaskManagerModule = {
  defineTask: (name: string, fn: (body: GeofenceTaskBody) => void) => void;
  isTaskRegisteredAsync: (name: string) => Promise<boolean>;
};

type LocationModule = typeof import('expo-location');

let taskManagerCache: TaskManagerModule | null | undefined;
let locationCache: LocationModule | null | undefined;

function getTaskManager(): TaskManagerModule | null {
  if (taskManagerCache !== undefined) return taskManagerCache ?? null;
  try {
    taskManagerCache = require('expo-task-manager') as TaskManagerModule;
  } catch {
    devWarn('[QuestGeofencing] expo-task-manager not available — no-op');
    taskManagerCache = null;
  }
  return taskManagerCache;
}

function getLocation(): LocationModule | null {
  if (locationCache !== undefined) return locationCache ?? null;
  try {
    locationCache = require('expo-location') as LocationModule;
  } catch {
    devWarn('[QuestGeofencing] expo-location not available — no-op');
    locationCache = null;
  }
  return locationCache;
}

// --- Active quest context (read by the background task) -------------------
// The background task runs out-of-band, so it reads the active quest from
// module-level state rather than a closure. Updated on every start().

type ActiveQuest = {
  questId: string;
  cityId: string;
  title: string;
  // regionId (step.id) → { index, title } for building the notification.
  steps: Record<string, { index: number; title?: string }>;
};

let activeQuest: ActiveQuest | null = null;

// Dedup: region ids we've already notified for, so re-entering / GPS jitter
// doesn't spam the same point. Cleared on stop().
const notifiedRegions = new Set<string>();

// --- Top-level task definition -------------------------------------------
// MUST be defined at module top-level (not inside a function) so the OS can
// resolve the task when the app is woken in the background. The defineTask
// call itself is guarded: if expo-task-manager is absent it simply never runs.

(function defineGeofenceTask() {
  const TaskManager = getTaskManager();
  if (!TaskManager) return;

  const Location = getLocation();
  // GeofencingEventType lives on expo-location; without it we can't interpret
  // the event, so skip registration entirely.
  if (!Location) return;

  try {
    TaskManager.defineTask(TASK_NAME, ({ data, error }) => {
      if (error) {
        devWarn('[QuestGeofencing] task error:', error.message);
        return;
      }
      const payload = data;
      if (!payload) return;

      // Only react on ENTER.
      if (payload.eventType !== Location.GeofencingEventType.Enter) return;

      const regionId = payload.region?.identifier;
      if (!regionId) return;

      const quest = activeQuest;
      if (!quest) return;

      const step = quest.steps[regionId];
      if (!step) return;

      if (notifiedRegions.has(regionId)) return;
      notifiedRegions.add(regionId);

      const where = step.title ? ` «${step.title}»` : '';
      void presentLocalQuestNotification(
        `quest-geofence-${quest.questId}-${regionId}`,
        i18nT('shared:services.questGeofencing.vy_na_meste_otkroyte_zagadku_09e0702f'),
        i18nT('shared:services.questGeofencing.vy_podoshli_k_tochke_value1_kvesta_value2_ot_5709191a', { value1: where, value2: quest.title }),
        `${quest.cityId}/${quest.questId}`,
      );
    });
  } catch (e: unknown) {
    devWarn('[QuestGeofencing] defineTask failed:', (e as Error)?.message);
  }
})();

// --- Permission (best-effort) --------------------------------------------

async function ensureBackgroundLocationPermission(
  Location: LocationModule,
): Promise<boolean> {
  try {
    const fg = await Location.getForegroundPermissionsAsync();
    let fgGranted = fg.status === 'granted';
    if (!fgGranted) {
      const req = await Location.requestForegroundPermissionsAsync();
      fgGranted = req.status === 'granted';
    }
    if (!fgGranted) return false;

    const bg = await Location.getBackgroundPermissionsAsync();
    if (bg.status === 'granted') return true;
    const reqBg = await Location.requestBackgroundPermissionsAsync();
    return reqBg.status === 'granted';
  } catch {
    return false;
  }
}

// --- Public API ----------------------------------------------------------

/**
 * Start geofencing around the unfinished steps of a quest. Best-effort:
 * no-op when modules are missing, permission denied, or no valid coordinates.
 * Replaces any previously running quest geofence.
 */
export async function startQuestGeofencing(
  questId: string,
  cityId: string,
  title: string,
  steps: GeofenceStep[],
): Promise<void> {
  const TaskManager = getTaskManager();
  const Location = getLocation();
  if (!TaskManager || !Location) return;

  const valid = steps.filter(
    (s) =>
      Number.isFinite(s.lat) &&
      Number.isFinite(s.lng) &&
      (s.lat !== 0 || s.lng !== 0),
  );
  if (valid.length === 0) {
    await stopQuestGeofencing();
    return;
  }

  const granted = await ensureBackgroundLocationPermission(Location);
  if (!granted) return;

  const regions = valid.slice(0, MAX_REGIONS).map((s) => ({
    identifier: s.id,
    latitude: s.lat,
    longitude: s.lng,
    radius: GEOFENCE_RADIUS_M,
    notifyOnEnter: true,
    notifyOnExit: false,
  }));

  // Publish active context BEFORE starting so an immediate ENTER has data.
  activeQuest = {
    questId,
    cityId,
    title,
    steps: Object.fromEntries(
      valid.map((s) => [s.id, { index: s.index, title: s.title }]),
    ),
  };
  notifiedRegions.clear();

  try {
    // Restart cleanly if a previous quest was being monitored.
    const already = await TaskManager.isTaskRegisteredAsync(TASK_NAME).catch(
      () => false,
    );
    if (already) {
      await Location.stopGeofencingAsync(TASK_NAME).catch(() => {});
    }
    await Location.startGeofencingAsync(TASK_NAME, regions);
  } catch (e: unknown) {
    devWarn('[QuestGeofencing] startGeofencing failed:', (e as Error)?.message);
    activeQuest = null;
  }
}

/**
 * Stop geofencing and clear the active quest context. Safe to call when
 * nothing is running. No-op when modules are missing.
 */
export async function stopQuestGeofencing(): Promise<void> {
  const Location = getLocation();
  activeQuest = null;
  notifiedRegions.clear();
  if (!Location) return;

  try {
    const TaskManager = getTaskManager();
    const registered = TaskManager
      ? await TaskManager.isTaskRegisteredAsync(TASK_NAME).catch(() => false)
      : false;
    if (registered) {
      await Location.stopGeofencingAsync(TASK_NAME);
    }
  } catch {
    // Nothing monitored / module gone — ignore.
  }
}
