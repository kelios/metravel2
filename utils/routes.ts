import type { Href } from 'expo-router'

export const routes = {
  user: (userId: string | number): Href =>
    `/user/${encodeURIComponent(String(userId))}` as Href,
  messages: (userId: string | number): Href =>
    ({
      pathname: '/messages',
      params: { userId: String(userId) },
    }) as Href,
}
