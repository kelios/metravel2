// components/trips/OrganizerApplicationsPanel.tsx
// Панель организатора (#413): список заявок с профилем/активностью/бейджами
// заявителя и действиями accept / reject / задать вопрос. Только для организатора.
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import Button from '@/components/ui/Button';
import TripStatusBadge from '@/components/trips/TripStatusBadge';
import type { TripApplication } from '@/api/publicTrips';
import { useDecideApplication, useTripApplications } from '@/hooks/usePublicTripsApi';
import { openExternalUrl } from '@/utils/externalLinks';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

interface Props {
  tripId: number;
}

const isDecidable = (a: TripApplication) => a.status === 'new' || a.status === 'pending';

function ApplicationRow({
  application,
  onDecide,
  pending,
}: {
  application: TripApplication;
  onDecide: (decision: 'approve' | 'reject') => void;
  pending: boolean;
}) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [askOpen, setAskOpen] = useState(false);
  const { applicant } = application;

  return (
    <View style={styles.card} testID={`trip-application-${application.id}`}>
      <View style={styles.headerRow}>
        <View style={styles.avatar}>
          <Feather name="user" size={18} color={colors.textMuted} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.name}>{applicant.name}</Text>
          {applicant.activitySummary ? (
            <Text style={styles.activity}>{applicant.activitySummary}</Text>
          ) : null}
        </View>
        <TripStatusBadge kind="application" status={application.status} />
      </View>

      {applicant.badges.length > 0 ? (
        <View style={styles.badgeRow}>
          {applicant.badges.map((b) => (
            <View key={b} style={styles.badgePill}>
              <Feather name="award" size={11} color={colors.primaryDark} />
              <Text style={styles.badgePillText}>{b}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <Text style={styles.message}>{application.message}</Text>

      {application.socialLinks.length > 0 ? (
        <>
          <View style={styles.linksRow}>
            {application.socialLinks.map((url) => (
              <Pressable
                key={url}
                onPress={() => openExternalUrl(url)}
                accessibilityRole="link"
                style={styles.linkChip}
              >
                <Feather name="link" size={11} color={colors.primaryDark} />
                <Text style={styles.linkChipText} numberOfLines={1}>
                  {url.replace(/^https?:\/\//, '')}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.unverifiedNote} testID="trip-socials-unverified">
            <Feather name="alert-triangle" size={11} color={colors.textMuted} />
            <Text style={styles.unverifiedNoteText}>
              MeTravel не проверяет подлинность аккаунтов. Открывайте ссылки с
              осторожностью.
            </Text>
          </View>
        </>
      ) : null}

      {isDecidable(application) ? (
        <View style={styles.actions}>
          <Button
            label="Принять"
            size="sm"
            onPress={() => onDecide('approve')}
            loading={pending}
            disabled={pending}
            testID={`trip-application-${application.id}-approve`}
          />
          <Button
            label="Отклонить"
            size="sm"
            variant="outline"
            onPress={() => onDecide('reject')}
            disabled={pending}
            testID={`trip-application-${application.id}-reject`}
          />
          <Button
            label="Вопрос"
            size="sm"
            variant="ghost"
            icon={<Feather name="message-circle" size={14} color={colors.primaryDark} />}
            onPress={() => setAskOpen((v) => !v)}
            testID={`trip-application-${application.id}-ask`}
          />
        </View>
      ) : null}

      {askOpen ? (
        <Text style={styles.askHint}>
          Напишите заявителю в личных сообщениях или по ссылке из его профиля,
          чтобы уточнить детали перед решением.
        </Text>
      ) : null}
    </View>
  );
}

function OrganizerApplicationsPanel({ tripId }: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data, isLoading, isError } = useTripApplications(tripId);
  const decide = useDecideApplication();
  const [pendingId, setPendingId] = useState<number | null>(null);

  const handleDecide = (application: TripApplication, decision: 'approve' | 'reject') => {
    setPendingId(application.id);
    decide.mutate(
      { applicationId: application.id, tripId, decision },
      { onSettled: () => setPendingId(null) },
    );
  };

  if (isLoading) {
    return (
      <View style={styles.center} testID="trip-applications-loading">
        <ActivityIndicator color={colors.primaryDark} />
      </View>
    );
  }
  if (isError) {
    return <Text style={styles.empty}>Не удалось загрузить заявки.</Text>;
  }

  const applications = data ?? [];

  return (
    <View style={styles.wrap} testID="organizer-applications-panel">
      <Text style={styles.title}>Заявки на участие ({applications.length})</Text>
      {applications.length === 0 ? (
        <Text style={styles.empty}>Заявок пока нет. Поделитесь поездкой, чтобы её увидели.</Text>
      ) : (
        applications.map((a) => (
          <ApplicationRow
            key={a.id}
            application={a}
            pending={pendingId === a.id}
            onDecide={(decision) => handleDecide(a, decision)}
          />
        ))
      )}
    </View>
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    wrap: { gap: 12 },
    title: { fontSize: 18, fontWeight: '700', color: colors.text },
    center: { paddingVertical: 24, alignItems: 'center' },
    empty: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
    card: {
      gap: 8,
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    avatar: {
      width: 38,
      height: 38,
      borderRadius: 999,
      backgroundColor: colors.backgroundSecondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerText: { flex: 1 },
    name: { fontSize: 15, fontWeight: '700', color: colors.text },
    activity: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
    badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    badgePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: colors.backgroundSecondary,
    },
    badgePillText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
    message: { fontSize: 14, lineHeight: 20, color: colors.text },
    linksRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    linkChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      maxWidth: 220,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
    },
    linkChipText: { fontSize: 12, color: colors.primaryText, flexShrink: 1 },
    unverifiedNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
    unverifiedNoteText: { flex: 1, fontSize: 11, lineHeight: 15, color: colors.textMuted },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
    askHint: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.textSecondary,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 10,
      padding: 10,
    },
  });

export default React.memo(OrganizerApplicationsPanel);
