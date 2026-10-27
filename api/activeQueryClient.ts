import type { QueryClient } from '@tanstack/react-query';
import { Platform } from 'react-native';

// Holds a reference to the QueryClient that is actually mounted in the React
// tree (created per-render in app/_layout.tsx and passed to QueryClientProvider).
// Non-hook code (e.g. stores/authStore.ts during boot) uses this to read/seed
// the SAME cache the UI hooks read, so a profile fetch in checkAuthentication and
// a profile fetch in useUserProfile dedupe into one network request.
//
// LC-2: this is the ONLY client in the app — the former module singleton
// (`api/queryClient.ts`) targeted a separate cache and was removed; imperative
// callers (`api/geoQueries.ts`) resolve the mounted client through here.

let activeClient: QueryClient | null = null;

export const setActiveQueryClient = (client: QueryClient | null): void => {
    // Concurrent web requests must never publish their private cache into a
    // process-wide imperative client. SSR consumers use the React provider.
    if (Platform.OS === 'web' && typeof window === 'undefined') return;
    activeClient = client;
};

export const getActiveQueryClient = (): QueryClient | null =>
    Platform.OS === 'web' && typeof window === 'undefined' ? null : activeClient;
