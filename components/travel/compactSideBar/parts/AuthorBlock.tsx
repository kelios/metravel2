import { memo, useMemo } from 'react'
import { Platform, Pressable, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { Text } from '@/ui/paper'
import type { Travel } from '@/types/types'
import { useThemedColors } from '@/hooks/useTheme'
import ImageCardMedia from '@/components/ui/ImageCardMedia'
import SubscribeButton from '@/components/ui/SubscribeButton'
import { globalFocusStyles } from '@/styles/globalFocus'
import TravelPdfExportControl from '@/components/travel/TravelPdfExportControl'

import { attachWebTitle, webOnly } from '../helpers'
import { createStyles } from '../styles'
import { translate as i18nT } from '@/i18n'


// Детерминированное форматирование тысяч: встроенное locale-форматирование может давать
// разный разделитель (U+00A0 в Node ICU vs U+202F в браузере) → расхождение
// текста при гидрации и React #418. Группируем неразрывным пробелом сами.
const formatViews = (n: number) =>
  String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

type AuthorBlockProps = {
  styles: ReturnType<typeof createStyles>
  colors: ReturnType<typeof useThemedColors>
  textColor: string
  mutedText: string
  avatarUri: string
  userName: string
  authorUserId: string | null
  canEdit: boolean
  isOwn: boolean
  travel: Travel
  whenLine: string
  views: number | null
  onOpenProfile: () => void
  onEdit: () => void
  onWrite: () => void
}

export const AuthorBlock = memo(function AuthorBlock({
  styles,
  colors,
  textColor,
  mutedText,
  avatarUri,
  userName,
  authorUserId,
  canEdit,
  isOwn,
  travel,
  whenLine,
  views,
  onOpenProfile,
  onEdit,
  onWrite,
}: AuthorBlockProps) {
  const showSubscribeAndWrite = !isOwn && !!authorUserId
  const displayName = userName || i18nT('travel:components.travel.compactSideBar.parts.AuthorBlock.userFallback')
  const editTitle = i18nT('travel:components.travel.compactSideBar.parts.AuthorBlock.redaktirovat_609c8bab')
  const writeTitle = i18nT('travel:components.travel.compactSideBar.parts.AuthorBlock.napisat_avtoru_e9dfca99')
  const editTitleRef = useMemo(() => attachWebTitle(editTitle), [editTitle])
  const writeTitleRef = useMemo(() => attachWebTitle(writeTitle), [writeTitle])

  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface }]}
      {...webOnly({ 'data-sidebar-card': true } as any)}
    >
      <View style={styles.cardRow}>
        <View style={styles.avatarWrap} {...webOnly({ 'data-sidebar-avatar': true } as any)}>
          {avatarUri ? (
            <ImageCardMedia
              src={avatarUri}
              alt={displayName}
              width={styles.avatar.width as any}
              height={styles.avatar.height as any}
              borderRadius={styles.avatar.borderRadius as any}
              fit="contain"
              blurBackground
              allowCriticalWebBlur
              priority="low"
              loading="lazy"
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]} />
          )}
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.userRow}>
            <Pressable
              onPress={onOpenProfile}
              disabled={!authorUserId}
              accessibilityRole={authorUserId ? 'button' : undefined}
              accessibilityLabel={
                authorUserId ? i18nT('travel:components.travel.compactSideBar.parts.AuthorBlock.otkryt_profil_avtora_value1_ef516528', { value1: displayName }) : undefined
              }
              style={({ pressed }) => [
                styles.userNameWrap,
                globalFocusStyles.focusable,
                pressed && authorUserId ? { opacity: 0.9 } : null,
              ]}
              {...webOnly(
                authorUserId
                  ? ({
                      cursor: 'pointer',
                      role: 'button',
                      'aria-label': i18nT('travel:components.travel.compactSideBar.parts.AuthorBlock.otkryt_profil_avtora_value1_ef516528', { value1: displayName }),
                      'data-author-name': true,
                      title: i18nT('travel:components.travel.compactSideBar.parts.AuthorBlock.otkryt_profil_avtora_value1_ef516528', { value1: displayName }),
                    } as any)
                  : {},
              )}
            >
              <Text style={[styles.userName, { color: textColor }]} numberOfLines={1}>
                <Text
                  style={[
                    styles.userNamePrimary,
                    { color: textColor },
                    authorUserId ? { textDecorationLine: 'underline' } : null,
                  ]}
                >
                  {displayName}
                </Text>
              </Text>
              {authorUserId ? (
                <Feather
                  name="chevron-right"
                  size={14}
                  color={mutedText}
                  style={{ marginLeft: 2 }}
                />
              ) : null}
            </Pressable>

            <View style={styles.actionsRow}>
              {canEdit && (
                <Pressable
                  onPress={onEdit}
                  accessibilityRole="button"
                  accessibilityLabel={i18nT('travel:components.travel.compactSideBar.parts.AuthorBlock.redaktirovat_puteshestvie_8010aa7b')}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    globalFocusStyles.focusable,
                    pressed && styles.actionBtnPressed,
                  ]}
                  ref={editTitleRef}
                  {...webOnly({
                    'data-action-btn': true,
                    role: 'button',
                    'aria-label': i18nT('travel:components.travel.compactSideBar.parts.AuthorBlock.redaktirovat_puteshestvie_8010aa7b'),
                  } as any)}
                >
                  <Feather name="edit" size={18} color={textColor} />
                </Pressable>
              )}

              {(Platform.OS === 'web') && (
                <TravelPdfExportControl
                  travel={travel}
                  mutedText={mutedText}
                  actionBtnStyle={styles.actionBtn}
                  actionBtnPressedStyle={styles.actionBtnPressed}
                  actionBtnDisabledStyle={styles.actionBtnDisabled}
                />
              )}

              {showSubscribeAndWrite && (
                <>
                  <SubscribeButton
                    targetUserId={authorUserId!}
                    iconOnly
                    style={[styles.actionBtn, globalFocusStyles.focusable]}
                  />
                  <Pressable
                    onPress={onWrite}
                    accessibilityRole="button"
                    accessibilityLabel={i18nT('travel:components.travel.compactSideBar.parts.AuthorBlock.napisat_avtoru_value1_191ed8f0', { value1: displayName })}
                    style={({ pressed }) => [
                      styles.actionBtn,
                      globalFocusStyles.focusable,
                      pressed && styles.actionBtnPressed,
                    ]}
                    ref={writeTitleRef}
                    {...webOnly({
                      'data-action-btn': true,
                      role: 'button',
                      'aria-label': i18nT('travel:components.travel.compactSideBar.parts.AuthorBlock.napisat_avtoru_value1_191ed8f0', { value1: displayName }),
                    } as any)}
                  >
                    <Feather name="mail" size={18} color={textColor} />
                  </Pressable>
                </>
              )}
            </View>
          </View>

          {(whenLine || views != null) && (
            <View style={styles.metaRow}>
              {whenLine ? (
                <View style={styles.metaPill}>
                  <Feather name="calendar" size={14} color={mutedText} />
                  <Text
                    style={[styles.metaText, { color: mutedText }]}
                    numberOfLines={1}
                  >
                    {whenLine}
                  </Text>
                </View>
              ) : null}
              {views != null && (
                <View
                  style={styles.metaPill}
                  accessibilityRole={(Platform.OS === 'web') ? undefined : 'text'}
                  accessibilityLabel={i18nT('travel:components.travel.compactSideBar.parts.AuthorBlock.value1_prosmotrov_bde67a56', { value1: formatViews(views) })}
                  {...webOnly({
                    'aria-label': i18nT('travel:components.travel.compactSideBar.parts.AuthorBlock.value1_prosmotrov_bde67a56', { value1: formatViews(views) }),
                  } as any)}
                >
                  <Feather name="eye" size={14} color={mutedText} />
                  <Text
                    style={[styles.metaText, { color: mutedText }]}
                    numberOfLines={1}
                  >
                    {formatViews(views)}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  )
})
