import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/api/queryKeys';
import { useAuthStore } from '@/stores/authStore';

/**
 * Значок непрочитанных секундной точности не требует, а ответ приходит с
 * `no-store`, поэтому каждый повтор — реальный поход в сеть. Минута вместо
 * прежних тридцати секунд вдвое сокращает их число (#1661).
 */
const UNREAD_COUNT_POLL_INTERVAL = 60_000;

/**
 * Пока последний ответ был ошибкой, опрос разряжается: долбить сломанный
 * эндпоинт раз в минуту с каждой страницы незачем. Прежний хук здесь замолкал
 * навсегда после трёх неудач подряд — теперь значок восстанавливается сам, без
 * перемонтирования шапки.
 */
const UNREAD_COUNT_ERROR_INTERVAL = 5 * 60_000;

async function readUnreadCount(): Promise<number> {
    // Импорт динамический: хук висит в шапке на КАЖДОЙ странице, а статический
    // притащил бы `api/messages` в общий чанк любого маршрута.
    const { fetchUnreadCount } = await import('@/api/messages');
    const data = await fetchUnreadCount();
    return data?.count ?? 0;
}

/**
 * Единственный источник числа непрочитанных на всё приложение (#1661).
 *
 * Раньше их было два: этот хук со своим `setInterval` и `useUnreadCount` на
 * общем слое данных. Общего кэша у них не было — открытие меню аккаунта на
 * экране профиля заказывало то же самое число заново, — а собственный таймер
 * ничего не знал про фокус вкладки и тикал в фоне. Теперь оба вызывающих ходят
 * по одному ключу, и повтор по таймеру встаёт вместе с потерей фокуса, как это
 * по умолчанию делает общий слой.
 *
 * Ключ привязан к пользователю: кэш переживает логаут (`logout` его не чистит),
 * и без привязки следующий вошедший увидел бы чужое число.
 *
 * @param enabled условие включения — для меню это «меню открыто»
 * @param pollEnabled нужен ли повтор по таймеру
 */
export function useDeferredUnreadCount(enabled: boolean = true, pollEnabled: boolean = true) {
  const userId = useAuthStore((state) => state.userId);
  const identity = userId == null ? null : String(userId);

  const query = useQuery({
    queryKey: queryKeys.messagesUnreadCount(identity),
    queryFn: readUnreadCount,
    // Гейт остаётся ровно тем, что передал вызывающий: для меню это «меню
    // открыто». Разделение кэша обеспечивает ключ, а не условие включения.
    enabled,
    staleTime: UNREAD_COUNT_POLL_INTERVAL,
    refetchInterval: (query) => {
      if (!enabled || !pollEnabled) return false;
      return query.state.status === 'error'
        ? UNREAD_COUNT_ERROR_INTERVAL
        : UNREAD_COUNT_POLL_INTERVAL;
    },
    refetchOnWindowFocus: false,
    // `retry` намеренно не переопределяем. Глобальная политика
    // (`utils/reactQueryConfig.ts`) не повторяет 4xx и таймауты, но даёт две
    // попытки на 5xx — без неё единственный 502 в момент деплоя сразу уводил бы
    // опрос на пять минут, хотя раньше значок восстанавливался за полминуты.
  });

  // Зависимость — именно `refetch`: она забинжена в обсервере и стабильна, а
  // сам результат `useQuery` отдаётся новым объектом на каждый рендер, из-за
  // чего `refresh` пересоздавался бы постоянно.
  const { refetch } = query;
  const refresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  return { count: query.data ?? 0, refresh };
}

export default useDeferredUnreadCount;
