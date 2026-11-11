import { memo, useCallback, useMemo } from 'react'
import { Platform, Pressable, View, type GestureResponderEvent } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { Text } from '@/ui/paper'
import type { Travel } from '@/types/types'
import { useUserAchievements } from '@/hooks/useAchievementsApi'
import { useThemedColors } from '@/hooks/useTheme'
import PublicationMedals from '@/components/achievements/PublicationMedals'
import ImageCardMedia from '@/components/ui/ImageCardMedia'
import SubscribeButton from '@/components/ui/SubscribeButton'
import { globalFocusStyles } from '@/styles/globalFocus'
import TravelPdfExportControl from '@/components/travel/TravelPdfExportControl'
import { isPrintAvailable } from '@/utils/printAvailability'
import ContentSafetyActions from '@/components/safety/ContentSafetyActions'
import { makeContentRef } from '@/types/contentSafety'

import { webOnly } from '../helpers'
import { createStyles } from '../styles'
import { translate as i18nT, translatePlural } from '@/i18n'
import { webTitleRef } from '@/utils/webProps'
import { travelAuthorProfilePath } from '@/utils/travelAuthorProfile'
import { shouldHandleLinkClick, type LinkPressEvent } from '@/components/ui/LinkPressable'


// Детерминированное форматирование тысяч: встроенное locale-форматирование может давать
// разный разделитель (U+00A0 в Node ICU vs U+202F в браузере) → расхождение
// текста при гидрации и React #418. Группируем неразрывным пробелом сами.
const formatViews = (n: number) =>
  String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

function DesktopPublicationMedals({ authorId }: { authorId: string }) {
  const { data } = useUserAchievements(authorId)
  return <PublicationMedals earned={data?.earned} />
}

type AuthorBlockProps = {
  styles: ReturnType<typeof createStyles>
  colors: ReturnType<typeof useThemedColors>
  textColor: string
  mutedText: string
  avatarUri: string
  userName: string
  authorUserId: string | null
  showPublicationMedals: boolean
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
  showPublicationMedals,
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
  // #2133: жалоба на путешествие в desktop-сайдбаре (на телефоне — TravelAuthorQuickLink).
  const safetyRef = useMemo(() => makeContentRef('travel', travel?.id, authorUserId), [travel?.id, authorUserId])
  const displayName = userName || i18nT('travel:components.travel.compactSideBar.parts.AuthorBlock.userFallback')
  const avatarInitial = useMemo(() => {
    const ch = displayName?.trim().charAt(0)
    return ch ? ch.toUpperCase() : ''
  }, [displayName])
  const editTitle = i18nT('travel:components.travel.compactSideBar.parts.AuthorBlock.redaktirovat_609c8bab')
  const writeTitle = i18nT('travel:components.travel.compactSideBar.parts.AuthorBlock.napisat_avtoru_e9dfca99')
  // #3237: на web имя автора — настоящая ссылка `<a href="/user/<id>">` (как в
  // TravelAuthorQuickLink): обычный клик — переход внутри приложения, клик с
  // модификатором — браузеру.
  // #3326: адрес — тот же, что у строки меты и `author.url`; профиля без имени
  // (сервер отдаёт 404) нет — нет и `href`, переход внутри приложения остаётся.
  const profilePath = useMemo(() => travelAuthorProfilePath(travel), [travel])
  const isWebLink = Platform.OS === 'web' && !!authorUserId && !!profilePath
  const handleProfilePress = useCallback((event?: GestureResponderEvent) => {
    if (isWebLink && event) {
      const linkEvent = event as unknown as LinkPressEvent
      if (!shouldHandleLinkClick(linkEvent)) return
      linkEvent.preventDefault?.()
    }
    onOpenProfile()
  }, [isWebLink, onOpenProfile])

  return (
    <View
      testID="travel-details-author"
      style={[styles.card, { backgroundColor: colors.surface }]}
      // Маркер hover-правила карточки в `app/global.css` (#2032).
      {...webOnly({ dataSet: { sidebarCard: 'true' } })}
    >
      <View style={styles.cardRow}>
        <View style={styles.avatarWrap}>
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
            <View style={[styles.avatar, styles.avatarPlaceholder, styles.avatarPlaceholderCenter]}>
              {avatarInitial ? (
                <Text style={[styles.avatarInitial, { color: mutedText }]}>{avatarInitial}</Text>
              ) : null}
            </View>
          )}
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.userRow}>
            <Pressable
              ref={webTitleRef(authorUserId ? i18nT('travel:components.travel.compactSideBar.parts.AuthorBlock.otkryt_profil_avtora_value1_ef516528', { value1: displayName }) : null)}
              onPress={handleProfilePress}
              disabled={!authorUserId}
              accessibilityRole={authorUserId ? (isWebLink ? 'link' : 'button') : undefined}
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
                      ...(isWebLink ? { href: profilePath } : null),
                      cursor: 'pointer',
                      'aria-label': i18nT('travel:components.travel.compactSideBar.parts.AuthorBlock.otkryt_profil_avtora_value1_ef516528', { value1: displayName }),
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
                  accessibilityLabel={translatePlural('travel:components.travel.compactSideBar.parts.AuthorBlock.value1_prosmotrov_bde67a56', Math.round(views), { value1: formatViews(views) })}
                  {...webOnly({
                    'aria-label': translatePlural('travel:components.travel.compactSideBar.parts.AuthorBlock.value1_prosmotrov_bde67a56', Math.round(views), { value1: formatViews(views) }),
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

      {/* Бейдж «Автор» и действия — отдельной строкой под именем: строка имени
          не раздувается до высоты кнопок, а имя, дата и бейдж стоят по одной
          левой линии сетки. */}
      <View style={styles.footerRow}>
        {showPublicationMedals && authorUserId ? (
          <DesktopPublicationMedals key={authorUserId} authorId={authorUserId} />
        ) : null}
        <View style={styles.actionsRow}>
          {canEdit && (
            <Pressable
              onPress={onEdit}
              accessibilityRole="button"
              accessibilityLabel={i18nT('travel:components.travel.compactSideBar.parts.AuthorBlock.redaktirovat_puteshestvie_8010aa7b')}
              style={({ pressed, hovered }) => [
                styles.actionBtn,
                globalFocusStyles.focusable,
                hovered && styles.actionBtnHovered,
                pressed && styles.actionBtnPressed,
              ]}
              ref={webTitleRef(editTitle)}
              {...webOnly({
                role: 'button',
                'aria-label': i18nT('travel:components.travel.compactSideBar.parts.AuthorBlock.redaktirovat_puteshestvie_8010aa7b'),
              } as any)}
            >
              <Feather name="edit" size={18} color={textColor} />
            </Pressable>
          )}

          {isPrintAvailable() && (
            <TravelPdfExportControl
              travel={travel}
              mutedText={mutedText}
              actionBtnStyle={styles.actionBtn}
              actionBtnHoveredStyle={styles.actionBtnHovered}
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
                hoverStyle={styles.actionBtnHovered}
              />
              <Pressable
                onPress={onWrite}
                accessibilityRole="button"
                accessibilityLabel={i18nT('travel:components.travel.compactSideBar.parts.AuthorBlock.napisat_avtoru_value1_191ed8f0', { value1: displayName })}
                style={({ pressed, hovered }) => [
                  styles.actionBtn,
                  globalFocusStyles.focusable,
                  hovered && styles.actionBtnHovered,
                  pressed && styles.actionBtnPressed,
                ]}
                ref={webTitleRef(writeTitle)}
                {...webOnly({
                  role: 'button',
                  'aria-label': i18nT('travel:components.travel.compactSideBar.parts.AuthorBlock.napisat_avtoru_value1_191ed8f0', { value1: displayName }),
                } as any)}
              >
                <Feather name="mail" size={18} color={textColor} />
              </Pressable>
              <ContentSafetyActions
                contentRef={safetyRef}
                authorName={displayName}
                testIDPrefix="travel-sidebar-safety"
                style={styles.actionBtn}
              />
            </>
          )}
        </View>
      </View>
    </View>
  )
})
