import type { Href } from 'expo-router'

export const routes = {
  user: (userId: string | number): Href =>
    `/user/${encodeURIComponent(String(userId))}` as Href,
  messages: (userId: string | number): Href =>
    `/messages?userId=${encodeURIComponent(String(userId))}` as Href,
}
