import React from 'react'
import { QueryClientProvider } from '@tanstack/react-query'

import { AuthProvider } from '@/context/AuthContext'
import { FavoritesProvider } from '@/context/FavoritesProvider'
import ThemedPaperProvider from '@/components/ui/ThemedPaperProvider'

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
    <ThemedPaperProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <FavoritesProvider>{children}</FavoritesProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemedPaperProvider>
  )
}
