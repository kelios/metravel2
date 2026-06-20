import { useCallback, useEffect, useState } from 'react'
import { Platform } from 'react-native'

import {
  hasActionConsent,
  readActionConsentsAsync,
  readActionConsentsSync,
  recordActionConsent,
  type ConsentType,
} from '@/utils/actionConsent'

interface UseActionConsentResult {
  /** Согласие данного типа/версии уже зафиксировано. */
  granted: boolean
  /** Хранилище прочитано (на web — сразу true, на native — после async-гидрации). */
  hydrated: boolean
  /** Зафиксировать согласие и обновить состояние. */
  grant: () => Promise<void>
}

/**
 * Чтение/запись факта согласия для конкретного действия (квест/поездка/контакты).
 * На web состояние корректно с первого рендера (synchronous localStorage);
 * на native — гидрируется из AsyncStorage в эффекте.
 */
export function useActionConsent(type: ConsentType, version = '1'): UseActionConsentResult {
  const [granted, setGranted] = useState<boolean>(() =>
    Platform.OS === 'web' ? hasActionConsent(readActionConsentsSync(), type, version) : false,
  )
  const [hydrated, setHydrated] = useState<boolean>(Platform.OS === 'web')

  useEffect(() => {
    if (Platform.OS === 'web') {
      setGranted(hasActionConsent(readActionConsentsSync(), type, version))
      setHydrated(true)
      return undefined
    }
    let active = true
    readActionConsentsAsync().then((store) => {
      if (!active) return
      setGranted(hasActionConsent(store, type, version))
      setHydrated(true)
    })
    return () => {
      active = false
    }
  }, [type, version])

  const grant = useCallback(async () => {
    await recordActionConsent(type, version)
    setGranted(true)
  }, [type, version])

  return { granted, hydrated, grant }
}
