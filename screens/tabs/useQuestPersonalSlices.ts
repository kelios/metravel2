// screens/tabs/useQuestPersonalSlices.ts
// Срезы каталога по прохождениям: мной, другими и ещё не пройдено мной.
//
// Отдельный модуль, а не блок в `QuestsScreen.tsx`: экран уже на потолке
// `guard-file-complexity-changed` (800 LOC), и вся эта логика — один связный
// концерн «что игрок уже прошёл», который нужен экрану в пяти местах
// (видимость строк сайдбара, счётчики, состав среза, центр карты, валидность
// сохранённого выбора).
import { useMemo } from 'react';

import { useAuthStore } from '@/stores/authStore';

import {
    COMPLETED_FILTER_ID,
    COMPLETED_BY_OTHERS_FILTER_ID,
    UNCOMPLETED_FILTER_ID,
    filterQuestsByCompletion,
    filterQuestsCompletedByOthers,
} from './QuestsScreen.helpers';

export type QuestPersonalSlices<T> = {
    /** Показывать строку «Пройденные» в сайдбаре и мобильном drawer. */
    showCompletedFilter: boolean;
    /** Есть квесты, пройденные хотя бы одним другим игроком. */
    showCompletedByOthersFilter: boolean;
    /** Показывать строку «Не пройденные». */
    showUncompletedFilter: boolean;
    /** Счётчики личных срезов для `cityQuestCountById`. */
    counts: Record<string, number>;
    /** Квесты личного среза или `null`, если выбран не личный срез. */
    sliceFor: (selectedCityId: string | null) => T[] | null;
    isPersonalSliceId: (selectedCityId: string | null) => boolean;
    /** Личный выбор жив (и его нельзя сбрасывать в «Все квесты»). */
    isSelectionValid: (selectedCityId: string | null) => boolean;
};

/**
 * Срезы считаются по флагу `isCompletedByMe` из того же ответа каталога —
 * отдельного запроса они не стоят. Ответ персональный (`Vary: Authorization`),
 * у гостя флаг всегда `false`, поэтому содержимое среза НЕ гейтится
 * авторизацией: web-сессия стартует гостевой и опознаётся позже
 * (`checkAuthentication` отложен до idle), а каталог к этому моменту уже
 * пришёл персональным — гейт показывал бы вернувшемуся игроку пустой срез с
 * «вы ещё ничего не прошли». Авторизацией гейтятся только сами элементы
 * управления и валидность сохранённого выбора.
 *
 * Узкие подписки вместо `useAuth()`: тот отдаёт весь срез стора, и каталог
 * перерисовывался бы на смену аватара или счётчика обновления профиля.
 */
export function useQuestPersonalSlices<T extends { isCompletedByMe?: boolean; completionsCount?: number }>(
    quests: T[],
): QuestPersonalSlices<T> {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const authReady = useAuthStore((state) => state.authReady);
    const completed = useMemo(() => filterQuestsByCompletion(quests, true), [quests]);
    const completedByOthers = useMemo(() => filterQuestsCompletedByOthers(quests), [quests]);
    const uncompleted = useMemo(() => filterQuestsByCompletion(quests, false), [quests]);

    return useMemo(() => {
        // «Пройденные» доступны и с нулём прохождений: пустой срез объясняет
        // отдельное состояние с кнопкой обратно в каталог. «Не пройденные» —
        // только когда срез что-то сужает и не пуст: при нуле прохождений он
        // дословно повторяет весь каталог, а при закрытом каталоге вёл бы в
        // пустую сетку без объяснения.
        const showCompletedFilter = isAuthenticated;
        const showCompletedByOthersFilter = isAuthenticated && completedByOthers.length > 0;
        const showUncompletedFilter = isAuthenticated
            && completed.length > 0
            && uncompleted.length > 0;
        const isPersonalSliceId = (selectedCityId: string | null) =>
            selectedCityId === COMPLETED_FILTER_ID || selectedCityId === UNCOMPLETED_FILTER_ID
            || selectedCityId === COMPLETED_BY_OTHERS_FILTER_ID;

        return {
            showCompletedFilter,
            showCompletedByOthersFilter,
            showUncompletedFilter,
            counts: {
                [COMPLETED_FILTER_ID]: completed.length,
                [COMPLETED_BY_OTHERS_FILTER_ID]: completedByOthers.length,
                [UNCOMPLETED_FILTER_ID]: uncompleted.length,
            },
            sliceFor: (selectedCityId) => {
                if (selectedCityId === COMPLETED_FILTER_ID) return completed;
                if (selectedCityId === COMPLETED_BY_OTHERS_FILTER_ID) return completedByOthers;
                if (selectedCityId === UNCOMPLETED_FILTER_ID) return uncompleted;
                return null;
            },
            isPersonalSliceId,
            // Личный выбор персистится, а сессия web стартует гостевой: пока
            // `authReady` не наступил, сбрасывать его нельзя — иначе
            // вернувшийся игрок каждый раз открывал бы каталог с потерянным
            // фильтром. После опознания невалидный срез (выход из аккаунта,
            // исчезнувшая строка) сбрасывается в «Все квесты».
            isSelectionValid: (selectedCityId) => {
                if (!isPersonalSliceId(selectedCityId)) return false;
                if (!authReady) return true;
                if (selectedCityId === COMPLETED_BY_OTHERS_FILTER_ID) return showCompletedByOthersFilter;
                return selectedCityId === COMPLETED_FILTER_ID
                    ? showCompletedFilter
                    : showUncompletedFilter;
            },
        };
    }, [authReady, completed, completedByOthers, isAuthenticated, uncompleted]);
}
