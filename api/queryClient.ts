import { QueryClient } from '@tanstack/react-query';
import { createOptimizedQueryClient } from '@/utils/reactQueryConfig';

export const queryClient: QueryClient = createOptimizedQueryClient();

export default queryClient;
