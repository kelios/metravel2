import { memo, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import StarRating from '@/components/ui/StarRating'
import type { PlannedTrip, TripParticipant } from '@/api/plannedTrips'
import type { ParticipantRatingValue } from '@/api/participantRating'
import { useMyParticipantRating, useRateParticipant } from '@/hooks/useParticipantRating'
import { useAuthStore } from '@/stores/authStore'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'

interface Props {
  trip: PlannedTrip
}

const REVIEW_MAX = 1000

interface RowProps {
  tripId: number
  participant: TripParticipant
  colors: ThemedColors
  styles: ReturnType<typeof createStyles>
}

function ParticipantRatingRow({ tripId, participant, colors, styles }: RowProps) {
  const { data: existing } = useMyParticipantRating(tripId, participant.id)
  const rateMutation = useRateParticipant()
  const [review, setReview] = useState('')
  const [reviewDirty, setReviewDirty] = useState(false)

  const currentRating = existing?.rating ?? null
  const reviewValue = reviewDirty ? review : existing?.review ?? ''

  const submit = (rating: ParticipantRatingValue, reviewText: string) => {
    rateMutation.mutate({
      tripId,
      userId: participant.id,
      rating,
      review: reviewText,
    })
  }

  const handleRate = (rating: number) => {
    submit(rating as ParticipantRatingValue, reviewValue)
  }

  const handleSaveReview = () => {
    if (!currentRating) return
    submit(currentRating, reviewValue)
    setReviewDirty(false)
  }

  return (
    <View style={styles.row} testID={`participant-rating-${participant.id}`}>
      <View style={styles.rowHead}>
        <Text style={styles.participantName} numberOfLines={1}>
          {participant.name}
        </Text>
        {participant.role === 'organizer' ? (
          <Text style={styles.organizerTag}>организатор</Text>
        ) : null}
      </View>

      <StarRating
        rating={currentRating}
        userRating={currentRating}
        interactive
        disabled={rateMutation.isPending}
        onRate={handleRate}
        size="medium"
        testID={`participant-stars-${participant.id}`}
      />

      <TextInput
        value={reviewValue}
        onChangeText={(t) => {
          setReviewDirty(true)
          setReview(t.slice(0, REVIEW_MAX))
        }}
        placeholder="Отзыв (необязательно)"
        placeholderTextColor={colors.textMuted}
        multiline
        style={styles.reviewInput}
        editable={!!currentRating}
        testID={`participant-review-${participant.id}`}
      />
      {currentRating && reviewDirty ? (
        <Pressable
          style={styles.saveReview}
          onPress={handleSaveReview}
          accessibilityRole="button"
          accessibilityLabel={`Сохранить отзыв об участнике ${participant.name}`}
        >
          <Feather name="save" size={14} color={colors.primary} />
          <Text style={styles.saveReviewText}>Сохранить отзыв</Text>
        </Pressable>
      ) : null}
      {currentRating && !reviewDirty ? (
        <View style={styles.savedRow}>
          <Feather name="check" size={14} color={colors.primary} />
          <Text style={styles.savedText}>Оценка сохранена</Text>
        </View>
      ) : null}
    </View>
  )
}

function TripRatingPanel({ trip }: Props) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const currentUserId = useAuthStore((s) => s.userId)

  const me = currentUserId != null ? Number(currentUserId) : null

  // Участвую ли я в этой поездке (организатор или участник).
  const amParticipant =
    trip.isOwner ||
    trip.myRsvp != null ||
    (me != null && trip.participants.some((p) => p.id === me))

  // Оценивать можно всех соучастников, кроме себя.
  const rateable = useMemo(
    () => trip.participants.filter((p) => (me == null ? p.id !== 0 : p.id !== me)),
    [trip.participants, me],
  )

  if (trip.status !== 'completed' || !amParticipant || rateable.length === 0) {
    return null
  }

  return (
    <View style={styles.wrap} testID="trip-rating-panel">
      <View style={styles.headRow}>
        <Feather name="star" size={18} color={colors.primary} />
        <Text style={styles.heading}>Оцените попутчиков</Text>
      </View>
      <Text style={styles.subhead}>
        Поездка завершена — поставьте оценку участникам. Это помогает сообществу.
      </Text>
      {rateable.map((p) => (
        <ParticipantRatingRow
          key={p.id}
          tripId={trip.id}
          participant={p}
          colors={colors}
          styles={styles}
        />
      ))}
    </View>
  )
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    wrap: { gap: 10 },
    headRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    heading: { fontSize: 18, fontWeight: '700', color: colors.text },
    subhead: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
    row: {
      gap: 8,
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: 12,
      padding: 12,
      backgroundColor: colors.surface,
    },
    rowHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    participantName: { fontSize: 15, fontWeight: '700', color: colors.text, flexShrink: 1 },
    organizerTag: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
      backgroundColor: colors.primarySoft,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      overflow: 'hidden',
    },
    reviewInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
      color: colors.text,
      backgroundColor: colors.background,
      fontSize: 14,
      minHeight: 56,
      textAlignVertical: 'top',
      ...Platform.select({ web: { outlineWidth: 0 as unknown as number } }),
    },
    saveReview: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
    saveReviewText: { fontSize: 13, fontWeight: '700', color: colors.primary },
    savedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    savedText: { fontSize: 12, color: colors.textMuted },
  })

export default memo(TripRatingPanel)
