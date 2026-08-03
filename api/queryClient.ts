import { QueryClient } from '@tanstack/react-query';
import { createOptimizedQueryClient } from '@/utils/reactQueryConfig';

// Модульный синглтон для не-хукового кода (geoQueries). Он не привязан к
// маршруту и живёт рядом с клиентом из корневого layout, поэтому стартовый
// префетч словарей ему не положен: иначе загрузка geoQueries на любом экране
// давала второй, дублирующий запрос фильтров и стран.
export const queryClient: QueryClient = createOptimizedQueryClient(undefined, {
  enableStaticPrefetch: false,
});

export default queryClient;
