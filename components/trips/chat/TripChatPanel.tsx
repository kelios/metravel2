import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { useAuthStore } from '@/stores/authStore'
import type { TripChatMessage, TripChatStatus } from '@/api/tripChat'
import {
  useMarkTripChatRead,
  useSendTripMessage,
  useTripChat,
  useTripChatMessages,
} from '@/hooks/useTripChatApi'

const IS_WEB = Platform.OS === 'web'
const MAX_MESSAGE_LENGTH = 2000
const SEND_COOLDOWN_MS = 300

const STATUS_LABELS: Record<TripChatStatus, string> = {
  planned: 'Планируется',
  active: 'Активный чат',
  archived: 'Архив',
}

function formatTime(createdAt: string): string {
  try {
    const date = new Date(createdAt)
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function sortByCreatedAsc(messages: TripChatMessage[]): TripChatMessage[] {
  return [...messages].sort((a, b) => {
    const da = new Date(a.createdAt).getTime()
    const db = new Date(b.createdAt).getTime()
    if (da !== db) return da - db
    return a.id - b.id
  })
}

export function TripChatPanel({ tripId }: { tripId: number }) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const currentUserId = useAuthStore((s) => s.userId)
  const currentUserIdNum = useMemo(() => {
    const n = Number(currentUserId)
    return Number.isFinite(n) ? n : null
  }, [currentUserId])

  const threadQuery = useTripChat(tripId)
  const thread = threadQuery.data
  const threadId = thread?.threadId ?? null

  const messagesQuery = useTripChatMessages(threadId)
  const sendMutation = useSendTripMessage(threadId)
  const markRead = useMarkTripChatRead(threadId)

  const isArchived = thread?.status === 'archived' || thread?.canPost === false

  const messages = useMemo(
    () => sortByCreatedAsc(messagesQuery.data ?? []),
    [messagesQuery.data],
  )

  // Пометить тред прочитанным после загрузки сообщений (один раз на набор).
  const lastMarkedRef = useRef<number | null>(null)
  useEffect(() => {
    if (!threadId || messages.length === 0) return
    if (!thread || thread.unreadCount === 0) return
    const lastId = messages[messages.length - 1]?.id
    if (lastId == null || lastMarkedRef.current === lastId) return
    lastMarkedRef.current = lastId
    markRead.mutate(lastId)
  }, [threadId, messages, thread, markRead])

  const [text, setText] = useState('')
  const lastSentAtRef = useRef(0)
  const sending = sendMutation.isPending

  const canSend = !isArchived && text.trim().length > 0 && !sending

  const handleSend = useCallback(() => {
    if (isArchived || sending) return
    const trimmed = text.trim()
    if (!trimmed) return
    const now = Date.now()
    if (now - lastSentAtRef.current < SEND_COOLDOWN_MS) return
    lastSentAtRef.current = now
    setText('')
    sendMutation.mutate(trimmed)
  }, [isArchived, sending, text, sendMutation])

  const handleKeyPress = useCallback(
    (e: { nativeEvent?: { key?: string; shiftKey?: boolean }; preventDefault?: () => void }) => {
      if (IS_WEB && e.nativeEvent?.key === 'Enter' && !e.nativeEvent?.shiftKey) {
        e.preventDefault?.()
        handleSend()
      }
    },
    [handleSend],
  )

  const renderItem = useCallback(
    ({ item }: { item: TripChatMessage }) => {
      const isOwn = currentUserIdNum != null && item.senderId === currentUserIdNum
      return <ChatMessageRow message={item} isOwn={isOwn} styles={styles} colors={colors} />
    },
    [currentUserIdNum, styles, colors],
  )

  const keyExtractor = useCallback((item: TripChatMessage) => String(item.id), [])

  // ── Загрузка треда ──
  if (threadQuery.isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.skeletonWrap}>
          <SkeletonLoader width="60%" height={32} borderRadius={16} />
          <SkeletonLoader width="80%" height={32} borderRadius={16} style={styles.skeletonRight} />
          <SkeletonLoader width="50%" height={32} borderRadius={16} />
        </View>
      </View>
    )
  }

  if (threadQuery.isError || !thread) {
    return (
      <View style={[styles.container, styles.center]}>
        <Feather name="message-circle" size={28} color={colors.textMuted} />
        <Text style={styles.stateText}>Не удалось загрузить чат поездки</Text>
      </View>
    )
  }

  const statusLabel = STATUS_LABELS[thread.status] ?? thread.status

  return (
    <View style={styles.container}>
      <View style={styles.statusRow}>
        <View
          style={[
            styles.statusChip,
            isArchived
              ? { backgroundColor: colors.surfaceMuted }
              : { backgroundColor: colors.successSoft },
          ]}
        >
          <Feather
            name={isArchived ? 'archive' : 'message-circle'}
            size={13}
            color={isArchived ? colors.textSecondary : colors.success}
          />
          <Text
            style={[
              styles.statusChipText,
              { color: isArchived ? colors.textSecondary : colors.success },
            ]}
          >
            {statusLabel}
          </Text>
        </View>
      </View>

      {messagesQuery.isLoading && messages.length === 0 ? (
        <View style={styles.skeletonWrap}>
          <SkeletonLoader width="55%" height={36} borderRadius={14} />
          <SkeletonLoader width="70%" height={36} borderRadius={14} style={styles.skeletonRight} />
          <SkeletonLoader width="45%" height={36} borderRadius={14} />
        </View>
      ) : messages.length === 0 ? (
        <View style={[styles.center, styles.emptyWrap]}>
          <Feather name="message-square" size={26} color={colors.textMuted} />
          <Text style={styles.stateText}>
            {isArchived
              ? 'В этом чате не было сообщений'
              : 'Сообщений пока нет — начните общение'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.messagesList}
        />
      )}

      {isArchived ? (
        <View style={styles.archiveBanner}>
          <Feather name="archive" size={16} color={colors.textSecondary} />
          <Text style={styles.archiveBannerText}>Поездка завершена — чат в архиве</Text>
        </View>
      ) : (
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Написать сообщение..."
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={MAX_MESSAGE_LENGTH}
            onKeyPress={handleKeyPress}
            accessibilityLabel="Поле ввода сообщения чата поездки"
          />
          <Pressable
            onPress={handleSend}
            disabled={!canSend}
            style={[
              styles.sendButton,
              canSend ? styles.sendButtonEnabled : styles.sendButtonDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Отправить сообщение"
          >
            {sending ? (
              <ActivityIndicator size="small" color={colors.textInverse} />
            ) : (
              <Feather
                name="send"
                size={18}
                color={canSend ? colors.textInverse : colors.textMuted}
              />
            )}
          </Pressable>
        </View>
      )}
    </View>
  )
}

type Styles = ReturnType<typeof createStyles>

function ChatMessageRow({
  message,
  isOwn,
  styles,
  colors,
}: {
  message: TripChatMessage
  isOwn: boolean
  styles: Styles
  colors: ThemedColors
}) {
  const time = formatTime(message.createdAt)
  return (
    <View style={[styles.bubbleRow, isOwn ? styles.bubbleRowOwn : styles.bubbleRowOther]}>
      <View
        style={[
          styles.bubble,
          isOwn
            ? [styles.bubbleOwn, { backgroundColor: colors.primary }]
            : [styles.bubbleOther, { backgroundColor: colors.surface, borderColor: colors.borderLight }],
        ]}
      >
        <Text
          style={[styles.bubbleText, { color: isOwn ? colors.textInverse : colors.text }]}
          selectable
        >
          {message.text}
        </Text>
        {!!time && (
          <Text
            style={[
              styles.bubbleTime,
              { color: isOwn ? colors.textInverse : colors.textMuted, opacity: isOwn ? 0.7 : 1 },
            ]}
          >
            {time}
          </Text>
        )}
      </View>
    </View>
  )
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    container: { flex: 1, minHeight: 200 },
    center: { alignItems: 'center', justifyContent: 'center' },
    statusRow: {
      flexDirection: 'row',
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      paddingTop: DESIGN_TOKENS.spacing.sm,
      paddingBottom: DESIGN_TOKENS.spacing.xs,
    },
    statusChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      paddingVertical: 4,
      borderRadius: DESIGN_TOKENS.radii.pill,
    },
    statusChipText: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
    },
    skeletonWrap: {
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      paddingVertical: DESIGN_TOKENS.spacing.md,
      gap: DESIGN_TOKENS.spacing.sm,
    },
    skeletonRight: { alignSelf: 'flex-end' },
    emptyWrap: {
      flex: 1,
      paddingVertical: DESIGN_TOKENS.spacing.xxl,
      gap: DESIGN_TOKENS.spacing.sm,
    },
    stateText: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      textAlign: 'center',
      color: colors.textMuted,
    },
    messagesList: {
      paddingVertical: DESIGN_TOKENS.spacing.sm,
    },
    bubbleRow: {
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      marginBottom: DESIGN_TOKENS.spacing.sm,
    },
    bubbleRowOwn: { alignItems: 'flex-end' },
    bubbleRowOther: { alignItems: 'flex-start' },
    bubble: {
      maxWidth: '75%' as any,
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      paddingVertical: DESIGN_TOKENS.spacing.sm,
      borderRadius: DESIGN_TOKENS.radii.lg,
    },
    bubbleOwn: { borderBottomRightRadius: 4 },
    bubbleOther: { borderBottomLeftRadius: 4, borderWidth: 1 },
    bubbleText: {
      fontSize: 15,
      lineHeight: 21,
      ...(IS_WEB ? { wordBreak: 'break-word' as any } : {}),
    },
    bubbleTime: {
      fontSize: 11,
      marginTop: 4,
      textAlign: 'right',
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      paddingVertical: DESIGN_TOKENS.spacing.sm,
      borderTopWidth: 1,
      gap: DESIGN_TOKENS.spacing.xs,
      backgroundColor: colors.surface,
      borderColor: colors.borderLight,
    },
    input: {
      flex: 1,
      borderWidth: 1,
      borderRadius: DESIGN_TOKENS.radii.lg,
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      paddingVertical: DESIGN_TOKENS.spacing.sm,
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      maxHeight: 120,
      minHeight: 42,
      backgroundColor: colors.backgroundSecondary,
      color: colors.text,
      borderColor: colors.borderLight,
      ...(IS_WEB ? ({ outlineStyle: 'none' as any }) : {}),
    },
    sendButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendButtonEnabled: { backgroundColor: colors.primary },
    sendButtonDisabled: { backgroundColor: colors.backgroundSecondary },
    archiveBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: DESIGN_TOKENS.spacing.sm,
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      paddingVertical: DESIGN_TOKENS.spacing.md,
      borderTopWidth: 1,
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.borderLight,
    },
    archiveBannerText: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
      color: colors.textSecondary,
    },
  })

export default TripChatPanel
