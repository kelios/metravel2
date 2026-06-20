import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import isEqual from 'fast-deep-equal';
import type { TravelFormData } from '@/types/types';
import { addPageHideListener, addVisibilityChangeListener } from '@/utils/beforeunloadGuard';

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(v => stripUndefinedDeep(v)) as T;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, stripUndefinedDeep(v)]);
    return Object.fromEntries(entries) as T;
  }

  return value;
}

const DRAFT_STORAGE_KEY = 'metravel_travel_draft';
const DRAFT_DEBOUNCE_MS = 2000;

interface DraftRecoveryState {
  hasPendingDraft: boolean;
  draftTimestamp: number | null;
  isRecovering: boolean;
}

interface UseDraftRecoveryOptions {
  travelId: string | null;
  isNew: boolean;
  currentData?: TravelFormData | null;
  enabled?: boolean;
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
}

/**
 * Hook for managing draft recovery with localStorage/AsyncStorage.
 * Automatically saves form data to storage and provides recovery options.
 */
export function useDraftRecovery(options: UseDraftRecoveryOptions): UseDraftRecoveryReturn {
  const { travelId, isNew, currentData, enabled = true } = options;

  const [state, setState] = useState<DraftRecoveryState>({
    hasPendingDraft: false,
    draftTimestamp: null,
    isRecovering: false,
  });

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const comparedDraftKeyRef = useRef<string | null>(null);
  const prevDraftKeyRef = useRef<string | null>(null);
  const pendingDraftDataRef = useRef<TravelFormData | null>(null);
  // For an existing travel the id arrives asynchronously; until it resolves we
  // must not build a `..._null` key (it would orphan the draft under a wrong key).
  const draftKey = isNew
    ? `${DRAFT_STORAGE_KEY}_new`
    : travelId != null
      ? `${DRAFT_STORAGE_KEY}_${travelId}`
      : null;

  // Check for existing draft on mount
  useEffect(() => {
    if (!enabled) return;
    if (!draftKey) return;
    // Once we've performed the identity comparison against non-empty currentData
    // for this key, there's nothing left to re-check.
    if (comparedDraftKeyRef.current === draftKey) return;

    let cancelled = false;

    const checkForDraft = async () => {
      try {
        const storedDraft = await getStorageItem(draftKey);
        if (cancelled) return;
        if (storedDraft) {
          const parsed = JSON.parse(storedDraft);
          if (parsed && parsed.data && parsed.timestamp) {
            // Check if draft is not too old (24 hours)
            const maxAge = 24 * 60 * 60 * 1000;
            const age = Date.now() - parsed.timestamp;
            if (age < maxAge) {
              // If the stored draft is identical to current data, it isn't a recoverable draft.
              // This can happen when we saved drafts during initial load in older versions.
              // currentData arrives asynchronously (React Query), so only mark the comparison
              // as done once we actually have it.
              if (currentData) {
                comparedDraftKeyRef.current = draftKey;
                if (isEqual(stripUndefinedDeep(parsed.data), stripUndefinedDeep(currentData))) {
                  await removeStorageItem(draftKey);
                  if (cancelled) return;
                  setState({
                    hasPendingDraft: false,
                    draftTimestamp: null,
                    isRecovering: false,
                  });
                  return;
                }
              }
              setState({
                hasPendingDraft: true,
                draftTimestamp: parsed.timestamp,
                isRecovering: false,
              });
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
  }, [draftKey, enabled, currentData]);

  // Save draft with debouncing
  const saveDraft = useCallback((data: TravelFormData) => {
    if (!enabled || !draftKey) return;
    pendingDraftDataRef.current = data;

    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const draftData = {
          data: stripUndefinedDeep(data),
          timestamp: Date.now(),
        };
        await setStorageItem(draftKey, JSON.stringify(draftData));
      } catch (error) {
        console.warn('Failed to save draft:', error);
      }
    }, DRAFT_DEBOUNCE_MS);
  }, [draftKey, enabled]);

  const flushDraft = useCallback(async () => {
    if (!enabled || !draftKey) return;
    if (Platform.OS !== 'web') return;
    if (!pendingDraftDataRef.current) return;

    try {
      const draftData = {
        data: stripUndefinedDeep(pendingDraftDataRef.current),
        timestamp: Date.now(),
      };
      await setStorageItem(draftKey, JSON.stringify(draftData));
    } catch (error) {
      console.warn('Failed to flush draft:', error);
    }
  }, [draftKey, enabled]);

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

  // Recover draft
  const recoverDraft = useCallback(async (): Promise<TravelFormData | null> => {
    if (!enabled || !draftKey || !state.hasPendingDraft) return null;

    setState(prev => ({ ...prev, isRecovering: true }));

    try {
      const storedDraft = await getStorageItem(draftKey);
      if (storedDraft) {
        const parsed = JSON.parse(storedDraft);
        if (parsed && parsed.data && parsed.timestamp) {
          setState({
            hasPendingDraft: false,
            draftTimestamp: null,
            isRecovering: false,
          });
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
      await removeStorageItem(draftKey);
      setState({
        hasPendingDraft: false,
        draftTimestamp: null,
        isRecovering: false,
      });
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
    pendingDraftDataRef.current = null;
    if (!draftKey) return;
    try {
      await removeStorageItem(draftKey);
      setState({
        hasPendingDraft: false,
        draftTimestamp: null,
        isRecovering: false,
      });
    } catch (error) {
      console.warn('Failed to clear draft:', error);
    }
  }, [draftKey]);

  // When the draft key changes (e.g. 'new' -> travelId after first save),
  // flush the pending debounce timer for the old key so it doesn't write an
  // orphaned draft under the previous '..._new' key, and drop any draft already
  // stored under that old key. The id-sync only happens after the server has the
  // data (F-09), so a draft left under the previous key would surface as a false
  // recovery prompt on reload under the new '..._<id>' key.
  useEffect(() => {
    const prevKey = prevDraftKeyRef.current;
    if (prevKey !== null && prevKey !== draftKey) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      pendingDraftDataRef.current = null;
      void removeStorageItem(prevKey);
    }
    prevDraftKeyRef.current = draftKey;
  }, [draftKey]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return useMemo(() => ({
    hasPendingDraft: state.hasPendingDraft,
    draftTimestamp: state.draftTimestamp,
    recoverDraft,
    dismissDraft,
    saveDraft,
    clearDraft,
    isRecovering: state.isRecovering,
  }), [state.hasPendingDraft, state.draftTimestamp, recoverDraft, dismissDraft, saveDraft, clearDraft, state.isRecovering]);
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
    try {
      localStorage.setItem(key, value);
    } catch {
      // localStorage might be full or disabled
    }
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
