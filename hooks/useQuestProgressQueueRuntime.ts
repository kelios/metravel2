// Досылка отложенного прогресса квеста, не привязанная к экрану (#1922).
//
// Очередь (`utils/questProgressQueue.ts`) переживает выгрузку приложения, но
// кто-то обязан её будить. До #1922 таким будильником был только экран квеста:
// прохождение без сети лежало на телефоне, пока игрок не откроет ТОТ ЖЕ квест
// снова. Хук живёт в корневом layout, поэтому моменты пробуждения — общие для
// всего приложения: старт, возврат в активное состояние, появление сети и вход
// в аккаунт.

import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'

import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { useAuthStore } from '@/stores/authStore'
import { flushQuestProgressQueue } from '@/utils/questProgressQueue'

export function useQuestProgressQueueRuntime(): void {
    const { isConnected } = useNetworkStatus()

    // Старт приложения: очередь могла остаться с прошлого запуска.
    useEffect(() => {
        void flushQuestProgressQueue()
    }, [])

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextState) => {
            if (nextState === 'active') void flushQuestProgressQueue()
        })
        return () => subscription?.remove?.()
    }, [])

    // Сеть вернулась — дожимаем, не дожидаясь следующего шага бэкоффа очереди.
    const wasConnectedRef = useRef(isConnected)
    useEffect(() => {
        const wasOffline = !wasConnectedRef.current
        wasConnectedRef.current = isConnected
        if (isConnected && wasOffline) void flushQuestProgressQueue()
    }, [isConnected])

    // Вход в аккаунт: без токена очередь только копилась (#1921), теперь есть
    // кому отправлять. Подписка вместо селектора — состояние авторизации сюда
    // не рендерится, а лишний рендер в корневом дереве стоит дорого.
    useEffect(() => {
        let wasAuthenticated = useAuthStore.getState().isAuthenticated
        return useAuthStore.subscribe((state) => {
            const isAuthenticated = state.isAuthenticated
            const wasGuest = !wasAuthenticated
            wasAuthenticated = isAuthenticated
            if (isAuthenticated && wasGuest) void flushQuestProgressQueue()
        })
    }, [])
}
