import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';

import MyApplicationsList from '@/components/trips/MyApplicationsList';
import MyCreatedTripsList from '@/components/trips/MyCreatedTripsList';
import TripNotificationsList from '@/components/trips/TripNotificationsList';
import Button from '@/components/ui/Button';
import Chip from '@/components/ui/Chip';
import { useMyPlannedTrips } from '@/hooks/usePlannedTripsApi';
import { useMyTripApplications } from '@/hooks/usePublicTripsApi';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

type DashboardSection = 'organized' | 'participating' | 'applications';

const SECTION_COPY: Record<DashboardSection, { title: string; description: string }> = {
  organized: {
    title: 'Поездки, которые я организую',
    description: 'Маршрут, участники и подготовка к ближайшим поездкам — в одном месте.',
  },
  participating: {
    title: 'Поездки, в которых я участвую',
    description: 'Приглашения и поездки, где организатором выступает другой путешественник.',
  },
  applications: {
    title: 'Мои заявки',
    description: 'Статусы заявок на участие в публичных поездках.',
  },
};

export default function MyTripsDashboard() {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<DashboardSection>('organized');
  const { data: plannedTrips } = useMyPlannedTrips();
  const { data: applications } = useMyTripApplications();

  const organizedCount = plannedTrips?.filter((trip) => trip.isOwner).length;
  const participatingCount = plannedTrips?.filter((trip) => !trip.isOwner).length;
  const copy = SECTION_COPY[activeSection];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.inner}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.h1}>Мои поездки</Text>
            <Text style={styles.lead}>
              Организуйте свои поездки отдельно от участия в чужих.
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Button
              label="Найти поездку"
              variant="secondary"
              size="sm"
              onPress={() => router.push('/trips')}
              icon={<Feather name="search" size={16} color={colors.primaryDark} />}
              testID="my-trips-find-cta"
            />
            <Button
              label="Организовать поездку"
              size="sm"
              onPress={() => router.push('/trips/plan/create')}
              icon={<Feather name="plus" size={16} color={colors.textOnPrimary} />}
              testID="my-trips-plan-cta"
            />
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.segments}
          accessibilityRole="tablist"
          testID="my-trips-segments"
        >
          <Chip
            label="Организую"
            count={organizedCount}
            selected={activeSection === 'organized'}
            onPress={() => setActiveSection('organized')}
            icon={<Feather name="briefcase" size={15} color={colors.primaryDark} />}
            testID="my-trips-segment-organized"
          />
          <Chip
            label="Участвую"
            count={participatingCount}
            selected={activeSection === 'participating'}
            onPress={() => setActiveSection('participating')}
            icon={<Feather name="users" size={15} color={colors.primaryDark} />}
            testID="my-trips-segment-participating"
          />
          <Chip
            label="Заявки"
            count={applications?.length}
            selected={activeSection === 'applications'}
            onPress={() => setActiveSection('applications')}
            icon={<Feather name="send" size={15} color={colors.primaryDark} />}
            testID="my-trips-segment-applications"
          />
        </ScrollView>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{copy.title}</Text>
          <Text style={styles.sectionDescription}>{copy.description}</Text>
        </View>

        {activeSection === 'organized' ? <MyCreatedTripsList role="organized" /> : null}
        {activeSection === 'participating' ? <MyCreatedTripsList role="participating" /> : null}
        {activeSection === 'applications' ? <MyApplicationsList /> : null}

        {activeSection !== 'applications' ? (
          <View style={styles.updates} testID="my-trips-updates">
            <View style={styles.updatesHeadingRow}>
              <Feather name="bell" size={18} color={colors.primaryDark} />
              <Text style={styles.updatesTitle}>Обновления по поездкам</Text>
            </View>
            <TripNotificationsList />
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 96, alignItems: 'center' },
    inner: { width: '100%', maxWidth: 1180, gap: 18 },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 14,
    },
    headerCopy: { flex: 1, minWidth: 240, gap: 5 },
    h1: { fontSize: 28, fontWeight: '900', color: colors.text },
    lead: { fontSize: 15, lineHeight: 21, color: colors.textSecondary },
    headerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    segments: { gap: 8, paddingVertical: 2 },
    sectionHeader: { gap: 4 },
    sectionTitle: { fontSize: 20, lineHeight: 26, fontWeight: '800', color: colors.text },
    sectionDescription: { fontSize: 14, lineHeight: 20, color: colors.textSecondary },
    updates: {
      gap: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 16,
      marginTop: 2,
    },
    updatesHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    updatesTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  });
