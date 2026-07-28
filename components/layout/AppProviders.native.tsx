import React from 'react'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'

import { AuthProvider } from '@/context/AuthContext'
import { FavoritesProvider } from '@/context/FavoritesProvider'
import ThemedPaperProvider from '@/components/ui/ThemedPaperProvider'
import { LocaleProvider } from '@/i18n/LocaleProvider'
import { queryPersistenceOptions } from '@/utils/queryPersist'

interface AppProvidersProps {
  queryClient: any
  children: React.ReactNode
  deferAuthProvider?: boolean
  authDeferMode?: 'idle' | 'interaction'
  deferFavoritesProvider?: boolean
  favoritesDeferMode?: 'idle' | 'interaction'
}

export default function AppProviders({ queryClient, children }: AppProvidersProps) {
  return (
    <LocaleProvider>
      <ThemedPaperProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={queryPersistenceOptions}
        >
          <AuthProvider>
            <FavoritesProvider>{children}</FavoritesProvider>
          </AuthProvider>
        </PersistQueryClientProvider>
      </ThemedPaperProvider>
    </LocaleProvider>
  )
}
