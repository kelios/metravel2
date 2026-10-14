import { useSyncExternalStore } from 'react'
import { resolveSupportedLocale } from './config'
import i18n from './instance'

// Locale is a stable primitive snapshot. Repeated languageChanged events for
// the same locale do not invalidate React or restart effects. The server reads
// the same active boot/URL locale as the translation runtime (#2239/#2327).
const getSnapshot = () => resolveSupportedLocale([i18n.resolvedLanguage, i18n.language])
const subscribe = (notify: () => void) => {
  i18n.on('languageChanged', notify)
  return () => { i18n.off('languageChanged', notify) }
}

export function useLocaleRevision() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
