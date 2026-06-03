import React, { memo, useCallback, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { useRouter } from 'expo-router'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import MessageBubble from '@/components/messages/MessageBubble'
import IconButton from '@/components/ui/IconButton'
import type { Message } from '@/api/messages'
import { routes } from '@/utils/routes'
import { optimizeImageUrl } from '@/utils/imageOptimization'

const SEND_COOLDOWN_MS = 300
const MAX_MESSAGE_LENGTH = 2000
const IS_WEB = Platform.OS === 'web'
const IS_IOS = Platform.OS === 'ios'

type ChatListItem =
  | { type: 'message'; data: Message }
  | { type: 'dateSeparator'; label: string; key: string }

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const sameDay = (a: Date, b: Date) =>
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()

  if (sameDay(date, now)) return 'Сегодня'

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (sameDay(date, yesterday)) return 'Вчера'

  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function getDateKey(dateStr: string | null): string {
  if (!dateStr) return 'unknown'
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function buildListItems(messages: Message[]): ChatListItem[] {
  const sorted = [...messages].sort((a, b) => {
    const da = a.created_at ? new Date(a.created_at).getTime() : Infinity
    const db = b.created_at ? new Date(b.created_at).getTime() : Infinity
    if (da !== db) return db - da
    return (b.id ?? 0) - (a.id ?? 0)
  })

  const items: ChatListItem[] = []
  for (let i = 0; i < sorted.length; i++) {
    const msg = sorted[i]
    items.push({ type: 'message', data: msg })
    const dk = getDateKey(msg.created_at)
    const nextDk = i + 1 < sorted.length ? getDateKey(sorted[i + 1].created_at) : null
    if (dk !== nextDk) {
      items.push({
        type: 'dateSeparator',
        label: formatDateLabel(msg.created_at || ''),
        key: `sep-${dk}`,
      })
    }
  }
  return items
}

interface ChatViewProps {
  messages: Message[]
  loading: boolean
  sending: boolean
  currentUserId: string | null
  otherUserName: string
  otherUserAvatar?: string | null
  otherUserId?: number | null
  onSend: (text: string) => void
  onBack: () => void
  onLoadMore?: () => void
  hasMore?: boolean
  hideBackButton?: boolean
  onDeleteMessage?: (messageId: number) => void
  onDeleteThread?: () => void
}

function ChatView({
  messages,
  loading,
  sending,
  currentUserId,
  otherUserName,
  otherUserAvatar,
  otherUserId,
  onSend,
  onBack,
  onLoadMore,
  hasMore,
  hideBackButton,
  onDeleteMessage,
  onDeleteThread,
}: ChatViewProps) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const router = useRouter()

  const [text, setText] = useState('')
  const lastSentAtRef = useRef(0)
  const currentUserIdNum = useMemo(() => {
    const n = Number(currentUserId)
    return Number.isFinite(n) ? n : null
  }, [currentUserId])

  const handleSend = useCallback(() => {
    if (sending) return
    const trimmed = text.trim()
    if (!trimmed) return
    const now = Date.now()
    if (now - lastSentAtRef.current < SEND_COOLDOWN_MS) return
    lastSentAtRef.current = now
    onSend(trimmed)
    setText('')
  }, [text, onSend, sending])

  const handleKeyPress = useCallback(
    (e: any) => {
      if (IS_WEB && e.nativeEvent?.key === 'Enter' && !e.nativeEvent?.shiftKey) {
        e.preventDefault?.()
        handleSend()
      }
    },
    [handleSend],
  )

  const handleOpenProfile = useCallback(() => {
    if (otherUserId) router.push(routes.user(otherUserId))
  }, [otherUserId, router])

  const listItems = useMemo(() => buildListItems(messages || []), [messages])

  const renderItem = useCallback(
    ({ item }: { item: ChatListItem }) => {
      if (item.type === 'dateSeparator') {
        return <DateSeparator label={item.label} styles={styles} />
      }
      const msg = item.data
      const isOwn = msg.sender === currentUserIdNum
      return (
        <MessageBubble
          message={msg}
          isOwn={isOwn}
          onDelete={isOwn && onDeleteMessage ? () => onDeleteMessage(msg.id) : undefined}
        />
      )
    },
    [currentUserIdNum, onDeleteMessage, styles],
  )

  const keyExtractor = useCallback(
    (item: ChatListItem) =>
      item.type === 'dateSeparator' ? item.key : String(item.data.id),
    [],
  )

  const canSend = text.trim().length > 0 && !sending

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={IS_IOS ? 'padding' : 'height'}
      keyboardVerticalOffset={IS_IOS ? 90 : 0}
    >
      <ChatHeader
        styles={styles}
        colors={colors}
        hideBackButton={hideBackButton}
        onBack={onBack}
        otherUserName={otherUserName}
        otherUserAvatar={otherUserAvatar}
        otherUserId={otherUserId}
        onOpenProfile={handleOpenProfile}
        onDeleteThread={onDeleteThread}
      />

      {loading && messages.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={listItems}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          inverted
          contentContainerStyle={styles.messagesList}
          onEndReached={hasMore ? onLoadMore : undefined}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={styles.emptyChatText}>
                Начните диалог — напишите сообщение
              </Text>
            </View>
          }
        />
      )}

      <ChatComposer
        styles={styles}
        colors={colors}
        text={text}
        onChangeText={setText}
        onSend={handleSend}
        onKeyPress={handleKeyPress}
        canSend={canSend}
        sending={sending}
      />
    </KeyboardAvoidingView>
  )
}

type Styles = ReturnType<typeof createStyles>

const DateSeparator = memo(function DateSeparator({
  label,
  styles,
}: {
  label: string
  styles: Styles
}) {
  return (
    <View style={styles.dateSeparator}>
      <View style={styles.dateSeparatorLine} />
      <Text style={styles.dateSeparatorText}>{label}</Text>
      <View style={styles.dateSeparatorLine} />
    </View>
  )
})

function ChatHeader({
  styles,
  colors,
  hideBackButton,
  onBack,
  otherUserName,
  otherUserAvatar,
  otherUserId,
  onOpenProfile,
  onDeleteThread,
}: {
  styles: Styles
  colors: ThemedColors
  hideBackButton?: boolean
  onBack: () => void
  otherUserName: string
  otherUserAvatar?: string | null
  otherUserId?: number | null
  onOpenProfile: () => void
  onDeleteThread?: () => void
}) {
  return (
    <View style={styles.header}>
      {!hideBackButton && (
        <Pressable
          onPress={onBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Назад к списку диалогов"
        >
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
      )}
      <Pressable
        onPress={onOpenProfile}
        disabled={!otherUserId}
        style={styles.headerProfileLink}
        accessibilityRole="link"
        accessibilityLabel={`Профиль ${otherUserName}`}
      >
        <View style={styles.headerAvatar}>
          {otherUserAvatar ? (
            <Image source={{ uri: optimizeImageUrl(otherUserAvatar, { width: 72, height: 72, quality: 70, format: 'auto', fit: 'cover' }) ?? otherUserAvatar }} style={styles.headerAvatarImage} />
          ) : (
            <Feather name="user" size={18} color={colors.primary} />
          )}
        </View>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {otherUserName}
        </Text>
      </Pressable>
      {onDeleteThread && (
        <IconButton
          icon={<Feather name="trash-2" size={16} color={colors.textSecondary} />}
          label="Удалить диалог"
          size="sm"
          onPress={onDeleteThread}
          showTooltip={IS_WEB}
        />
      )}
    </View>
  )
}

function ChatComposer({
  styles,
  colors,
  text,
  onChangeText,
  onSend,
  onKeyPress,
  canSend,
  sending,
}: {
  styles: Styles
  colors: ThemedColors
  text: string
  onChangeText: (v: string) => void
  onSend: () => void
  onKeyPress: (e: any) => void
  canSend: boolean
  sending: boolean
}) {
  const sendButtonStyle = useCallback(
    ({ pressed }: { pressed: boolean }) => [
      styles.sendButton,
      canSend ? styles.sendButtonEnabled : styles.sendButtonDisabled,
      pressed && canSend && styles.sendButtonPressed,
    ],
    [canSend, styles],
  )

  return (
    <View style={styles.inputContainer}>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={onChangeText}
        placeholder="Написать сообщение..."
        placeholderTextColor={colors.textMuted}
        multiline
        maxLength={MAX_MESSAGE_LENGTH}
        onKeyPress={onKeyPress}
        accessibilityLabel="Поле ввода сообщения"
      />
      <Pressable
        onPress={onSend}
        disabled={!canSend}
        style={sendButtonStyle}
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
  )
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    container: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      paddingVertical: DESIGN_TOKENS.spacing.sm,
      borderBottomWidth: 1,
      minHeight: 56,
      backgroundColor: colors.surface,
      borderColor: colors.borderLight,
    },
    backButton: {
      padding: DESIGN_TOKENS.spacing.xs,
      marginRight: DESIGN_TOKENS.spacing.xs,
    },
    headerProfileLink: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    headerAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: DESIGN_TOKENS.spacing.sm,
      overflow: 'hidden',
      backgroundColor: colors.primarySoft,
    },
    headerAvatarImage: { width: 36, height: 36, borderRadius: 18 },
    headerTitle: {
      flex: 1,
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
      color: colors.text,
    },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    messagesList: { paddingVertical: DESIGN_TOKENS.spacing.sm },
    emptyChat: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: DESIGN_TOKENS.spacing.xxl,
    },
    emptyChatText: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      textAlign: 'center',
      color: colors.textMuted,
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
    sendButtonPressed: { opacity: 0.85 },
    dateSeparator: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: DESIGN_TOKENS.spacing.lg,
      paddingVertical: DESIGN_TOKENS.spacing.sm,
      gap: DESIGN_TOKENS.spacing.sm,
    },
    dateSeparatorLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.borderLight,
    },
    dateSeparatorText: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
      color: colors.textMuted,
    },
  })

export default memo(ChatView)
