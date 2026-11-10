import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import isEqual from 'fast-deep-equal';
import type { TravelFormData } from '@/types/types';
import { addPageHideListener, addVisibilityChangeListener } from '@/utils/beforeunloadGuard';
import { normalizeTravelId } from '@/utils/travelFormUtils';

function ownEnumerableDataEntries(value: object): Array<[string, unknown]> | null {
  try {
    return Object.entries(Object.getOwnPropertyDescriptors(value))
      .filter(([, descriptor]) => descriptor.enumerable && 'value' in descriptor)
      .map(([key, descriptor]) => [key, descriptor.value]);
  } catch {
    // Proxies and host objects may reject descriptor inspection. They are
    // runtime-only values and must not make draft persistence fail.
    return null;
  }
}

function stripUndefinedDeep(value: unknown, ancestors = new WeakSet<object>()): unknown {
  if (Array.isArray(value)) {
    if (ancestors.has(value)) return undefined;
    const entries = ownEnumerableDataEntries(value);
    if (!entries) return undefined;
    ancestors.add(value);
    try {
      return entries
        .filter(([key]) => /^\d+$/.test(key))
        .sort(([left], [right]) => Number(left) - Number(right))
        .map(([, entryValue]) => stripUndefinedDeep(entryValue, ancestors))
        .filter(v => v !== undefined);
    } finally {
      ancestors.delete(value);
    }
  }

  if (value && typeof value === 'object') {
    if (ancestors.has(value)) return undefined;
    const entries = ownEnumerableDataEntries(value);
    if (!entries) return undefined;
    ancestors.add(value);
    try {
      const normalizedEntries = entries
        .map(([k, v]) => [k, stripUndefinedDeep(v, ancestors)] as const)
        .filter(([, v]) => v !== undefined);
      return Object.fromEntries(normalizedEntries);
    } finally {
      ancestors.delete(value);
    }
  }

  return value;
}

// --- Смысловое сравнение черновика с текущими данными -----------------------
// Черновик и серверные данные проходят разные пайплайны нормализации (GET →
// transformTravelToFormData vs upsert-ответ → applySavedData), поэтому полный
// deep-equal всей формы даёт ложные расхождения на серверном шуме: updated_at,
// slug, эхо-поля, id/картинки маркеров, число-vs-строка year и т.п. Диалог
// «восстановить черновик?» должен появляться только когда отличаются поля,
// которые реально редактирует пользователь — сравниваем канонизированную
// проекцию только этих полей.

const DRAFT_TEXT_FIELDS = [
  'name',
  'description',
  'plus',
  'minus',
  'recommendation',
  'youtube_link',
  'budget',
  'year',
  'number_peoples',
  'number_days',
  'visitedDate',
] as const;

// Порядок в мультиселектах не несёт смысла — сортируем.
const DRAFT_ID_LIST_FIELDS = [
  'categories',
  'transports',
  'complexity',
  'companions',
  'over_nights_stay',
  'month',
  'countries',
  'cities',
] as const;

const isTransientLocalUrl = (value: string): boolean =>
  /^(blob:|data:|file:|content:|ph:|assets-library:)/i.test(value);

function comparableText(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : undefined;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('__draft_placeholder__')) return undefined;
  return trimmed;
}

function comparableIdList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const ids = value
    .map((item) => {
      if (item == null) return null;
      if (typeof item === 'object') {
        const rec = item as Record<string, unknown>;
        const raw = rec.id ?? rec.pk ?? rec.value ?? rec.country_id;
        return raw == null ? null : String(raw).trim();
      }
      const str = String(item).trim();
      return str || null;
    })
    .filter((id): id is string => Boolean(id))
    .sort();
  return ids.length > 0 ? ids : undefined;
}

const comparableCoord = (value: unknown): number | undefined => {
  const num = typeof value === 'number' ? value : Number(String(value ?? '').trim());
  // ~6 знаков — сантиметровая точность; хвосты float/строковых конверсий не считаются правкой.
  return Number.isFinite(num) ? Math.round(num * 1e6) / 1e6 : undefined;
};

// Маркер сравниваем по сути (позиция/адрес/категории). id меняется при
// rehydrate после сейва, image гуляет между blob-превью/fallback-обложкой/CDN —
// их различие не означает пользовательскую правку.
function comparableMarkers(value: unknown): unknown[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const markers = value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((marker) => ({
      lat: comparableCoord(marker.lat),
      lng: comparableCoord(marker.lng),
      address: comparableText(marker.address),
      categories: comparableIdList(marker.categories),
    }));
  return markers.length > 0 ? markers : undefined;
}

// Галерея: стабильная идентичность — id, иначе URL без origin (GET и upsert
// могут отдавать разные варианты хоста/миниатюр). blob:/data: превью не
// переживают перезагрузку — игнорируем.
function comparableGallery(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .map((item) => {
      if (item == null) return null;
      if (typeof item === 'string') {
        return isTransientLocalUrl(item) ? null : stripUrlOrigin(item);
      }
      if (typeof item === 'object') {
        const rec = item as Record<string, unknown>;
        if (rec.id != null) return String(rec.id);
        const url = typeof rec.url === 'string' ? rec.url : null;
        return url && !isTransientLocalUrl(url) ? stripUrlOrigin(url) : null;
      }
      return null;
    })
    .filter((id): id is string => Boolean(id))
    .sort();
  return items.length > 0 ? items : undefined;
}

function stripUrlOrigin(url: string): string {
  return url.replace(/^https?:\/\/[^/]+/i, '');
}

function comparableCover(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || isTransientLocalUrl(trimmed)) return undefined;
  return stripUrlOrigin(trimmed);
}

export function extractDraftComparable(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  const rec = data as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const field of DRAFT_TEXT_FIELDS) {
    const normalized = comparableText(rec[field]);
    if (normalized !== undefined) result[field] = normalized;
  }
  for (const field of DRAFT_ID_LIST_FIELDS) {
    const normalized = comparableIdList(rec[field]);
    if (normalized !== undefined) result[field] = normalized;
  }

  const markers = comparableMarkers(rec.coordsMeTravel);
  if (markers !== undefined) result.coordsMeTravel = markers;

  const gallery = comparableGallery(rec.gallery);
  if (gallery !== undefined) result.gallery = gallery;

  const cover = comparableCover(rec.travel_image_thumb_url);
  if (cover !== undefined) result.travel_image_thumb_url = cover;

  if (typeof rec.visa === 'boolean' && rec.visa) result.visa = true;

  return result;
}

function areDraftsEquivalent(left: unknown, right: unknown): boolean {
  return isEqual(extractDraftComparable(left), extractDraftComparable(right));
}

const DRAFT_STORAGE_KEY = 'metravel_travel_draft';
const DRAFT_DEBOUNCE_MS = 2000;
const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface TravelDraftKeyInput {
  ownerId: string | null;
  travelId: string | null;
  isNew: boolean;
  newDraftKind?: 'note';
  newDraftScope?: string;
}

function draftKeySuffix({ travelId, isNew, newDraftKind, newDraftScope }: TravelDraftKeyInput): string | null {
  if (isNew) return `new${newDraftScope ? `_${newDraftScope}` : newDraftKind ? `_${newDraftKind}` : ''}`;
  // For an existing travel the id arrives asynchronously; until it resolves we
  // must not build a `..._null` key (it would orphan the draft under a wrong key).
  return travelId != null ? travelId : null;
}

/**
 * Storage key of a wizard draft. The account is part of the key (#3212): on a
 * shared device another account neither sees nor overwrites this draft.
 */
export function buildTravelDraftKey(input: TravelDraftKeyInput): string | null {
  const suffix = draftKeySuffix(input);
  if (suffix == null || !input.ownerId) return null;
  return `${DRAFT_STORAGE_KEY}_u${encodeURIComponent(input.ownerId)}_${suffix}`;
}

/** Pre-#3212 key without an owner: never shown, only expired after 24 hours. */
function buildLegacyDraftKey(input: TravelDraftKeyInput): string | null {
  const suffix = draftKeySuffix(input);
  return suffix == null ? null : `${DRAFT_STORAGE_KEY}_${suffix}`;
}

function dataTravelId(data: unknown): number | null {
  if (!data || typeof data !== 'object') return null;
  return normalizeTravelId((data as { id?: unknown }).id);
}

/** A snapshot of another article must not be written or compared under this key. */
function belongsToOtherTravel(data: unknown, isNew: boolean, travelId: string | null): boolean {
  if (isNew) return false;
  const id = dataTravelId(data);
  return id != null && id !== normalizeTravelId(travelId);
}

interface PendingDraft {
  key: string;
  data: TravelFormData;
}

interface DraftRecoveryState {
  hasPendingDraft: boolean;
  draftTimestamp: number | null;
  isRecovering: boolean;
  storageError: Error | null;
}

interface UseDraftRecoveryOptions {
  /** Account the draft belongs to; without it no draft is read or written (#3212). */
  ownerId: string | null;
  travelId: string | null;
  isNew: boolean;
  currentData?: TravelFormData | null;
  enabled?: boolean;
  /** Отдельный ключ черновика нового вида записи (#2666: заметка не подхватывает черновик полной статьи). */
  newDraftKind?: 'note';
  newDraftScope?: string;
}

interface UseDraftRecoveryReturn {
  /** Whether a recoverable draft exists */
  hasPendingDraft: boolean;
  /** Timestamp of the pending draft */
  draftTimestamp: number | null;
  /** Recover the draft and return its data */
  recoverDraft: () => Promise<TravelFormData | null>;
  /** Dismiss the pending draft without recovering */
  dismissDraft: () => Promise<void>;
  /** Save current form data as draft */
  saveDraft: (data: TravelFormData) => void;
  /** Clear draft after successful save */
  clearDraft: () => Promise<void>;
  /** Loading state during recovery */
  isRecovering: boolean;
  /** Last local draft write failure; cleared only after a successful draft write. */
  storageError: Error | null;
  /** Persist the newest queued snapshot immediately. False means storage rejected the write. */
  flushDraft: () => Promise<boolean>;
}

/**
 * Hook for managing draft recovery with localStorage/AsyncStorage.
 * Automatically saves form data to storage and provides recovery options.
 */
export function useDraftRecovery(options: UseDraftRecoveryOptions): UseDraftRecoveryReturn {
  const { ownerId, travelId, isNew, currentData, enabled = true, newDraftKind, newDraftScope } = options;

  const [state, setState] = useState<DraftRecoveryState>({
    hasPendingDraft: false,
    draftTimestamp: null,
    isRecovering: false,
    storageError: null,
  });

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());
  const flushPromiseRef = useRef<Promise<boolean> | null>(null);
  const comparedDraftKeyRef = useRef<string | null>(null);
  const prevDraftKeyRef = useRef<{ key: string | null; isNew: boolean } | null>(null);
  // Each snapshot remembers the key it was scheduled for: a timer, flush or
  // unmount write that completes after the editor switched articles must not
  // land under the next article's key (#3212).
  const pendingDraftRef = useRef<PendingDraft | null>(null);
  const currentDataRef = useRef(currentData);
  const keyInput = { ownerId, travelId, isNew, newDraftKind, newDraftScope };
  const draftKey = buildTravelDraftKey(keyInput);
  const legacyDraftKey = buildLegacyDraftKey(keyInput);

  // Check for existing draft on mount
  useEffect(() => {
    if (!enabled) return;
    if (!draftKey) return;
    // Once we've performed the identity comparison against non-empty currentData
    // for this key, there's nothing left to re-check.
    if (comparedDraftKeyRef.current === draftKey) return;
    // The first render after an article switch still carries the previous
    // article's form; comparing against it would decide for the wrong data.
    if (belongsToOtherTravel(currentData, isNew, travelId)) return;

    let cancelled = false;

    const checkForDraft = async () => {
      try {
        if (legacyDraftKey) await expireLegacyDraft(legacyDraftKey);
        if (cancelled) return;
        const storedDraft = await getStorageItem(draftKey);
        if (cancelled) return;
        if (!storedDraft) {
          comparedDraftKeyRef.current = draftKey;
          setState(prev => ({
            ...prev,
            hasPendingDraft: false,
            draftTimestamp: null,
            isRecovering: false,
          }));
          return;
        }

        comparedDraftKeyRef.current = draftKey;

        if (storedDraft) {
          const parsed = JSON.parse(storedDraft);
          if (parsed && parsed.data && parsed.timestamp) {
            // Check if draft is not too old (24 hours)
            const age = Date.now() - parsed.timestamp;
            if (age < DRAFT_MAX_AGE_MS) {
              // If the stored draft is identical to current data, it isn't a recoverable draft.
              // This can happen when we saved drafts during initial load in older versions.
              // This check is the initial storage scan for the key. A draft written later
              // in the same mounted editor is current-session data and must not reopen the
              // recovery dialog after a successful save/rehydrate.
              if (currentData) {
                if (areDraftsEquivalent(stripUndefinedDeep(parsed.data), stripUndefinedDeep(currentData))) {
                  await removeStorageItem(draftKey);
                  if (cancelled) return;
                  setState(prev => ({
                    ...prev,
                    hasPendingDraft: false,
                    draftTimestamp: null,
                    isRecovering: false,
                  }));
                  return;
                }
              }
              setState(prev => ({
                ...prev,
                hasPendingDraft: true,
                draftTimestamp: parsed.timestamp,
                isRecovering: false,
              }));
            } else {
              // Draft is too old, remove it
              await removeStorageItem(draftKey);
            }
          }
        }
      } catch (error) {
        if (!cancelled) console.warn('Failed to check for draft:', error);
      }
    };

    checkForDraft();

    return () => {
      cancelled = true;
    };
  }, [draftKey, legacyDraftKey, enabled, currentData, isNew, travelId]);

  const writeDraft = useCallback((key: string, data: TravelFormData): Promise<boolean> => {
    const draftData = {
      data: stripUndefinedDeep(data),
      timestamp: Date.now(),
    };

    const write = writeQueueRef.current.then(async () => {
      try {
        await setStorageItem(key, JSON.stringify(draftData));
        if (mountedRef.current) {
          setState(prev => prev.storageError ? { ...prev, storageError: null } : prev);
        }
        return true;
      } catch (error) {
        const storageError = error instanceof Error ? error : new Error('Draft storage write failed');
        if (mountedRef.current) {
          setState(prev => ({ ...prev, storageError }));
        }
        console.warn('Failed to save draft:', error);
        return false;
      }
    });

    // Serialize writes so an older AsyncStorage completion cannot overwrite a
    // newer snapshot or clear the newer snapshot's error state.
    writeQueueRef.current = write.then(() => undefined);
    return write;
  }, []);

  // Save draft with debouncing
  const saveDraft = useCallback((data: TravelFormData) => {
    if (!enabled || !draftKey) return;
    if (belongsToOtherTravel(data, isNew, travelId)) return;
    const pending: PendingDraft = { key: draftKey, data };
    pendingDraftRef.current = pending;

    // The active flush loop will observe and persist this newer snapshot before
    // resolving its caller (for example, the expired-session login CTA).
    if (flushPromiseRef.current) return;

    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      void writeDraft(pending.key, pending.data).then((saved) => {
        if (saved && pendingDraftRef.current === pending) {
          pendingDraftRef.current = null;
        }
      });
    }, DRAFT_DEBOUNCE_MS);
  }, [draftKey, enabled, isNew, travelId, writeDraft]);

  const flushDraft = useCallback((): Promise<boolean> => {
    if (!enabled || !draftKey) return Promise.resolve(true);
    if (flushPromiseRef.current) return flushPromiseRef.current;

    const drain = (async () => {
      while (true) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }

        const pendingDraft = pendingDraftRef.current;
        if (!pendingDraft) {
          await writeQueueRef.current;
          return true;
        }

        const saved = await writeDraft(pendingDraft.key, pendingDraft.data);
        if (!saved) return false;

        if (pendingDraftRef.current === pendingDraft) {
          pendingDraftRef.current = null;
          return true;
        }
        // An edit arrived during the await; keep draining until the newest
        // snapshot itself has been written successfully.
      }
    })();

    flushPromiseRef.current = drain;
    void drain.finally(() => {
      if (flushPromiseRef.current === drain) flushPromiseRef.current = null;
    });
    return drain;
  }, [draftKey, enabled, writeDraft]);

  useEffect(() => {
    if (!enabled) return;
    if (Platform.OS !== 'web') return;

    const cleanupPageHide = addPageHideListener(() => {
      void flushDraft();
    });
    const cleanupVisibilityChange = addVisibilityChangeListener(() => {
      void flushDraft();
    });

    return () => {
      cleanupPageHide?.();
      cleanupVisibilityChange?.();
    };
  }, [enabled, flushDraft]);

  useEffect(() => {
    if (!enabled || Platform.OS === 'web') return;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        void flushDraft();
      }
    });
    return () => subscription.remove();
  }, [enabled, flushDraft]);

  // Recover draft
  const recoverDraft = useCallback(async (): Promise<TravelFormData | null> => {
    if (!enabled || !draftKey || !state.hasPendingDraft) return null;

    setState(prev => ({ ...prev, isRecovering: true }));

    try {
      const storedDraft = await getStorageItem(draftKey);
      if (storedDraft) {
        const parsed = JSON.parse(storedDraft);
        if (parsed && parsed.data && parsed.timestamp) {
          setState(prev => ({
            ...prev,
            hasPendingDraft: false,
            draftTimestamp: null,
            isRecovering: false,
          }));
          return parsed.data as TravelFormData;
        }
      }
    } catch (error) {
      console.warn('Failed to recover draft:', error);
    }

    setState(prev => ({ ...prev, isRecovering: false }));
    return null;
  }, [draftKey, enabled, state.hasPendingDraft]);

  // Dismiss draft without recovering
  const dismissDraft = useCallback(async () => {
    if (!draftKey) return;
    try {
      await writeQueueRef.current;
      await removeStorageItem(draftKey);
      setState(prev => ({
        ...prev,
        hasPendingDraft: false,
        draftTimestamp: null,
        isRecovering: false,
      }));
    } catch (error) {
      console.warn('Failed to dismiss draft:', error);
    }
  }, [draftKey]);

  // Clear draft after successful save
  const clearDraft = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    pendingDraftRef.current = null;
    if (!draftKey) return;
    try {
      await writeQueueRef.current;
      await removeStorageItem(draftKey);
      setState(prev => ({
        ...prev,
        hasPendingDraft: false,
        draftTimestamp: null,
        isRecovering: false,
      }));
    } catch (error) {
      console.warn('Failed to clear draft:', error);
    }
  }, [draftKey]);

  // Declared before the key-flip effect so that effect reads this render's data.
  useEffect(() => {
    currentDataRef.current = currentData;
  }, [currentData]);

  // The key changes in two different situations, and only one of them retires
  // the old draft:
  // - a NEW travel got its server id (`_new` -> `_<id>`, F-09): the form on
  //   screen already carries that id and the server has the data, so a draft
  //   left under `_new` would resurface as a false prompt on the next
  //   `/travel/new` — it is dropped;
  // - the reused editor screen switched to another article or the account
  //   changed: the previous draft may be the only copy of offline edits. Its
  //   pending snapshot is written under its own key and the key is kept (#3212).
  useEffect(() => {
    const prev = prevDraftKeyRef.current;
    prevDraftKeyRef.current = { key: draftKey, isNew };
    if (!prev?.key || prev.key === draftKey) return;
    const prevKey = prev.key;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const pending = pendingDraftRef.current;
    pendingDraftRef.current = null;
    setState(prevState => prevState.hasPendingDraft || prevState.draftTimestamp != null
      ? { ...prevState, hasPendingDraft: false, draftTimestamp: null }
      : prevState);

    const newTravelGotItsId = prev.isNew && !isNew && travelId != null &&
      dataTravelId(currentDataRef.current) === normalizeTravelId(travelId);
    if (newTravelGotItsId) {
      void writeQueueRef.current.then(() => removeStorageItem(prevKey));
      return;
    }
    if (pending) void writeDraft(pending.key, pending.data);
  }, [draftKey, isNew, travelId, writeDraft]);

  // Cleanup on unmount. The pending snapshot is written rather than dropped:
  // leaving the screen is exactly when the local draft is the only copy of edits
  // the server has not confirmed. Cancelling the debounce timer without
  // persisting lost everything typed since the last write - and because each
  // keystroke restarts the timer, an author typing continuously never reaches a
  // write at all, so the whole burst was lost. `pendingDraftRef` is null once
  // a save confirmed the data (clearDraft) or after a key flip, so a confirmed
  // form writes nothing here and cannot resurrect a recovery prompt.
  // writeDraft guards its own setState with mountedRef, so a write completing
  // after unmount is safe.
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      const pending = pendingDraftRef.current;
      pendingDraftRef.current = null;
      mountedRef.current = false;
      if (pending) void writeDraft(pending.key, pending.data);
    };
  }, [writeDraft]);

  return useMemo(() => ({
    hasPendingDraft: state.hasPendingDraft,
    draftTimestamp: state.draftTimestamp,
    recoverDraft,
    dismissDraft,
    saveDraft,
    flushDraft,
    clearDraft,
    isRecovering: state.isRecovering,
    storageError: state.storageError,
  }), [state.hasPendingDraft, state.draftTimestamp, recoverDraft, dismissDraft, saveDraft, flushDraft, clearDraft, state.isRecovering, state.storageError]);
}

async function expireLegacyDraft(key: string): Promise<void> {
  try {
    const stored = await getStorageItem(key);
    if (!stored) return;
    let timestamp: unknown;
    try {
      timestamp = (JSON.parse(stored) as { timestamp?: unknown } | null)?.timestamp;
    } catch {
      timestamp = undefined;
    }
    if (typeof timestamp !== 'number' || Date.now() - timestamp >= DRAFT_MAX_AGE_MS) {
      await removeStorageItem(key);
    }
  } catch {
    // A legacy record is never shown; failing to expire it must not block the editor.
  }
}

// Storage abstraction for cross-platform support
async function getStorageItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return AsyncStorage.getItem(key);
}

async function setStorageItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
    return;
  }
  return AsyncStorage.setItem(key, value);
}

async function removeStorageItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore
    }
    return;
  }
  return AsyncStorage.removeItem(key);
}

export default useDraftRecovery;
