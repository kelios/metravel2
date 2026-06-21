import type { QueryClient } from '@tanstack/react-query';

// Holds a reference to the QueryClient that is actually mounted in the React
// tree (created per-render in app/_layout.tsx and passed to QueryClientProvider).
// Non-hook code (e.g. stores/authStore.ts during boot) uses this to read/seed
// the SAME cache the UI hooks read, so a profile fetch in checkAuthentication and
// a profile fetch in useUserProfile dedupe into one network request.
//
// Note: this is intentionally NOT the api/queryClient.ts singleton — the provider
// uses its own instance, so the singleton would target a different cache.

let activeClient: QueryClient | null = null;

export const setActiveQueryClient = (client: QueryClient | null): void => {
    activeClient = client;
};

export const getActiveQueryClient = (): QueryClient | null => activeClient;
