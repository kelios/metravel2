// Секрет из ссылки письма (`?token=`, `?hash=`, `?password_reset_token=`; список —
// `utils/secretLinkRoutes.js`) экран читает только через этот хук (#2145).
//
// На web секрет не остаётся в адресной строке: хук забирает его из query, кладёт
// в sessionStorage вкладки и снимает параметр через `router.setParams` — это
// replace текущей записи истории, не push. Иначе после старта тэгов аналитики
// «Назад» возвращает `…?token=` в `document.location`, и авто-модули Метрики
// (clickmap, Вебвизор) отправляют его как page-url: паузы у tag.js нет.
// Перезагрузка и повторное монтирование без параметра берут секрет из
// sessionStorage вкладки, поэтому «Повторить» и F5 работают как раньше.
// Native: адресной строки и Метрики нет — только query.
//
// Гидратация (#2178): заранее собранная разметка маршрута (SSG) строится без
// query и без хранилища вкладки, а браузер приходит с секретом в адресе или,
// после посадки и F5, в sessionStorage. Если первая клиентская отрисовка видит
// секрет, она расходится с разметкой — React #418 выбрасывает её и рисует экран
// заново. Поэтому на web до гидратации хук отвечает `null` — «секрет ещё не
// известен», — а хранилище читает только после неё. `''` — секрета нет. Экран
// на `null` не решает ни в пользу формы, ни в пользу «ссылка недействительна».

import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useHydrationReady } from '@/hooks/useHydrationReady';

const storageKey = (route: string, param: string) => `metravel:secret-link:${route}:${param}`;

const sessionStore = (): Storage | null => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    return window.sessionStorage ?? null;
  } catch {
    return null;
  }
};

const readStored = (key: string): string => {
  try {
    return sessionStore()?.getItem(key)?.trim() ?? '';
  } catch {
    return '';
  }
};

const writeStored = (key: string, value: string) => {
  try {
    sessionStore()?.setItem(key, value);
  } catch {
    // Без storage секрет живёт в состоянии экрана; теряется только при F5.
  }
};

export function useSecretLinkParam(route: string, param: string): string | null {
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const router = useRouter();
  const hydrated = useHydrationReady();
  const raw = params[param];
  const fromQuery = ((Array.isArray(raw) ? raw[0] : raw) ?? '').trim();
  const key = storageKey(route, param);
  const [stored, setStored] = useState('');

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!fromQuery) {
      // Пустое чтение известный секрет не затирает: без хранилища вкладки запись
      // после посадки не удалась, а снятие параметра уже обнулило query.
      const restored = readStored(key);
      if (restored) setStored(restored);
      return;
    }
    writeStored(key, fromQuery);
    setStored(fromQuery);
    router.setParams({ [param]: undefined });
  }, [fromQuery, key, param, router]);

  if (!hydrated) return null;
  return fromQuery || stored;
}
