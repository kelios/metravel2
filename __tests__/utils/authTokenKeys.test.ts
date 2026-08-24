// __tests__/utils/authTokenKeys.test.ts
// Regression control для #1551: имена ключей сессионной пары объявлены ровно один раз.
//
// Дефект был не в конкретной строке, а в том, что литералы `'userToken'` и
// `'refreshToken'` жили в четырёх модулях сразу: писатель пары
// (`utils/authTokenStore.ts`) и читатели (`api/client.ts`, `api/messages.ts`,
// travel-запросы, `stores/authStore.ts`) брали имя из РАЗНЫХ объявлений.
// Переименование ключа в одном месте развело бы запись и чтение молча: на диске
// живой токен, а приложение считает пользователя гостем.
//
// Этот тест падает, когда литерал появляется вне модуля-владельца, и называет
// файл со строкой. Тесты и e2e не сканируются: там литерал — это проверка
// фактического контракта хранилища, и его расхождение видно сразу.

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');
const OWNER = 'utils/authPlatform.ts';

const SCANNED_DIRS = ['api', 'utils', 'stores', 'hooks', 'context', 'services', 'components', 'app'];

const TOKEN_KEY_LITERAL = /(['"`])(userToken|refreshToken)\1/;

const collect = (relativeDir: string): string[] => {
  const entries = readdirSync(join(ROOT, relativeDir), { withFileTypes: true });
  return entries.flatMap((entry) => {
    const relative = `${relativeDir}/${entry.name}`;
    if (entry.isDirectory()) return collect(relative);
    return /\.tsx?$/.test(entry.name) ? [relative] : [];
  });
};

describe('session token key names live in one module', () => {
  const files = SCANNED_DIRS.flatMap(collect);

  it('scans a non-empty product surface', () => {
    expect(files.length).toBeGreaterThan(100);
    expect(files).toContain(OWNER);
  });

  it('declares each key literal exactly once — in the owning module', () => {
    const violations: string[] = [];

    for (const file of files) {
      if (file === OWNER) continue;
      readFileSync(join(ROOT, file), 'utf8')
        .split('\n')
        .forEach((line, index) => {
          const trimmed = line.trimStart();
          if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
          if (TOKEN_KEY_LITERAL.test(line)) {
            violations.push(`${file}:${index + 1} — второе объявление ключа\n    ${line.trim()}`);
          }
        });
    }

    expect(violations.join('\n')).toBe('');
  });

  it('renaming the owned constant moves both the writer and the readers', async () => {
    // Поведенческая проверка, а не сверка текста: важно, что писатель пары и
    // публичные ре-экспорты для читателей ссылаются на ОДНО значение.
    const { ACCESS_TOKEN_STORAGE_KEY, REFRESH_TOKEN_STORAGE_KEY, isAuthTokenStorageKey } =
      await import('@/utils/authPlatform');
    const { TOKEN_KEY: apiConfigKey } = await import('@/api/apiConfig');
    const { TOKEN_KEY: travelSharedKey } = await import('@/api/travelQueryShared');

    expect(apiConfigKey).toBe(ACCESS_TOKEN_STORAGE_KEY);
    expect(travelSharedKey).toBe(ACCESS_TOKEN_STORAGE_KEY);
    expect(isAuthTokenStorageKey(ACCESS_TOKEN_STORAGE_KEY)).toBe(true);
    expect(isAuthTokenStorageKey(REFRESH_TOKEN_STORAGE_KEY)).toBe(true);
  });

  it('no longer exposes the orphaned REFRESH_TOKEN_KEY from apiConfig', async () => {
    // Сирота без потребителей выглядела как канонический ключ и приглашала
    // завести на неё ещё одного читателя (#1551).
    const apiConfig = await import('@/api/apiConfig');
    expect('REFRESH_TOKEN_KEY' in apiConfig).toBe(false);
  });
});
