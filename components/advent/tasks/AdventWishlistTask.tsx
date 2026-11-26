import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import Button from '@/components/ui/Button'
import ImageCardMedia from '@/components/ui/ImageCardMedia'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import type { AdventPaperPalette } from '@/constants/adventVisuals'
import { useAuth } from '@/context/AuthContext'
import { formatInteger } from '@/i18n/format'
import { translate as i18nT } from '@/i18n'
import { loadTravelStatus, removeTravelStatus, setTravelStatus, useTravelStatus } from '@/stores/travelStatusStore'
import type { AdventWishlistGame, AdventWishlistPlace } from '@/types/advent'
import { useAdventPaper } from '../useAdventPaper'
import { createAdventGameStyles } from './adventGameStyles'

type Props = {
  game: AdventWishlistGame
  onOpenLink: (link: string) => void
}

type PlaceStatus = 'wishlist' | 'visited'

/**
 * Вишлист (#3487): «Был здесь» и «Хочу поехать» ставятся прямо в окне обычным
 * статусом поездки. Зачёт дверцы — только «Хочу поехать», его делает сервер
 * по `credit_rule`, поэтому здесь счётчик до цели и строка, когда цель набрана.
 */
function AdventWishlistTask({ game, onOpenLink }: Props) {
  const paper = useAdventPaper()
  const styles = useMemo(() => createAdventGameStyles(paper), [paper])
  const own = useMemo(() => createStyles(paper), [paper])
  const { userId } = useAuth((auth) => ({ userId: auth.userId }))
  const statuses = useTravelStatus()
  const [pending, setPending] = useState<{ id: number; status: PlaceStatus } | null>(null)
  const [failed, setFailed] = useState(false)
  // Статусы живут в кэше, который грузят профиль и календарь. Без догрузки окно
  // не видит «Был» или «Хочу» с сервера, и кнопка перезаписала бы «Был» на «Хочу».
  // Кнопки открываются только после подтверждённой серверной загрузки: при сбое
  // кэш может не знать «Был», и тап записал бы «Хочу» поверх (#2898).
  const [sync, setSync] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let alive = true
    setSync('loading')
    loadTravelStatus(userId ?? null)
      .then((ok) => {
        if (alive) setSync(ok ? 'ready' : 'failed')
      })
      .catch(() => {
        if (alive) setSync('failed')
      })
    return () => {
      alive = false
    }
  }, [userId, attempt])
  const synced = sync === 'ready'

  const statusOf = useCallback(
    (travelId: number) => statuses.find((entry) => String(entry.id) === String(travelId))?.status,
    [statuses],
  )
  const wished = game.places.filter((place) => statusOf(place.travelId) === 'wishlist').length
  const reached = wished >= game.goal

  const choose = useCallback(
    async (place: AdventWishlistPlace, next: PlaceStatus) => {
      const current = statusOf(place.travelId)
      setPending({ id: place.travelId, status: next })
      setFailed(false)
      try {
        if (current === next) await removeTravelStatus(place.travelId, userId ?? null)
        else
          await setTravelStatus(
            { id: place.travelId, type: 'travel', title: place.title, url: place.link, imageUrl: place.image, country: place.country, status: next },
            userId ?? null,
          )
      } catch {
        setFailed(true)
      } finally {
        setPending(null)
      }
    },
    [statusOf, userId],
  )

  return (
    <View style={styles.wrap} testID="advent-wishlist">
      <Text style={styles.lead}>{i18nT('adventStatic:game.wishlist.lead')}</Text>
      <View style={own.list}>
        {game.places.map((place) => {
          const status = statusOf(place.travelId)
          const isWished = status === 'wishlist'
          const isVisited = status === 'visited'
          const visitedLabel = isVisited ? i18nT('adventStatic:game.wishlist.visited') : i18nT('adventStatic:game.wishlist.markVisited')
          const wishlistLabel = isWished ? i18nT('adventStatic:game.wishlist.added') : i18nT('adventStatic:game.wishlist.add')
          const rowPending = pending?.id === place.travelId
          return (
            <View
              key={place.travelId}
              style={[
                own.card,
                isWished && { borderColor: paper.gold, backgroundColor: paper.tag },
                isVisited && { borderColor: paper.success },
              ]}
              testID={`advent-wishlist-place-${place.travelId}`}
            >
              <View style={own.row}>
                <Pressable onPress={() => onOpenLink(place.link)} accessibilityRole="link" accessibilityLabel={place.title} style={own.thumb}>
                  {place.image ? (
                    <ImageCardMedia src={place.image} alt={place.title} fit="cover" borderRadius={DESIGN_TOKENS.radii.sm} style={own.image} />
                  ) : (
                    <Feather name="map-pin" size={20} color={paper.inkMuted} />
                  )}
                </Pressable>
                <View style={own.body}>
                  <Text style={styles.cardText} numberOfLines={2}>
                    {place.title}
                  </Text>
                  {place.country ? <Text style={styles.meta}>{place.country}</Text> : null}
                </View>
              </View>
              <View style={own.actions}>
                <Button
                  labelNumberOfLines={2}
                  style={own.action}
                  label={visitedLabel}
                  accessibilityLabel={i18nT('adventStatic:game.wishlist.a11y', { value1: place.title, value2: visitedLabel })}
                  variant={isVisited ? 'soft' : 'outline'}
                  size="sm"
                  icon={<Feather name={isVisited ? 'flag' : 'plus'} size={14} color={paper.success} />}
                  loading={rowPending && pending.status === 'visited'}
                  disabled={pending !== null || !synced}
                  onPress={() => void choose(place, 'visited')}
                  testID={`advent-wishlist-visited-${place.travelId}`}
                />
                <Button
                  labelNumberOfLines={2}
                  style={own.action}
                  label={wishlistLabel}
                  accessibilityLabel={i18nT('adventStatic:game.wishlist.a11y', { value1: place.title, value2: wishlistLabel })}
                  variant={isWished ? 'soft' : 'outline'}
                  size="sm"
                  icon={<Feather name={isWished ? 'heart' : 'plus'} size={14} color={paper.gold} />}
                  loading={rowPending && pending.status === 'wishlist'}
                  disabled={pending !== null || !synced}
                  onPress={() => void choose(place, 'wishlist')}
                  testID={`advent-wishlist-toggle-${place.travelId}`}
                />
              </View>
            </View>
          )
        })}
      </View>
      <Text style={styles.meta} accessibilityLiveRegion="polite" testID="advent-wishlist-counter">
        {i18nT('adventStatic:game.wishlist.counter', { value1: formatInteger(Math.min(wished, game.goal)), value2: formatInteger(game.goal) })}
      </Text>
      {failed ? <Text style={styles.softText}>{i18nT('adventStatic:game.wishlist.failed')}</Text> : null}
      {sync === 'failed' ? (
        <View style={styles.soft} testID="advent-wishlist-sync-failed">
          <Text style={styles.softText}>{i18nT('adventStatic:game.wishlist.syncFailed')}</Text>
          <Button
            label={i18nT('adventStatic:game.wishlist.retry')}
            variant="outline"
            size="sm"
            labelNumberOfLines={2}
            style={own.rowButton}
            onPress={() => setAttempt((value) => value + 1)}
            testID="advent-wishlist-retry"
          />
        </View>
      ) : null}
      {reached ? (
        <View style={styles.soft} testID="advent-wishlist-reached">
          <Text style={styles.softTitle}>{i18nT('adventStatic:game.wishlist.reachedTitle')}</Text>
          <Text style={styles.softText}>{i18nT('adventStatic:game.wishlist.reached')}</Text>
        </View>
      ) : null}
    </View>
  )
}

const createStyles = (paper: AdventPaperPalette) =>
  StyleSheet.create({
    list: { gap: DESIGN_TOKENS.spacing.xs },
    card: {
      gap: DESIGN_TOKENS.spacing.xs,
      padding: DESIGN_TOKENS.spacing.xs,
      borderRadius: DESIGN_TOKENS.radii.sm,
      borderWidth: 1,
      borderColor: paper.edge,
      backgroundColor: paper.paper,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.sm,
    },
    thumb: {
      width: 56,
      height: 56,
      borderRadius: DESIGN_TOKENS.radii.sm,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: paper.tag,
    },
    image: { width: '100%', height: '100%' },
    body: { flex: 1, minWidth: 0, gap: 2 },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: DESIGN_TOKENS.spacing.xs },
    action: { flexGrow: 1, flexShrink: 1, flexBasis: 140, maxWidth: '100%' },
    rowButton: { maxWidth: '100%' },
  })

export default memo(AdventWishlistTask)
