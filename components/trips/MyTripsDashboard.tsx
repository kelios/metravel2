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
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { translate as i18nT } from '@/i18n'


type DashboardSection = 'organized' | 'participating' | 'applications';

const SECTION_COPY: Record<DashboardSection, { title: string; description: string }> = {
  organized: {
    get title() { return i18nT('tripsStatic:components.trips.MyTripsDashboard.poezdki_kotorye_ya_organizuyu_8bb94e51') },
    get description() { return i18nT('tripsStatic:components.trips.MyTripsDashboard.marshrut_uchastniki_i_podgotovka_k_blizhaysh_8a1f5969') },
  },
  participating: {
    get title() { return i18nT('tripsStatic:components.trips.MyTripsDashboard.poezdki_v_kotoryh_ya_uchastvuyu_398e7f0a') },
    get description() { return i18nT('tripsStatic:components.trips.MyTripsDashboard.priglasheniya_i_poezdki_gde_organizatorom_vy_a2a8b685') },
  },
  applications: {
    get title() { return i18nT('tripsStatic:components.trips.MyTripsDashboard.moi_zayavki_27c7da8c') },
    get description() { return i18nT('tripsStatic:components.trips.MyTripsDashboard.statusy_zayavok_na_uchastie_v_publichnyh_poe_befaa1e9') },
  },
};

export default function MyTripsDashboard() {
  const colors = useThemedColors();
  const { isMobile } = useResponsive();
  const styles = useMemo(() => createStyles(colors, isMobile), [colors, isMobile]);
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
            <Text style={styles.h1}>{i18nT('trips:components.trips.MyTripsDashboard.moi_poezdki_f50af8c2')}</Text>
            <Text style={styles.lead}>
              {i18nT('trips:components.trips.MyTripsDashboard.organizuyte_svoi_poezdki_otdelno_ot_uchastiy_20317735')}</Text>
          </View>
          <View style={styles.headerActions}>
            <Button
              label={i18nT('trips:components.trips.MyTripsDashboard.nayti_poezdku_f3819be3')}
              variant="secondary"
              size="sm"
              fullWidth={isMobile}
              onPress={() => router.push('/trips')}
              icon={<Feather name="search" size={16} color={colors.primaryDark} />}
              testID="my-trips-find-cta"
            />
            <Button
              label={i18nT('trips:components.trips.MyTripsDashboard.organizovat_poezdku_2332a286')}
              size="sm"
              fullWidth={isMobile}
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
          testID="my-trips-segments"
        >
          <Chip
            label={i18nT('trips:components.trips.MyTripsDashboard.organizuyu_5d9149a8')}
            count={organizedCount && organizedCount > 0 ? organizedCount : undefined}
            selected={activeSection === 'organized'}
            onPress={() => setActiveSection('organized')}
            icon={isMobile ? undefined : <Feather name="briefcase" size={15} color={colors.primaryDark} />}
            testID="my-trips-segment-organized"
          />
          <Chip
            label={i18nT('trips:components.trips.MyTripsDashboard.uchastvuyu_37ab4611')}
            count={participatingCount && participatingCount > 0 ? participatingCount : undefined}
            selected={activeSection === 'participating'}
            onPress={() => setActiveSection('participating')}
            icon={isMobile ? undefined : <Feather name="users" size={15} color={colors.primaryDark} />}
            testID="my-trips-segment-participating"
          />
          <Chip
            label={i18nT('trips:components.trips.MyTripsDashboard.zayavki_b21b670c')}
            count={applications?.length ? applications.length : undefined}
            selected={activeSection === 'applications'}
            onPress={() => setActiveSection('applications')}
            icon={isMobile ? undefined : <Feather name="send" size={15} color={colors.primaryDark} />}
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
              <Text style={styles.updatesTitle}>{i18nT('trips:components.trips.MyTripsDashboard.obnovleniya_po_poezdkam_203ecc63')}</Text>
            </View>
            <TripNotificationsList />
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const createStyles = (colors: ThemedColors, isMobile: boolean) =>
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
    headerActions: {
      width: isMobile ? '100%' : undefined,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
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
