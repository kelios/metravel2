import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/context/AuthContext';
import { FavoritesProvider } from '@/context/FavoritesContext';
import { FiltersProvider } from '@/context/FiltersProvider';
import ThemedPaperProvider from '@/components/ui/ThemedPaperProvider';

interface AppProvidersProps {
  queryClient: any;
  children: React.ReactNode;
}

export default function AppProviders({ queryClient, children }: AppProvidersProps) {
  return (
    <ThemedPaperProvider>
      <AuthProvider>
        <FavoritesProvider>
          <QueryClientProvider client={queryClient}>
            <FiltersProvider>
              {children}
            </FiltersProvider>
          </QueryClientProvider>
        </FavoritesProvider>
      </AuthProvider>
    </ThemedPaperProvider>
  );
}
