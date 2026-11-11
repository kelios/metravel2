import { useState, type ReactNode } from 'react'
import { useLoaderData, useLocalSearchParams } from 'expo-router'
import { jsonLdScript } from '@/components/seo/jsonLdScript'
import { buildPublicUserPersonJsonLd, publicUserProfilePath } from '@/utils/publicUserProfile'
import type { UserProfileLoaderPayload } from './userProfileRouteLoader'

const MARKER = 'user-profile'
const IS_SERVER = typeof window === 'undefined'

const routeId = (value: string | string[] | undefined): string => (Array.isArray(value) ? value[0] : value) ?? ''

/** Сервер: данные loader'а уже лежат в контексте запроса, сети нет. */
function ServerPersonJsonLd() {
  const payload = useLoaderData() as UserProfileLoaderPayload | null | undefined
  const profile = payload?.profile ?? null
  return profile ? jsonLdScript(buildPublicUserPersonJsonLd(profile), { marker: MARKER }) : null
}

/**
 * Клиент loader НЕ читает. `useLoaderData` без данных в HTML идёт в сеть за
 * `/_expo/loaders/(tabs)/user/<id>`, а этот адрес отвечает 404 и на статическом
 * шаблоне, и при переходе внутри приложения: вместо профиля встал бы экран ошибки
 * loader'а. Разметка нужна только серверному HTML, поэтому при гидрации тег
 * повторяется из DOM как есть, а на другом профиле (переход без перезагрузки)
 * снимается.
 */
function HydratedPersonJsonLd() {
  const id = routeId(useLocalSearchParams<{ id?: string | string[] }>().id)
  const [server] = useState(() => {
    const text = document.querySelector(`script[data-seo-jsonld="${MARKER}"]`)?.textContent ?? ''
    // Тег принимается только если он про этот же профиль: экран могут смонтировать
    // поверх прежнего, пока его тег ещё в DOM.
    return { id, text: text.includes(`${publicUserProfilePath(Number(id))}"`) ? text : '' }
  })
  if (!server.text || server.id !== id) return null
  return (
    <script data-seo-jsonld={MARKER} type="application/ld+json" suppressHydrationWarning>
      {server.text}
    </script>
  )
}

/** #3237: Person/ProfilePage в серверном HTML /user/<id>; сам экран профиля не меняется. */
export default function UserProfileLoaderScreen({ children }: { children: ReactNode }) {
  return (
    <>
      {IS_SERVER ? <ServerPersonJsonLd /> : <HydratedPersonJsonLd />}
      {children}
    </>
  )
}
