import React, { useEffect } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'

import { AuthProvider } from '@/context/AuthContext'
import { FavoritesProvider } from '@/context/FavoritesProvider'
import ThemedPaperProvider from '@/components/ui/ThemedPaperProvider'
import { LocaleProvider } from '@/i18n/LocaleProvider'
import { setupQueryPersistence } from '@/utils/queryPersist'

interface AppProvidersProps {
  queryClient: any
  children: React.ReactNode
  deferAuthProvider?: boolean
  authDeferMode?: 'idle' | 'interaction'
  deferFavoritesProvider?: boolean
  favoritesDeferMode?: 'idle' | 'interaction'
}

export default function AppProviders({ queryClient, children }: AppProvidersProps) {
  // #1015: persist офлайн-доменов RQ (favorites/recommendations/view-history/
  // travel-status). Идемпотентно; auth-профиль не персистится → boot-порядок цел.
  useEffect(() => {
    if (queryClient) setupQueryPersistence(queryClient)
  }, [queryClient])

  return (
    <LocaleProvider>
      <ThemedPaperProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <FavoritesProvider>{children}</FavoritesProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ThemedPaperProvider>
    </LocaleProvider>
  )
}
