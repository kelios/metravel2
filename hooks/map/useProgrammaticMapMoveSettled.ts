import { useEffect, useState } from 'react';

import {
  programmaticMapMoveRemainingMs,
  subscribeProgrammaticMapMove,
} from '@/components/MapPage/Map/programmaticMoveSignal';

/**
 * true, когда карту сейчас НЕ двигаем программно (авто-фит, flyTo). Переключается в
 * false при открытии окна `beginProgrammaticMapMove` и обратно в true, когда окно
 * истекло (с учётом продлений). Нужен, чтобы запрос серверных кластеров ушёл один раз
 * по итоговому вьюпорту, а не по промежуточному (#2450).
 */
export function useProgrammaticMapMoveSettled(): boolean {
  const [settled, setSettled] = useState(() => programmaticMapMoveRemainingMs() === 0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const arm = () => {
      const remaining = programmaticMapMoveRemainingMs();
      if (remaining === 0) {
        timer = null;
        setSettled(true);
        return;
      }
      setSettled(false);
      if (timer != null) clearTimeout(timer);
      // +16 мс — чтобы trailing read вьюпорта (useMapViewportSnapshot) успел
      // опубликовать итоговый bbox раньше, чем запрос снова разрешён.
      timer = setTimeout(arm, remaining + 16);
    };

    arm();
    const unsubscribe = subscribeProgrammaticMapMove(arm);
    return () => {
      unsubscribe();
      if (timer != null) clearTimeout(timer);
    };
  }, []);

  return settled;
}
