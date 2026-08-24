// utils/authTokenStore.ts
// Единственная точка записи пары сессионных токенов (`userToken` + `refreshToken`).
//
// Пара живёт в двух ключах SecureStore, и на нативе каждая запись действительно
// асинхронная. Раньше каждый писатель (вход, соц-вход, регистрация,
// подтверждение почты, ротация по refresh) писал ключи двумя отдельными
// `await setSecureItem(...)` — между ними есть точка yield, поэтому параллельные
// писатели могли переслоиться и оставить на диске «смешанную пару»: access одной
// сессии и refresh другой. Сразу это незаметно (запрос идёт по свежему access),
// но первый же refresh «переезжает» в чужую сессию. (#1545, механизм заведён #1462)
//
// Здесь пара пишется под общей очередью и как одно целое:
//   • очередь (`enqueue`) сериализует всех писателей — ни одна чужая запись не
//     попадает между двумя ключами пары;
//   • новая сессия без refresh-токена стирает чужой refresh, а не оставляет его
//     рядом со своим access (та же смешанная пара, только без всякой гонки);
//   • запись, оборвавшаяся ПОСЛЕ первого ключа, стирает оба: половина пары на
//     диске хуже, чем гость на следующем запуске (а сбой на самой первой записи
//     диск не трогает — там ещё цельная пара текущей сессии);
//   • `mark` (счётчик состоявшихся смен сессии) даёт in-flight операции понять,
//     что пока она ходила в сеть, диск занял кто-то другой, и не затирать его.
//
// Web не участвует: сессия там — HttpOnly-cookie, `shouldUseStoredAuthToken()`
// возвращает false, и запись отсекается до очереди. Очистка ключей проходит на
// обеих платформах (на web она вычищает легаси-значения прошлых сборок).

import { setSecureItem, getSecureItem, removeSecureItems } from '@/utils/secureStorage';
import { shouldUseStoredAuthToken } from '@/utils/authPlatform';

const ACCESS_TOKEN_KEY = 'userToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const SESSION_TOKEN_KEYS = [ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY];

/** Хвост очереди записи: следующая операция стартует только после предыдущей. */
let writeQueue: Promise<unknown> = Promise.resolve();

/**
 * Счётчик состоявшихся смен сессии на диске (успешная запись новой пары или
 * очистка). Операция, начавшаяся до смены, узнаёт по нему, что её креды устарели.
 */
let sessionMark = 0;

const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
    // Ошибка предыдущей операции не должна рвать очередь, поэтому обе ветки
    // ведут к следующей задаче, а её собственный результат уходит вызывающему.
    const run = writeQueue.then(task, task);
    writeQueue = run.then(
        () => undefined,
        () => undefined,
    );
    return run;
};

/**
 * `written` — пара сессии на диске; `skipped` — записывать нечего (web-cookie или
 * пустой токен); `superseded` — пока операция шла, диск занял кто-то другой, и
 * вызывающему нельзя считать свою сессию сохранённой.
 */
export type SessionTokenWriteResult = 'written' | 'skipped' | 'superseded';

type SessionWriteOptions = {
    /**
     * Метка, снятая в начале операции (`getSessionWriteMark()`). Если к моменту
     * записи она устарела — на диске уже другая сессия, и запись пропускается.
     */
    expectedMark?: number;
};

/** Снимок текущего состояния диска для in-flight операции входа/ротации. */
export const getSessionWriteMark = (): number => sessionMark;

const writeTokenPair = async (
    token: string,
    refresh: string | undefined,
    { clearMissingRefresh }: { clearMissingRefresh: boolean },
): Promise<void> => {
    // Сорвалась ли запись ПОСЛЕ того, как новый access уже лёг на диск. Только в
    // этом случае на диске половина пары; до первой удачной записи там всё ещё
    // цельная пара прошлой сессии.
    let accessWritten = false;
    try {
        await setSecureItem(ACCESS_TOKEN_KEY, token);
        accessWritten = true;
        if (refresh) {
            await setSecureItem(REFRESH_TOKEN_KEY, refresh);
        } else if (clearMissingRefresh) {
            await removeSecureItems([REFRESH_TOKEN_KEY]);
        }
    } catch (error) {
        // Fail closed: запись, оборвавшаяся на середине, оставила бы access новой
        // сессии рядом с refresh прошлой. Стираем обе.
        // Но если не прошла самая первая запись (транзиентный сбой keystore),
        // менять на диске нечего: там нетронутая пара текущей сессии, и стирать
        // её — значит разлогинить пользователя из-за чужой неудачной попытки.
        if (accessWritten) {
            await removeSecureItems(SESSION_TOKEN_KEYS).catch(() => undefined);
        }
        throw error;
    }
};

/**
 * Записать креды НОВОЙ сессии (вход, соц-вход, регистрация, подтверждение почты).
 * Ответ без refresh-токена означает, что у этой сессии его нет: чужой refresh
 * стирается, чтобы на диске не осталось пары из двух разных сессий.
 * Возвращает `superseded`, если по метке видно, что диск занял кто-то другой:
 * вызывающий обязан отказаться от своей сессии, а не «дописать» её поверх.
 */
export const persistSessionTokens = async (
    token: string | undefined,
    refresh?: string,
    options: SessionWriteOptions = {},
): Promise<SessionTokenWriteResult> => {
    if (!shouldUseStoredAuthToken() || !token) return 'skipped';
    return enqueue(async () => {
        if (options.expectedMark !== undefined && options.expectedMark !== sessionMark) {
            return 'superseded';
        }
        await writeTokenPair(token, refresh, { clearMissingRefresh: true });
        sessionMark += 1;
        return 'written';
    });
};

/**
 * Записать пару после ротации по refresh. Сессия та же, поэтому ответ без
 * `refresh` значит «сервер не ротировал refresh» — существующий ключ остаётся.
 */
export const persistRotatedSessionTokens = async (
    token: string | undefined,
    refresh?: string,
    options: SessionWriteOptions = {},
): Promise<SessionTokenWriteResult> => {
    if (!shouldUseStoredAuthToken() || !token) return 'skipped';
    return enqueue(async () => {
        if (options.expectedMark !== undefined && options.expectedMark !== sessionMark) {
            return 'superseded';
        }
        await writeTokenPair(token, refresh, { clearMissingRefresh: false });
        return 'written';
    });
};

/**
 * Прочитать refresh-токен для ротации вместе с меткой одним снимком. Читать их
 * порознь нельзя: между чтением ключа и снятием метки может встать чужая запись,
 * и ротация либо зря откажется от своей записи, либо решит, что её refresh
 * актуален. Внутри очереди чужая запись невозможна, поэтому снимок цельный.
 */
export const readRefreshTokenForRotation = async (): Promise<{
    refresh: string | null;
    mark: number;
}> =>
    enqueue(async () => {
        const refresh = await getSecureItem(REFRESH_TOKEN_KEY);
        return { refresh, mark: sessionMark };
    });

/** Снять креды сессии (logout, откат, подтверждённая невалидность токена). */
export const clearSessionTokens = async (): Promise<void> => {
    await enqueue(async () => {
        // Метку двигаем до удаления: даже если очистка сорвётся, in-flight вход
        // уже не должен считать свои креды актуальными.
        sessionMark += 1;
        await removeSecureItems(SESSION_TOKEN_KEYS);
    });
};

/** Только для тестов: сбросить очередь и метку между кейсами. */
export const __resetSessionTokenWritesForTests = (): void => {
    writeQueue = Promise.resolve();
    sessionMark = 0;
};
