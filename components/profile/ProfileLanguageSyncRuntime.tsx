import { useEffect, useMemo } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/api/queryKeys'
import type { UserProfileDto } from '@/api/user'
import { useLocale } from '@/i18n/LocaleProvider'
import { type SupportedLocale } from '@/i18n/config'
import { showProfileLanguageSyncError } from '@/i18n/languageSelectionFeedback'
import {
  readPersistedLocalePreference,
  resolveLocalePreference,
  subscribeLocalePreference,
} from '@/i18n/localeStorage'
import { createProfileLanguageSync } from '@/services/profileLanguageSync'
import { useAuthStore } from '@/stores/authStore'

const sessionOwner = (state: ReturnType<typeof useAuthStore.getState>): string | null =>
  state.authReady && state.isAuthenticated && state.userId ? String(state.userId) : null

export async function commitProfileLanguage(
  queryClient: QueryClient,
  owner: string,
  language: SupportedLocale,
  isCurrent: () => boolean,
) {
  if (!isCurrent()) return
  const prefix = queryKeys.userProfile(owner)[0]
  const filters = {
    predicate: (query: { queryKey: readonly unknown[] }) =>
      query.queryKey[0] === prefix && String(query.queryKey[1]) === owner,
  }
  const cancellation = queryClient.cancelQueries(filters)
  // Cancellation is synchronous. Restore active first loads before yielding:
  // a newer choice can supersede this commit while cancellation settles.
  void queryClient.refetchQueries({
    type: 'active',
    predicate: (query) => filters.predicate(query) && query.state.data === undefined,
  })
  await cancellation
  if (!isCurrent()) return
  queryClient.setQueriesData<UserProfileDto | null>(filters, (current) =>
    current ? { ...current, language } : current,
  )
}

/** Account preference is driven by deliberate storage intent, never URL/UI locale. */
export default function ProfileLanguageSyncRuntime() {
  const queryClient = useQueryClient()
  const { isHydrated } = useLocale()
  const coordinator = useMemo(() => createProfileLanguageSync({
    save: async (owner, language, isCurrent) => {
      const { updateUserProfile } = await import('@/api/user')
      if (!isCurrent()) return undefined
      return (await updateUserProfile(owner, { language })).language
    },
    commit: (owner, language, isCurrent) => commitProfileLanguage(queryClient, owner, language, isCurrent),
    onError: showProfileLanguageSyncError,
  }), [queryClient])

  useEffect(() => {
    let disposed = false
    let readRevision = 0
    let owner: string | null = null

    const refreshOwner = () => {
      const nextOwner = isHydrated ? sessionOwner(useAuthStore.getState()) : null
      if (nextOwner === owner) return
      owner = nextOwner
      coordinator.setOwner(owner)
      const revision = ++readRevision
      if (!owner) return
      void readPersistedLocalePreference().then((preference) => {
        if (!disposed && revision === readRevision && preference) {
          coordinator.select(resolveLocalePreference(preference))
        }
      })
    }

    const unsubscribeAuth = useAuthStore.subscribe(refreshOwner)
    const unsubscribePreference = subscribeLocalePreference((preference) => {
      ++readRevision // A delayed initial read cannot supersede this deliberate choice.
      if (owner) coordinator.select(resolveLocalePreference(preference))
    })
    refreshOwner()

    return () => {
      disposed = true
      ++readRevision
      unsubscribeAuth()
      unsubscribePreference()
      coordinator.setOwner(null)
    }
  }, [coordinator, isHydrated])

  return null
}
