import { useCallback, useMemo } from 'react';
import { View, Text, Image, StyleSheet, ActivityIndicator, Platform } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import Button from '@/components/ui/Button'
import { useThemedColors } from '@/hooks/useTheme'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { confirmAction } from '@/utils/confirmAction'
import { showToast } from '@/utils/toast'
import { useActionConsent } from '@/hooks/useActionConsent'
import { CONSENT_TYPES } from '@/utils/actionConsent'
import { optimizeImageUrl } from '@/utils/imageOptimization'
import { ApiError } from '@/api/client'
import {
  useContactRequests,
  useUpdateContactRequest,
} from '@/hooks/useContactRequestsApi'
import type {
  ContactAccessRequest,
  ContactRequestParty,
  ContactRequestStatus,
} from '@/api/contactRequests'

const SENT_STATUS_LABEL: Partial<Record<ContactRequestStatus, string>> = {
  pending: 'Ожидает ответа',
  granted: 'Контакты раскрыты',
  declined: 'Отклонён',
  revoked: 'Отозван',
}

/**
 * FE-424: входящие/исходящие заявки на раскрытие контактов в своём профиле.
 * Подтверждение (grant) показывает предупреждение о взаимном раскрытии (consent
 * CONTACT_EXCHANGE), затем переводит заявку в granted. Отклонение — без предупреждения.
 */
export function ContactRequestsInbox() {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  const receivedQuery = useContactRequests('received', 'pending')
  const sentQuery = useContactRequests('sent')
  const { mutateAsync, isPending } = useUpdateContactRequest()
  const consent = useActionConsent(CONSENT_TYPES.CONTACT_EXCHANGE)

  const received = receivedQuery.data ?? []
  // Исходящие — только осмысленные статусы (без revoked-шума).
  const sent = (sentQuery.data ?? []).filter((r) => r.status !== 'revoked')

  const handleGrant = useCallback(
    async (request: ContactAccessRequest) => {
      // Предупреждение перед взаимным раскрытием контактов (один раз / по версии).
      if (!consent.granted) {
        const confirmed = await confirmAction({
          title: 'Раскрыть контакты',
          message:
            'После подтверждения пользователь увидит ваши контакты, а вы — его. Раскрыть контакты?',
          confirmText: 'Раскрыть',
        })
        if (!confirmed) return
        await consent.grant()
      }
      try {
        await mutateAsync({ id: request.id, status: 'granted' })
        showToast({ type: 'success', text1: 'Контакты раскрыты' })
      } catch (error) {
        const message = error instanceof ApiError ? error.message : 'Не удалось подтвердить заявку'
        showToast({ type: 'error', text1: 'Ошибка', text2: message })
      }
    },
    [consent, mutateAsync],
  )

  const handleDecline = useCallback(
    async (request: ContactAccessRequest) => {
      try {
        await mutateAsync({ id: request.id, status: 'declined' })
        showToast({ type: 'success', text1: 'Заявка отклонена' })
      } catch (error) {
        const message = error instanceof ApiError ? error.message : 'Не удалось отклонить заявку'
        showToast({ type: 'error', text1: 'Ошибка', text2: message })
      }
    },
    [mutateAsync],
  )

  const renderAvatar = (party: ContactRequestParty) => {
    const uri = party.avatarUrl
      ? optimizeImageUrl(party.avatarUrl, { width: 80, height: 80, quality: 70, format: 'auto', fit: 'cover' }) ??
        party.avatarUrl
      : null
    return (
      <View style={styles.avatar}>
        {uri ? (
          <Image source={{ uri }} style={styles.avatarImage} />
        ) : (
          <Feather name="user" size={18} color={colors.primaryDark} />
        )}
      </View>
    )
  }

  if (receivedQuery.isLoading && sentQuery.isLoading) {
    return (
      <View style={styles.card}>
        <View style={styles.loader}>
          <ActivityIndicator size="small" color={colors.primaryDark} />
        </View>
      </View>
    )
  }

  const hasAny = received.length > 0 || sent.length > 0

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Feather name="user-check" size={18} color={colors.primaryDark} />
        <Text style={styles.title}>Заявки на контакты</Text>
      </View>

      {!hasAny ? (
        <Text style={styles.empty}>Новых заявок на раскрытие контактов нет.</Text>
      ) : null}

      {received.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Входящие</Text>
          {received.map((request) => (
            <View key={request.id} style={styles.row}>
              {renderAvatar(request.requester)}
              <View style={styles.rowText}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {request.requester.name}
                </Text>
                <Text style={styles.rowMeta}>хочет видеть ваши контакты</Text>
              </View>
              <View style={styles.actions}>
                <Button
                  label="Подтвердить"
                  size="sm"
                  variant="primary"
                  loading={isPending}
                  onPress={() => handleGrant(request)}
                  accessibilityLabel={`Подтвердить заявку от ${request.requester.name}`}
                  testID={`contact-request-grant-${request.id}`}
                />
                <Button
                  label="Отклонить"
                  size="sm"
                  variant="ghost"
                  loading={isPending}
                  onPress={() => handleDecline(request)}
                  accessibilityLabel={`Отклонить заявку от ${request.requester.name}`}
                  testID={`contact-request-decline-${request.id}`}
                />
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {sent.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Отправленные</Text>
          {sent.map((request) => (
            <View key={request.id} style={styles.row}>
              {renderAvatar(request.target)}
              <View style={styles.rowText}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {request.target.name}
                </Text>
                <Text style={styles.rowMeta}>
                  {SENT_STATUS_LABEL[request.status] ?? 'Запрос отправлен'}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  )
}

export default ContactRequestsInbox

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    card: {
      gap: 12,
      padding: 14,
      borderRadius: DESIGN_TOKENS.radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      ...(Platform.OS === 'web'
        ? ({ boxShadow: colors.boxShadows.card } as any)
        : Platform.OS === 'android'
          ? { elevation: 2 }
          : colors.shadows.light),
    },
    loader: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { fontSize: 16, fontWeight: '700', color: colors.text },
    empty: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
    section: { gap: 10 },
    sectionTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImage: { width: '100%', height: '100%' },
    rowText: { flex: 1, minWidth: 120, gap: 2 },
    rowName: { fontSize: 14, fontWeight: '600', color: colors.text },
    rowMeta: { fontSize: 12, color: colors.textMuted },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  })
