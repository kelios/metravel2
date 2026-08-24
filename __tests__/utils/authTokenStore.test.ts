import { Platform } from 'react-native';

// На нативе SecureStore пишет асинхронно, поэтому фейк ниже умеет держать записи
// «в полёте» и отпускать их в произвольном порядке — именно так воспроизводится
// гонка записи пары токенов между входом и подтверждением почты (#1545).
jest.mock('@/utils/secureStorage', () => ({
    setSecureItem: jest.fn(),
    getSecureItem: jest.fn(),
    removeSecureItems: jest.fn(),
}));

const { setSecureItem, getSecureItem, removeSecureItems } = require('@/utils/secureStorage') as {
    setSecureItem: jest.Mock;
    getSecureItem: jest.Mock;
    removeSecureItems: jest.Mock;
};

import {
    clearSessionTokens,
    getSessionWriteMark,
    persistRotatedSessionTokens,
    persistSessionTokens,
    readRefreshTokenForRotation,
    __resetSessionTokenWritesForTests,
} from '@/utils/authTokenStore';

const originalPlatformOS = Platform.OS;
const setPlatform = (os: string) =>
    Object.defineProperty(Platform, 'OS', { configurable: true, value: os });

const disk = new Map<string, string>();

/** Сессия, которой принадлежит записанный токен: `A-access` → `A`. */
const sessionOf = (token: string | undefined): string | undefined => token?.split('-')[0];

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Запись применяется сразу — для кейсов без гонки. */
const installImmediateSecureStore = () => {
    setSecureItem.mockImplementation(async (key: string, value: string) => {
        disk.set(key, value);
    });
    getSecureItem.mockImplementation(async (key: string) => disk.get(key) ?? null);
    removeSecureItems.mockImplementation(async (keys: string[]) => {
        keys.forEach((key) => disk.delete(key));
    });
};

type PendingWrite = { apply: () => void };

/** Запись повисает до явного `release`, что позволяет инвертировать порядок. */
const installGatedSecureStore = (pending: PendingWrite[]) => {
    setSecureItem.mockImplementation(
        (key: string, value: string) =>
            new Promise<void>((resolve) => {
                pending.push({
                    apply: () => {
                        disk.set(key, value);
                        resolve();
                    },
                });
            }),
    );
    removeSecureItems.mockImplementation(
        (keys: string[]) =>
            new Promise<void>((resolve) => {
                pending.push({
                    apply: () => {
                        keys.forEach((key) => disk.delete(key));
                        resolve();
                    },
                });
            }),
    );
};

/**
 * Отпускает зависшие записи, инвертируя порядок внутри каждой волны: писатель,
 * стартовавший позже, ложится на диск раньше. Возвращает максимальное число
 * одновременно висевших записей — при сериализации оно равно 1.
 */
const drainPendingInvertingOrder = async (pending: PendingWrite[]): Promise<number> => {
    let maxInFlight = 0;
    for (let guard = 0; guard < 50; guard += 1) {
        await flush();
        if (pending.length === 0) break;
        maxInFlight = Math.max(maxInFlight, pending.length);
        pending
            .splice(0)
            .reverse()
            .forEach((write) => write.apply());
    }
    return maxInFlight;
};

describe('utils/authTokenStore', () => {
    beforeEach(() => {
        setPlatform('ios');
        disk.clear();
        setSecureItem.mockReset();
        getSecureItem.mockReset();
        removeSecureItems.mockReset();
        installImmediateSecureStore();
        __resetSessionTokenWritesForTests();
    });

    afterAll(() => setPlatform(originalPlatformOS));

    it('контроль: два прямых писателя на этом фейке оставляют смешанную пару (#1545)', async () => {
        // Доказательство, что стенд действительно воспроизводит дефект: так пару
        // писали вход и подтверждение почты до появления общей очереди.
        const pending: PendingWrite[] = [];
        installGatedSecureStore(pending);

        const legacyWritePair = async (token: string, refresh: string) => {
            await setSecureItem('userToken', token);
            await setSecureItem('refreshToken', refresh);
        };

        const writers = Promise.all([
            legacyWritePair('A-access', 'A-refresh'),
            legacyWritePair('B-access', 'B-refresh'),
        ]);

        await flush();
        expect(pending.length).toBe(2); // обе сессии пишут `userToken` одновременно
        // Первая волна в порядке вызова: `B` перекрывает `A`, access остаётся от B.
        pending.splice(0).forEach((write) => write.apply());
        await flush();
        // Вторая волна разрешается в обратном порядке: refresh остаётся от A.
        pending
            .splice(0)
            .reverse()
            .forEach((write) => write.apply());
        await writers;

        expect(sessionOf(disk.get('userToken'))).toBe('B');
        expect(sessionOf(disk.get('refreshToken'))).toBe('A');
    });

    it('параллельные вход и подтверждение почты оставляют на диске цельную пару одной сессии', async () => {
        const pending: PendingWrite[] = [];
        installGatedSecureStore(pending);

        const writers = Promise.all([
            persistSessionTokens('A-access', 'A-refresh'),
            persistSessionTokens('B-access', 'B-refresh'),
        ]);
        const maxInFlight = await drainPendingInvertingOrder(pending);
        await writers;

        // Ни одна запись чужой сессии не попадает между двумя ключами пары.
        expect(maxInFlight).toBe(1);
        expect(sessionOf(disk.get('userToken'))).toBe(sessionOf(disk.get('refreshToken')));
        expect(disk.get('userToken')).toBeDefined();
        expect(disk.get('refreshToken')).toBeDefined();
    });

    it('сессия без refresh-токена не оставляет рядом refresh прошлой сессии', async () => {
        await persistSessionTokens('A-access', 'A-refresh');
        expect(disk.get('refreshToken')).toBe('A-refresh');

        // Подтверждение почты может вернуть только access — чужой refresh должен уйти,
        // иначе первая же ротация по нему «переедет» в прошлую сессию.
        await persistSessionTokens('B-access');

        expect(disk.get('userToken')).toBe('B-access');
        expect(disk.has('refreshToken')).toBe(false);
    });

    it('запись in-flight входа с устаревшей меткой не затирает пару подтверждённой сессии', async () => {
        const markAtLoginStart = getSessionWriteMark();

        // Пока логин ходил в сеть, подтверждение почты записало свою пару.
        await persistSessionTokens('B-access', 'B-refresh');
        expect(getSessionWriteMark()).not.toBe(markAtLoginStart);

        await expect(
            persistSessionTokens('A-access', 'A-refresh', { expectedMark: markAtLoginStart }),
        ).resolves.toBe('superseded');

        expect(disk.get('userToken')).toBe('B-access');
        expect(disk.get('refreshToken')).toBe('B-refresh');
    });

    it('очистка кредов тоже двигает метку: in-flight вход после logout не записывает токены', async () => {
        const markAtLoginStart = getSessionWriteMark();
        await clearSessionTokens();

        await expect(
            persistSessionTokens('A-access', 'A-refresh', { expectedMark: markAtLoginStart }),
        ).resolves.toBe('superseded');

        expect(disk.size).toBe(0);
    });

    it('ротация сохраняет существующий refresh, если сервер его не ротировал', async () => {
        await persistSessionTokens('A-access', 'A-refresh');

        await expect(persistRotatedSessionTokens('A-access2')).resolves.toBe('written');

        expect(disk.get('userToken')).toBe('A-access2');
        expect(disk.get('refreshToken')).toBe('A-refresh');
    });

    it('снимок для ротации отдаёт refresh и метку согласованно', async () => {
        await persistSessionTokens('A-access', 'A-refresh');

        const snapshot = await readRefreshTokenForRotation();
        expect(snapshot.refresh).toBe('A-refresh');

        // Без чужих записей ротация по этому снимку проходит.
        await expect(
            persistRotatedSessionTokens('A-access2', undefined, { expectedMark: snapshot.mark }),
        ).resolves.toBe('written');
        expect(disk.get('userToken')).toBe('A-access2');

        // А после чужой записи тот же снимок уже устарел.
        await persistSessionTokens('B-access', 'B-refresh');
        await expect(
            persistRotatedSessionTokens('A-access3', undefined, { expectedMark: snapshot.mark }),
        ).resolves.toBe('superseded');
        expect(disk.get('userToken')).toBe('B-access');
    });

    it('ротация с устаревшей меткой не затирает креды новой сессии', async () => {
        await persistSessionTokens('A-access', 'A-refresh');
        const markAtRefreshStart = getSessionWriteMark();
        await persistSessionTokens('B-access', 'B-refresh');

        await expect(
            persistRotatedSessionTokens('A-access2', 'A-refresh2', {
                expectedMark: markAtRefreshStart,
            }),
        ).resolves.toBe('superseded');

        expect(disk.get('userToken')).toBe('B-access');
        expect(disk.get('refreshToken')).toBe('B-refresh');
    });

    it('сорвавшаяся запись refresh не оставляет половину пары', async () => {
        await persistSessionTokens('A-access', 'A-refresh');

        setSecureItem.mockImplementation(async (key: string, value: string) => {
            if (key === 'refreshToken') throw new Error('secure store write failed');
            disk.set(key, value);
        });

        await expect(persistSessionTokens('B-access', 'B-refresh')).rejects.toThrow(
            'secure store write failed',
        );

        // Access новой сессии рядом с refresh прошлой — та же смешанная пара, поэтому
        // сорвавшаяся запись стирает оба ключа: гость лучше чужой сессии.
        expect(disk.has('userToken')).toBe(false);
        expect(disk.has('refreshToken')).toBe(false);
    });

    it('сбой на первой же записи не трогает пару текущей сессии', async () => {
        await persistSessionTokens('A-access', 'A-refresh');

        // Транзиентный сбой keystore на самой первой записи: до диска новая сессия
        // не дошла вовсе. Стирать пару A не за что — иначе неудачная попытка входа
        // разлогинивает того, кто уже вошёл.
        setSecureItem.mockImplementation(async () => {
            throw new Error('keystore unavailable');
        });

        await expect(persistSessionTokens('B-access', 'B-refresh')).rejects.toThrow(
            'keystore unavailable',
        );

        expect(disk.get('userToken')).toBe('A-access');
        expect(disk.get('refreshToken')).toBe('A-refresh');
        expect(removeSecureItems).not.toHaveBeenCalled();
    });

    it('на web токены сессии не пишутся, а очистка легаси-ключей выполняется', async () => {
        setPlatform('web');

        await expect(persistSessionTokens('A-access', 'A-refresh')).resolves.toBe('skipped');
        await expect(persistRotatedSessionTokens('A-access2')).resolves.toBe('skipped');
        expect(setSecureItem).not.toHaveBeenCalled();

        await clearSessionTokens();
        expect(removeSecureItems).toHaveBeenCalledWith(['userToken', 'refreshToken']);
    });
});
