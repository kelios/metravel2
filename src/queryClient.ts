import { QueryClient } from '@tanstack/react-query';
import { createOptimizedQueryClient } from '@/src/utils/reactQueryConfig';

// Shared QueryClient instance for tests and app
export const queryClient: QueryClient = createOptimizedQueryClient();

export default queryClient;
