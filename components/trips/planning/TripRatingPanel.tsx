import { memo, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import StarRating from '@/components/ui/StarRating'
import Button from '@/components/ui/Button'
import type { PlannedTrip, TripParticipant } from '@/api/plannedTrips'
import type { ParticipantRatingValue } from '@/api/participantRating'
import { ApiError } from '@/api/client'
import { useMyParticipantRating, useRateParticipant } from '@/hooks/useParticipantRating'
import { useAuthStore } from '@/stores/authStore'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'


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
  const ratingQuery = useMyParticipantRating(tripId, participant.id)
  const rateMutation = useRateParticipant()
  const [review, setReview] = useState('')
  const [reviewDirty, setReviewDirty] = useState(false)

  const currentRating = ratingQuery.data?.rating ?? null
  const reviewValue = reviewDirty ? review : ratingQuery.data?.review ?? ''
  const visibleError = ratingQuery.error ?? rateMutation.error
  const errorStatus = visibleError instanceof ApiError ? visibleError.status : null
  const isRetryableLoadError =
    ratingQuery.isError && (errorStatus === null || errorStatus === 0 || errorStatus >= 500)
  const errorMessage = visibleError
    ? errorStatus === 401
      ? i18nT('trips:components.trips.planning.TripRatingPanel.sessiya_istekla_voydite_v_akkaunt_2e065fad')
      : errorStatus === 403
        ? i18nT('trips:components.trips.planning.TripRatingPanel.net_dostupa_k_otsenke_uchastnika_3a209b6b')
        : errorStatus === 404 || errorStatus === 501
          ? i18nT('trips:components.trips.planning.TripRatingPanel.otsenki_uchastnikov_poka_nedostupny_e6b71d31')
          : ratingQuery.isError
            ? i18nT('trips:components.trips.planning.TripRatingPanel.ne_udalos_zagruzit_sohranennuyu_otsenku_55246acd')
            : i18nT('trips:components.trips.planning.TripRatingPanel.ne_udalos_sohranit_otsenku_5f159a99')
    : null

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
          <Text style={styles.organizerTag}>{i18nT('trips:components.trips.planning.TripRatingPanel.organizator_a13e58c1')}</Text>
        ) : null}
      </View>

      <StarRating
        rating={currentRating}
        userRating={currentRating}
        interactive
        disabled={ratingQuery.isFetching || ratingQuery.isError || rateMutation.isPending}
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
        placeholder={i18nT('trips:components.trips.planning.TripRatingPanel.otzyv_neobyazatelno_0956b79c')}
        placeholderTextColor={colors.textMuted}
        multiline
        style={styles.reviewInput}
        editable={!!currentRating && !ratingQuery.isError && !rateMutation.isPending}
        testID={`participant-review-${participant.id}`}
      />
      {errorMessage ? (
        <View
          style={styles.errorState}
          accessibilityRole="alert"
          testID={`participant-rating-error-${participant.id}`}
        >
          <View style={styles.errorTextRow}>
            <Feather name="alert-circle" size={16} color={colors.danger} />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
          {isRetryableLoadError ? (
            <Button
              label={i18nT('trips:components.trips.planning.TripRatingPanel.povtorit_9df6f43f')}
              variant="outline"
              size="md"
              loading={ratingQuery.isFetching}
              onPress={() => {
                void ratingQuery.refetch()
              }}
              icon={<Feather name="refresh-cw" size={16} color={colors.primaryDark} />}
              testID={`participant-rating-retry-${participant.id}`}
            />
          ) : null}
        </View>
      ) : null}
      {currentRating && reviewDirty ? (
        <Pressable
          style={styles.saveReview}
          onPress={handleSaveReview}
          accessibilityRole="button"
          accessibilityLabel={i18nT('trips:components.trips.planning.TripRatingPanel.sohranit_otzyv_ob_uchastnike_value1_f42331b5', { value1: participant.name })}
        >
          <Feather name="save" size={14} color={colors.primaryDark} />
          <Text style={styles.saveReviewText}>{i18nT('trips:components.trips.planning.TripRatingPanel.sohranit_otzyv_d0515f64')}</Text>
        </Pressable>
      ) : null}
      {currentRating && !reviewDirty ? (
        <View style={styles.savedRow}>
          <Feather name="check" size={14} color={colors.primaryDark} />
          <Text style={styles.savedText}>{i18nT('trips:components.trips.planning.TripRatingPanel.otsenka_sohranena_5aa9762f')}</Text>
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
        <Feather name="star" size={18} color={colors.primaryDark} />
        <Text style={styles.heading}>{i18nT('trips:components.trips.planning.TripRatingPanel.otsenite_poputchikov_c288d016')}</Text>
      </View>
      <Text style={styles.subhead}>
        {i18nT('trips:components.trips.planning.TripRatingPanel.poezdka_zavershena_postavte_otsenku_uchastni_fac6685e')}</Text>
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
      color: colors.primaryText,
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
    saveReviewText: { fontSize: 13, fontWeight: '700', color: colors.primaryText },
    savedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    savedText: { fontSize: 12, color: colors.textMuted },
    errorState: {
      gap: 8,
      borderRadius: 10,
      padding: 10,
      backgroundColor: colors.dangerLight,
    },
    errorTextRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    errorText: { flex: 1, fontSize: 13, lineHeight: 18, color: colors.text },
  })

export default memo(TripRatingPanel)
