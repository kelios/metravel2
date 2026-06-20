// components/trips/PublicTripDetail.tsx
// Деталь публичной поездки: обложка, описание, действие «Хочу поехать» (#412),
// панель организатора (#413) и раскрытие места встречи/чата только участнику с
// одобренной заявкой (FE-сторона BE-post-approval-reveal #410).
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';

import ImageCardMedia from '@/components/ui/ImageCardMedia';
import Button from '@/components/ui/Button';
import TripStatusBadge from '@/components/trips/TripStatusBadge';
import TripApplyForm from '@/components/trips/TripApplyForm';
import OrganizerApplicationsPanel from '@/components/trips/OrganizerApplicationsPanel';
import { formatSeats, formatTripDates } from '@/components/trips/tripFormatting';
import { usePublicTrip } from '@/hooks/usePublicTripsApi';
import { useActionConsent } from '@/hooks/useActionConsent';
import { CONSENT_TYPES } from '@/utils/actionConsent';
import { useAuthStore } from '@/stores/authStore';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { trackTripViewed } from '@/utils/tripAnalytics';

interface Props {
  tripId: number;
}

function InfoChip({ icon, text }: { icon: keyof typeof Feather.glyphMap; text: string }) {
  const colors = useThemedColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Feather name={icon} size={14} color={colors.textMuted} />
      <Text style={{ fontSize: 14, color: colors.textSecondary, fontWeight: '600' }}>
        {text}
      </Text>
    </View>
  );
}

function PublicTripDetail({ tripId }: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const contactConsent = useActionConsent(CONSENT_TYPES.CONTACT_EXCHANGE);
  const { data: trip, isLoading, isError } = usePublicTrip(tripId);

  useEffect(() => {
    if (trip) trackTripViewed(trip.id, trip.featured);
  }, [trip]);

  if (isLoading) {
    return (
      <View style={styles.center} testID="trip-detail-loading">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (isError || !trip) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>Поездка не найдена.</Text>
        <Button label="К каталогу" variant="outline" onPress={() => router.push('/trips')} />
      </View>
    );
  }

  const approved = trip.myApplicationStatus === 'approved';
  const revealed = approved || trip.isOwner;
  const hasRevealContent = revealed && (!!trip.meetingPoint || !!trip.contactNote);
  // Перед показом контактов/места встречи другого человека участник один раз
  // подтверждает ответственность («Понятно»). Организатору (свои данные) — не нужно.
  const needsContactAck =
    hasRevealContent && approved && !trip.isOwner && contactConsent.hydrated && !contactConsent.granted;
  const alreadyApplied = trip.myApplicationStatus != null && trip.myApplicationStatus !== 'cancelled';
  const canApply = !trip.isOwner && trip.status === 'open' && !alreadyApplied;

  return (
    <View style={styles.wrap} testID={`trip-detail-${trip.id}`}>
      <View style={styles.hero}>
        <ImageCardMedia
          src={trip.coverUrl}
          alt={trip.title}
          height={240}
          fit="contain"
          blurBackground
        />
      </View>

      <View style={styles.headerRow}>
        <Text style={styles.title}>{trip.title}</Text>
        <TripStatusBadge kind="trip" status={trip.status} />
      </View>

      <View style={styles.chips}>
        <InfoChip icon="map-pin" text={trip.region} />
        <InfoChip icon="calendar" text={formatTripDates(trip)} />
        <InfoChip icon="users" text={formatSeats(trip)} />
        {trip.tripType ? <InfoChip icon="tag" text={trip.tripType} /> : null}
      </View>

      <Pressable
        style={styles.organizer}
        onPress={() => router.push(`/user/${trip.organizer.id}`)}
        accessibilityRole="link"
      >
        <View style={styles.organizerAvatar}>
          <Feather name="user" size={16} color={colors.textMuted} />
        </View>
        <Text style={styles.organizerText}>
          Организатор: <Text style={styles.organizerName}>{trip.organizer.name}</Text>
        </Text>
      </Pressable>

      <Text style={styles.description}>{trip.description}</Text>

      {hasRevealContent ? (
        needsContactAck ? (
          <View style={styles.ackBox} testID="trip-contact-ack">
            <Text style={styles.revealTitle}>
              <Feather name="alert-triangle" size={14} color={colors.warning} /> Контакты участника
            </Text>
            <Text style={styles.revealText}>
              Дальше — место встречи и контакты другого человека. Используйте их
              только для этой поездки и не передавайте третьим лицам. MeTravel не
              отвечает за договорённости участников.
            </Text>
            <Button
              label="Понятно"
              onPress={() => {
                void contactConsent.grant();
              }}
              testID="trip-contact-ack-confirm"
            />
          </View>
        ) : (
          <View style={styles.revealBox} testID="trip-reveal">
            <Text style={styles.revealTitle}>
              <Feather name="unlock" size={14} color={colors.success} /> Детали для участников
            </Text>
            {trip.meetingPoint ? (
              <Text style={styles.revealText}>Место встречи: {trip.meetingPoint}</Text>
            ) : null}
            {trip.contactNote ? (
              <Text style={styles.revealText}>{trip.contactNote}</Text>
            ) : null}
          </View>
        )
      ) : !revealed ? (
        <View style={styles.lockedBox}>
          <Feather name="lock" size={14} color={colors.textMuted} />
          <Text style={styles.lockedText}>
            Место встречи, чат и контакты откроются после одобрения вашей заявки.
          </Text>
        </View>
      ) : null}

      {/* Организатор: управление заявками (#413) */}
      {trip.isOwner ? <OrganizerApplicationsPanel tripId={trip.id} /> : null}

      {/* Подтверждение только что отправленной заявки (#412) */}
      {justSubmitted ? (
        <View style={styles.revealBox} testID="trip-apply-confirmation">
          <Text style={styles.revealTitle}>Заявка отправлена</Text>
          <Text style={styles.revealText}>
            Организатор получит уведомление и решит по вашей заявке. Статус видно
            в разделе «Мои поездки».
          </Text>
        </View>
      ) : null}

      {/* Участник: статус своей заявки или форма подачи (#412/#414) */}
      {!trip.isOwner && alreadyApplied && !justSubmitted ? (
        <View style={styles.statusBox}>
          <Text style={styles.statusLabel}>Ваша заявка</Text>
          <TripStatusBadge kind="application" status={trip.myApplicationStatus!} />
        </View>
      ) : null}

      {canApply && !justSubmitted ? (
        isAuthenticated ? (
          <View style={styles.applyBox}>
            <TripApplyForm trip={trip} onSubmitted={() => setJustSubmitted(true)} />
          </View>
        ) : (
          <View style={styles.applyBox}>
            <Text style={styles.loginHint}>Войдите, чтобы подать заявку на поездку.</Text>
            <Button label="Войти" onPress={() => router.push('/login')} fullWidth />
          </View>
        )
      ) : null}

      {!trip.isOwner && trip.status === 'full' && !alreadyApplied ? (
        <Text style={styles.empty}>Мест больше нет — заявки закрыты.</Text>
      ) : null}
    </View>
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    wrap: { gap: 14 },
    center: { paddingVertical: 48, alignItems: 'center', gap: 12 },
    empty: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
    hero: {
      height: 240,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: colors.backgroundSecondary,
    },
    headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    title: { flex: 1, fontSize: 24, fontWeight: '800', color: colors.text, lineHeight: 30 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
    organizer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    organizerAvatar: {
      width: 30,
      height: 30,
      borderRadius: 999,
      backgroundColor: colors.backgroundSecondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    organizerText: { fontSize: 14, color: colors.textSecondary },
    organizerName: { fontWeight: '700', color: colors.text },
    description: { fontSize: 15, lineHeight: 22, color: colors.text },
    revealBox: {
      gap: 4,
      padding: 14,
      borderRadius: 14,
      backgroundColor: colors.successLight,
    },
    ackBox: {
      gap: 10,
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.warning,
      backgroundColor: colors.warningLight,
    },
    revealTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
    revealText: { fontSize: 14, lineHeight: 20, color: colors.textSecondary },
    lockedBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    lockedText: { flex: 1, fontSize: 13, lineHeight: 18, color: colors.textMuted },
    statusBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 12,
      borderRadius: 12,
      backgroundColor: colors.backgroundSecondary,
    },
    statusLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
    applyBox: {
      gap: 10,
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    loginHint: { fontSize: 14, color: colors.textSecondary },
  });

export default React.memo(PublicTripDetail);
