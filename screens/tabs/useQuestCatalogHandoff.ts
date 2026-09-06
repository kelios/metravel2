// screens/tabs/useQuestCatalogHandoff.ts
// Приём разового среза, переданного каталогу другим экраном (#1794).

import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_PENDING_CATALOG_SELECTION } from '@/utils/questCatalogSelection';

/**
 * Забирает отложенный выбор среза и отдаёт его экрану ровно один раз.
 *
 * Отдельный хук, а не эффект в `QuestsScreen.tsx`: экран стоит у потолка
 * `guard-file-complexity-changed` (800 LOC), и врезка ушла бы за него.
 *
 * Читаем на КАЖДЫЙ фокус, а не при монтировании: вкладка каталога живёт всю
 * сессию, поэтому у пришедшего из профиля игрока экран уже смонтирован и
 * mount-эффект второй раз не выполнится. Ключ удаляется до применения — иначе
 * срез возвращался бы на каждый следующий заход на вкладку.
 */
export function useQuestCatalogHandoff(params: {
    enabled: boolean;
    onApply: (selectionId: string) => void;
}): void {
    const { enabled, onApply } = params;

    useEffect(() => {
        if (!enabled) return undefined;
        let cancelled = false;

        (async () => {
            try {
                const pending = await AsyncStorage.getItem(STORAGE_PENDING_CATALOG_SELECTION);
                // Отменённый эффект обязан оставить ключ на месте: `onApply`
                // меняет ссылку (ширина вьюпорта садится уже после первого
                // рендера), эффект переподписывается — и съеденный, но не
                // применённый ключ означал бы каталог в прежнем срезе.
                if (!pending || cancelled) return;
                onApply(pending);
                // Удаление после применения: повторное применение того же id
                // идемпотентно, а потерянный ключ — нет.
                await AsyncStorage.removeItem(STORAGE_PENDING_CATALOG_SELECTION);
            } catch {
                // Недоступное хранилище — просто нет передачи: каталог
                // открывается в своём прежнем срезе.
            }
        })();

        return () => { cancelled = true; };
    }, [enabled, onApply]);
}

export default useQuestCatalogHandoff;
