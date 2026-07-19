import { useCallback, useRef } from 'react';
import { translate as i18nT } from '@/i18n';

// При затяжном отказе автосейва (протухшая сессия, флаки-сеть) onError зовётся
// каждый цикл дебаунса. Показываем тост «Ошибка автосохранения» не чаще раза в
// этот интервал, чтобы он не мигал/не залипал. Троттл сбрасывается после успешного
// сохранения, поэтому первая ошибка после успеха всплывает сразу.
const AUTOSAVE_ERROR_TOAST_THROTTLE_MS = 30000;

type ShowToast = (message: string, type?: 'success' | 'error') => void;

/**
 * Троттлинг пользовательского тоста «Ошибка автосохранения». Извлечён из
 * useTravelFormPersistence без изменения поведения: notify показывает тост не
 * чаще AUTOSAVE_ERROR_TOAST_THROTTLE_MS, reset снимает троттл после успешного
 * сохранения (следующая ошибка нового «эпизода» всплывает сразу).
 */
export function useAutosaveErrorToast(showToast: ShowToast) {
  // Время последнего показанного тоста ошибки автосейва (троттлинг UI, см. константу).
  const lastAutosaveErrorToastAtRef = useRef(0);

  const notify = useCallback(() => {
    const now = Date.now();
    if (now - lastAutosaveErrorToastAtRef.current >= AUTOSAVE_ERROR_TOAST_THROTTLE_MS) {
      lastAutosaveErrorToastAtRef.current = now;
      showToast(i18nT('shared:hooks.useTravelFormPersistence.oshibka_avtosohraneniya_0fb98f16'), 'error');
    }
  }, [showToast]);

  const reset = useCallback(() => {
    lastAutosaveErrorToastAtRef.current = 0;
  }, []);

  return { notify, reset };
}
