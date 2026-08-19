import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import isEqual from 'fast-deep-equal';

import { isTimeoutError } from '@/api/clientErrors';

interface UseImprovedAutoSaveOptions<T> {
  debounce?: number;
  onSave: (data: T, signal?: AbortSignal) => Promise<T>;
  onSuccess?: (savedData: T) => void;
  onError?: (error: Error) => void;
  onStart?: () => void;
  maxRetries?: number;
  retryDelay?: number;
  enableRetry?: boolean;
  enabled?: boolean;
  isOnline?: boolean;
  /**
   * Сколько после клиентского таймаута фоновое сохранение считается небезопасным.
   * Наш abort не останавливает обработку на сервере, поэтому попытка, оборванная
   * таймаутом, ещё какое-то время реально выполняется. Новый фоновый сейв в это
   * окно — вторая тяжёлая транзакция по той же сущности.
   */
  timeoutCooldown?: number;
}

type AutosaveStatus = 'idle' | 'debouncing' | 'saving' | 'saved' | 'error';

interface AutosaveState {
  status: AutosaveStatus;
  lastSaved: Date | null;
  error: Error | null;
  retryCount: number;
  isOnline: boolean;
}

const getErrorStatus = (error: unknown): number | null => {
  if (!error || typeof error !== 'object') return null;
  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' && Number.isFinite(status) ? status : null;
};

const isRetryableSaveError = (error: Error): boolean => {
  if (error.message === 'Request aborted') {
    return false;
  }

  // Клиентский таймаут не отменяет работу на сервере: запрос продолжает
  // выполняться и после нашего abort. Немедленный повтор — это вторая такая же
  // тяжёлая транзакция по той же сущности, то есть таймаут превращается в
  // генератор дублирующих попыток. Следующая попытка уходит обычным
  // debounce-циклом с актуальными данными, но не раньше timeoutCooldown.
  if (isTimeoutError(error)) {
    return false;
  }

  const status = getErrorStatus(error);
  if (status == null) {
    return true;
  }

  // 4xx validation/auth/access errors are non-retriable for autosave.
  // Keep retries for transient statuses only.
  if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
    return false;
  }

  return true;
};

const isAbortedSaveError = (error: Error): boolean =>
  error.message === 'Request aborted' || error.name === 'AbortError';

export function useImprovedAutoSave<T>(
  data: T,
  originalData: T,
  options: UseImprovedAutoSaveOptions<T>
) {
  const {
    debounce = 5000,
    onSave,
    onSuccess,
    onError,
    onStart,
    maxRetries = 3,
    retryDelay = 1000,
    enableRetry = true,
    enabled = true,
    isOnline: networkIsOnline = true,
    timeoutCooldown = 30000,
  } = options;

  const [state, setState] = useState<AutosaveState>({
    status: 'idle',
    lastSaved: null,
    error: null,
    retryCount: 0,
    isOnline: networkIsOnline,
  });

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const lastSavedDataRef = useRef<T>(originalData);
  const latestDataRef = useRef<T>(data);
  const isOnlineRef = useRef<boolean>(networkIsOnline);
  const blockingErrorStatusRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef(false);
  // Фоновый тик, пропущенный из-за летящего сохранения: после его завершения
  // актуальные данные должны уйти одним следующим сохранением, иначе правки,
  // сделанные во время полёта, останутся неотправленными до новой правки.
  const pendingBackgroundSaveRef = useRef(false);
  // До этой отметки фоновое сохранение не стартует: предыдущая попытка оборвана
  // нашим таймаутом и, вероятно, всё ещё выполняется на сервере.
  const serverBusyUntilRef = useRef(0);
  const runBackgroundSaveRef = useRef<(() => void) | null>(null);
  const scheduleBackgroundSaveRef = useRef<(() => void) | null>(null);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      inFlightRef.current = false;
    }
    pendingBackgroundSaveRef.current = false;
  }, []);

  // Network status is supplied by the screen-level cross-platform source.
  // This keeps the banner and autosave on the exact same connectivity snapshot.
  useEffect(() => {
    const wasOnline = isOnlineRef.current;
    isOnlineRef.current = networkIsOnline;
    if (mountedRef.current) {
      setState(prev => prev.isOnline === networkIsOnline
        ? prev
        : { ...prev, isOnline: networkIsOnline });
    }
    if (!wasOnline && networkIsOnline) scheduleBackgroundSaveRef.current?.();
  }, [networkIsOnline]);

  // Main cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [cleanup]);

  // Check if data has changed - inline function, not in dependencies
  const hasDataChanged = (): boolean => {
    return !isEqual(data, lastSavedDataRef.current);
  };

  // Save function with retry logic
  const performSave = useCallback(async (
    dataToSave: T,
    retryAttempt = 0,
    options?: { preempt?: boolean; notifyStart?: boolean },
  ): Promise<T> => {
    if (!enabled) {
      return dataToSave;
    }

    // Фоновый сейв НИКОГДА не обрывает уже летящий запрос. Сейв тяжёлой статьи
    // на проде идёт дольше debounce (upsert travel/619 — 11–12 c при debounce
    // 5 c), поэтому «отменить предыдущий и начать заново» вырождалось в
    // бесконечный цикл: каждый запрос умирал по abort на ~5-й секунде (в сети
    // `(canceled)`), клиент не видел ответа и стартовал следующий — при том что
    // бэк каждую попытку всё равно дорабатывал до конца. Пропускаем тик и
    // помечаем, что данные не отправлены: после завершения летящего сохранения
    // они уйдут одним следующим. Право вытеснения остаётся только у явных
    // действий автора (saveNow/retrySave) и у размонтирования экрана.
    if (inFlightRef.current && options?.preempt !== true) {
      pendingBackgroundSaveRef.current = true;
      return dataToSave;
    }

    if (options?.notifyStart) {
      onStart?.();
    }

    // Отменяем предыдущее in-flight сохранение, чтобы его контроллер не осиротел
    // и устаревший результат не перетёр состояние более свежего сохранения.
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    inFlightRef.current = true;
    let saveSucceeded = false;
    // Этот вызов всё ещё актуален, только если его контроллер — текущий.
    const isCurrent = () => abortControllerRef.current === controller;

    try {
      // ✅ FIX: Проверка монтирования перед setState
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          status: 'saving',
          error: null,
        }));
      }

      const result = await onSave(dataToSave, controller.signal);

      if (!mountedRef.current || !isCurrent()) {
        // Компонент размонтирован ИЛИ это сохранение вытеснено более новым.
        // Не трогаем state/baseline и не дёргаем колбэки.
        return result;
      }

      // Подтверждённым считаем ОТПРАВЛЕННЫЙ payload, а не ответ сервера: иначе
      // служебные поля ответа (например updated_at) выглядели бы как новая
      // правка и запускали следующий автосейв.
      // latestDataRef здесь не трогаем: он хранит последние наблюдаемые данные,
      // и если автор печатал, пока запрос летел, они новее отправленного
      // снимка. Затирание этой ссылки отправленным payload'ом стирало память о
      // неотправленных правках — форма показывала «Сохранено», а последние
      // абзацы на сервер не уходили.
      lastSavedDataRef.current = dataToSave;
      blockingErrorStatusRef.current = null;

      // ✅ FIX: Проверка монтирования перед setState
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          status: 'saved',
          lastSaved: new Date(),
          error: null,
          retryCount: 0,
        }));
      }

      saveSucceeded = true;
      onSuccess?.(result);
      return result;

    } catch (error) {
      if (!mountedRef.current || !isCurrent()) {
        // Компонент размонтирован ИЛИ сохранение вытеснено более новым — не
        // пробрасываем ошибку/abort вытесненного запроса в state и колбэки.
        return dataToSave;
      }

      const saveError = error instanceof Error ? error : new Error('Save failed');

      if (isTimeoutError(saveError)) {
        // Мы перестали ждать, но сервер попытку не отменял — она продолжает
        // выполняться. Держим окно, в котором фоновое сохранение той же сущности
        // не стартует, иначе таймаут порождает вторую параллельную транзакцию.
        serverBusyUntilRef.current = Date.now() + timeoutCooldown;
      }

      if (isAbortedSaveError(saveError)) {
        if (mountedRef.current) {
          setState(prev => ({
            ...prev,
            status: 'idle',
            error: null,
            retryCount: 0,
          }));
        }
        throw saveError;
      }
      
      // Retry logic (сохранён, но используется только при необходимости,
      // чтобы не усложнять основную логику автосейва)
      if (enableRetry && retryAttempt < maxRetries && isOnlineRef.current && isRetryableSaveError(saveError)) {
        // ✅ FIX: Проверка монтирования перед setState
        if (mountedRef.current) {
          setState(prev => ({
            ...prev,
            error: saveError,
            retryCount: retryAttempt + 1,
          }));
        }

        // Schedule retry — повторяем с АКТУАЛЬНЫМИ данными, а не с устаревшим
        // снимком dataToSave (иначе ретрай затрёт новые правки пользователя).
        retryTimeoutRef.current = setTimeout(() => {
          retryTimeoutRef.current = null;
          if (mountedRef.current) {
            performSave(latestDataRef.current, retryAttempt + 1).catch(() => {
              // Error handled in recursive call
            });
          }
        }, retryDelay * Math.pow(2, retryAttempt)); // Exponential backoff

        throw saveError;
      }

      // Final error state
      const finalStatus = getErrorStatus(saveError);
      if (finalStatus === 401) {
        // Keep an expired-session failure latched until an explicit retry/new mount.
        // Editing must not hide the login CTA or create a stream of new 401 writes.
        blockingErrorStatusRef.current = finalStatus;
      }
      // ✅ FIX: Проверка монтирования перед setState
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          status: 'error',
          error: saveError,
          retryCount: 0,
        }));
      }

      onError?.(saveError);
      throw saveError;
    } finally {
      // Снимаем флаг только за собой: если нас вытеснил более новый сейв,
      // in-flight принадлежит уже ему.
      if (isCurrent()) {
        inFlightRef.current = false;
        // Завершившийся контроллер больше никому не нужен: если оставить его,
        // следующий сейв вызовет abort() на уже отработавшем запросе и в логах
        // появится отмена, которой не было.
        abortControllerRef.current = null;

        // Пока мы летели, дебаунс успел сработать вхолостую — отправляем
        // накопленные правки одним следующим сохранением. Только после успеха:
        // после ошибки повтором управляет retry/терминальное состояние, иначе
        // неустранимый отказ зациклился бы на том же payload.
        const hadPendingWork = pendingBackgroundSaveRef.current;
        pendingBackgroundSaveRef.current = false;
        if (hadPendingWork && saveSucceeded) {
          scheduleBackgroundSaveRef.current?.();
        }
      }
    }
  }, [onSave, onSuccess, onError, onStart, enableRetry, maxRetries, retryDelay, enabled, timeoutCooldown]);

  // Единственная точка запуска фонового сохранения. Ею пользуются все три
  // источника — debounce-тик, возврат в онлайн и добор правок после завершения
  // летящего сохранения, — чтобы предусловия не разъезжались по копиям.
  useEffect(() => {
    const runBackgroundSave = () => {
      if (!enabled) return;
      if (!mountedRef.current) return;
      if (blockingErrorStatusRef.current === 401) return;
      if (!isOnlineRef.current) return;
      if (isEqual(latestDataRef.current, lastSavedDataRef.current)) return;

      // Предыдущая попытка оборвана нашим таймаутом и, скорее всего, всё ещё
      // выполняется на сервере. Не стартуем вторую, а переносим тик на конец
      // окна: к этому моменту серверная работа либо завершилась, либо запрос
      // уже потерян и повтор безопасен.
      const cooldownLeft = serverBusyUntilRef.current - Date.now();
      if (cooldownLeft > 0) {
        pendingBackgroundSaveRef.current = true;
        if (!timeoutRef.current) {
          timeoutRef.current = setTimeout(() => {
            timeoutRef.current = null;
            runBackgroundSaveRef.current?.();
          }, cooldownLeft);
        }
        return;
      }

      performSave(latestDataRef.current, 0, { notifyStart: true }).catch(() => {
        // Ошибка уже отражена в состоянии через performSave.
      });
    };

    // Отложенный запуск без сброса уже взведённого таймера: используется там,
    // где новых правок не было (возврат в онлайн, добор после сохранения).
    const scheduleBackgroundSave = () => {
      if (!enabled) return;
      if (!mountedRef.current) return;
      if (blockingErrorStatusRef.current === 401) return;
      if (isEqual(latestDataRef.current, lastSavedDataRef.current)) return;
      if (timeoutRef.current || retryTimeoutRef.current) return;

      // Отправка ещё не подтверждена — статус не должен оставаться «Сохранено».
      setState(prev => (prev.status === 'debouncing'
        ? prev
        : { ...prev, status: 'debouncing', error: null }));

      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        runBackgroundSaveRef.current?.();
      }, debounce);
    };

    runBackgroundSaveRef.current = runBackgroundSave;
    scheduleBackgroundSaveRef.current = scheduleBackgroundSave;
    return () => {
      runBackgroundSaveRef.current = null;
      scheduleBackgroundSaveRef.current = null;
    };
  }, [enabled, debounce, performSave]);

  // Упрощённый безопасный автосейв:
  // срабатывает, только если данные реально отличаются от последнего успешно сохранённого
  // и только один раз после дебаунса.
  useEffect(() => {
    if (!enabled) {
      cleanup();
      return;
    }

    // Нет изменений относительно последнего успешного сохранения — ничего не планируем.
    const isEqualResult = isEqual(data, lastSavedDataRef.current);

    if (isEqualResult) {
      return;
    }

    // Запоминаем последние наблюдаемые данные.
    latestDataRef.current = data;

    // An expired session is terminal for background autosave. Preserve the visible
    // error/CTA and the latest local snapshot until the user authenticates again.
    if (blockingErrorStatusRef.current === 401) {
      cleanup();
      return;
    }

    // Сбрасываем предыдущий таймер, если он был.
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    // Данные изменились — отменяем отложенный ретрай, чтобы он вместе со свежим
    // debounce не запустил два параллельных performSave.
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    // Обновляем статус на debouncing только если он не уже debouncing
    // ✅ FIX: Проверка монтирования перед setState
    if (mountedRef.current) {
      setState(prev => {
        if (prev.status === 'debouncing') {
          return prev; // Не вызываем setState если статус уже debouncing
        }
        return {
          ...prev,
          status: 'debouncing',
          error: null,
        };
      });
    }

    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      runBackgroundSaveRef.current?.();
    }, debounce);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [data, debounce, performSave, enabled, cleanup, networkIsOnline]); // Removed hasDataChanged from dependencies

  // Manual save function
  const saveNow = useCallback(async (): Promise<T> => {
    if (!enabled) {
      return data;
    }

    if (!state.isOnline) {
      throw new Error('Cannot save while offline');
    }

    cleanup();
    blockingErrorStatusRef.current = null;
    return performSave(data, 0, { preempt: true });
  }, [data, performSave, cleanup, state.isOnline, enabled]);

  // Reset to original data
  const resetToOriginal = useCallback(() => {
    cleanup();
    blockingErrorStatusRef.current = null;
    lastSavedDataRef.current = originalData;
    // ✅ FIX: Проверка монтирования перед setState
    if (mountedRef.current) {
      setState({
        status: 'idle',
        lastSaved: null,
        error: null,
        retryCount: 0,
        isOnline: state.isOnline,
      });
    }
  }, [originalData, cleanup, state.isOnline]);

  // Clear error
  const clearError = useCallback(() => {
    blockingErrorStatusRef.current = null;
    // ✅ FIX: Проверка монтирования перед setState
    if (mountedRef.current) {
      setState(prev => ({ ...prev, error: null, status: 'idle' }));
    }
  }, []);

  // Retry failed save
  const retrySave = useCallback((): Promise<T> => {
    if (!enabled) {
      return Promise.resolve(data);
    }
    if (state.status !== 'error' || !state.error) {
      throw new Error('No failed save to retry');
    }
    blockingErrorStatusRef.current = null;
    return performSave(data, 0, { preempt: true });
  }, [state.status, state.error, data, performSave, enabled]);

  // Update baseline data (e.g., after loading from server)
  const updateBaseline = useCallback((newBaseline: T) => {
    lastSavedDataRef.current = newBaseline;
    latestDataRef.current = newBaseline;
    // hasUnsavedChanges вычисляется на рендере из lastSavedDataRef. Без рендера
    // потребитель не увидит сброс флага после updateBaseline — форсим пересчёт.
    if (mountedRef.current) {
      setState(prev => ({ ...prev }));
    }
  }, []);

  const hasUnsavedChanges = hasDataChanged();
  const canSave = state.isOnline && state.status !== 'saving';
  const isSaving = state.status === 'saving';
  const hasError = state.status === 'error';
  const timeSinceLastSave = state.lastSaved 
    ? Date.now() - state.lastSaved.getTime() 
    : null;

  return useMemo(() => ({
    // State
    status: state.status,
    lastSaved: state.lastSaved,
    error: state.error,
    retryCount: state.retryCount,
    isOnline: state.isOnline,
    hasUnsavedChanges,

    // Actions
    saveNow,
    resetToOriginal,
    clearError,
    retrySave,
    updateBaseline,

    // Utilities
    canSave,
    isSaving,
    hasError,
    timeSinceLastSave,
    cancelPending: cleanup,
  }), [
    state.status,
    state.lastSaved,
    state.error,
    state.retryCount,
    state.isOnline,
    hasUnsavedChanges,
    saveNow,
    resetToOriginal,
    clearError,
    retrySave,
    updateBaseline,
    canSave,
    isSaving,
    hasError,
    timeSinceLastSave,
    cleanup,
  ]);
}
