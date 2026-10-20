import type { SupportedLocale } from '@/i18n/config'

type Dependencies = {
  save: (owner: string, language: SupportedLocale, isCurrent: () => boolean) => Promise<SupportedLocale | null | undefined>
  commit: (owner: string, language: SupportedLocale, isCurrent: () => boolean) => Promise<void>
  onError: () => void
}

/** One PUT at a time: response guards alone cannot preserve server ordering. */
export function createProfileLanguageSync({ save, commit, onError }: Dependencies) {
  let owner: string | null = null
  let session = 0
  let revision = 0
  let desired: { language: SupportedLocale; revision: number } | null = null
  let inFlight = false
  let attemptedRevision = -1

  const drain = () => {
    if (inFlight || !owner || !desired || desired.revision === attemptedRevision) return
    const attempt = { owner, session, ...desired }
    attemptedRevision = attempt.revision
    inFlight = true
    const isCurrent = () => owner === attempt.owner && session === attempt.session &&
      desired?.revision === attempt.revision

    void (async () => {
      try {
        const savedLanguage = await save(attempt.owner, attempt.language, isCurrent)
        if (!isCurrent()) return
        if (savedLanguage !== attempt.language) throw new Error('Profile language was not confirmed')
        await commit(attempt.owner, attempt.language, isCurrent)
      } catch {
        if (isCurrent()) onError()
      } finally {
        inFlight = false
        drain()
      }
    })()
  }

  return {
    setOwner(nextOwner: string | null) {
      if (owner === nextOwner) return
      owner = nextOwner
      session += 1
      desired = null
      // Never release an unresolved request, even during logout or effect cleanup.
    },
    select(language: SupportedLocale) {
      if (!owner) return
      desired = { language, revision: ++revision }
      drain()
    },
  }
}
