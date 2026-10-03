import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';

import MyApplicationsList from '@/components/trips/MyApplicationsList';
import MyCreatedTripsList from '@/components/trips/MyCreatedTripsList';
import TripNotificationsList from '@/components/trips/TripNotificationsList';
import { asBottomDimension, useScrollBottomPadding } from '@/components/layout/bottomChromeInset';
import ScreenHeader from '@/components/ui/ScreenHeader';
import { useIsScreenHeaderMobile, useScreenHeader } from '@/components/layout/ScreenHeaderContext';
import Chip from '@/components/ui/Chip';
import { useAuthedQuerySettled } from '@/hooks/useAuthedQuerySettled';
import { useMyPlannedTrips } from '@/hooks/usePlannedTripsApi';
import { useMyTripApplications, useTripNotifications } from '@/hooks/usePublicTripsApi';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { translate as i18nT } from '@/i18n'
import { SCREEN_HEADER_DESKTOP_PROPS } from '@/utils/webProps'


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
  const contentPaddingBottom = useScrollBottomPadding(32);
  const styles = useMemo(() => createStyles(colors, isMobile, contentPaddingBottom), [colors, contentPaddingBottom, isMobile]);
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<DashboardSection>('organized');
  const plannedTripsQuery = useMyPlannedTrips();
  const applicationsQuery = useMyTripApplications();
  const plannedTrips = plannedTripsQuery.data;
  const applications = applicationsQuery.data;
  // «Нет данных» ≠ «пусто»: пока авторизация поднимается, запросы выключены (#2114).
  const plannedTripsLoading = !useAuthedQuerySettled(plannedTripsQuery);
  const applicationsLoading = !useAuthedQuerySettled(applicationsQuery);
  // #2114: уведомления запрашиваются сразу при входе (тот же кэш, что у
  // TripNotificationsList), но блок монтируется только под устоявшимся списком —
  // иначе он стоит в первом экране над скелетоном, и реальные карточки сдвигают его.
  useTripNotifications();

  const organizedCount = plannedTrips?.filter((trip) => trip.isOwner).length;
  const participatingCount = plannedTrips?.filter((trip) => !trip.isOwner).length;
  const activeListSettled = activeSection === 'applications' ? !applicationsLoading : !plannedTripsLoading;
  const copy = SECTION_COPY[activeSection];
  const isHeaderMobile = useIsScreenHeaderMobile();

  // #2099: заголовок, пояснения и «организовать» объявляются один раз. На телефоне
  // это строка «←» (название, (i) с пояснением разделов, «+»), на desktop — прежние
  // H1, описание и кнопки в теле. Поиск по каталогу остаётся только на desktop.
  const header = useScreenHeader({
    title: i18nT('trips:components.trips.MyTripsDashboard.moi_poezdki_f50af8c2'),
    info: [
      i18nT('trips:components.trips.MyTripsDashboard.organizuyte_svoi_poezdki_otdelno_ot_uchastiy_20317735'),
      ...(Object.values(SECTION_COPY) as Array<{ title: string; description: string }>).map(
        (section) => `${section.title}. ${section.description}`,
      ),
    ],
    actions: isHeaderMobile
      ? undefined
      : [
          {
            icon: 'search',
            label: i18nT('trips:components.trips.MyTripsDashboard.nayti_poezdku_f3819be3'),
            onPress: () => router.push('/trips'),
            testID: 'my-trips-find-cta',
          },
        ],
    primaryAction: {
      icon: 'plus',
      label: i18nT('trips:components.trips.MyTripsDashboard.organizovat_poezdku_2332a286'),
      onPress: () => router.push('/trips/plan/create'),
      testID: 'my-trips-plan-cta',
    },
  });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.inner}>
        <ScreenHeader header={header} />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.segments}
          testID="my-trips-segments"
        >
          <Chip
            label={i18nT('trips:components.trips.MyTripsDashboard.organizuyu_5d9149a8')}
            count={organizedCount}
            countPending={plannedTripsLoading}
            selected={activeSection === 'organized'}
            onPress={() => setActiveSection('organized')}
            icon={isMobile ? undefined : <Feather name="briefcase" size={15} color={colors.primaryDark} />}
            testID="my-trips-segment-organized"
          />
          <Chip
            label={i18nT('trips:components.trips.MyTripsDashboard.uchastvuyu_37ab4611')}
            count={participatingCount}
            countPending={plannedTripsLoading}
            selected={activeSection === 'participating'}
            onPress={() => setActiveSection('participating')}
            icon={isMobile ? undefined : <Feather name="users" size={15} color={colors.primaryDark} />}
            testID="my-trips-segment-participating"
          />
          <Chip
            label={i18nT('trips:components.trips.MyTripsDashboard.zayavki_b21b670c')}
            count={applications?.length}
            countPending={applicationsLoading}
            selected={activeSection === 'applications'}
            onPress={() => setActiveSection('applications')}
            icon={isMobile ? undefined : <Feather name="send" size={15} color={colors.primaryDark} />}
            testID="my-trips-segment-applications"
          />
        </ScrollView>

        {isHeaderMobile ? null : (
          <View style={styles.sectionHeader} {...SCREEN_HEADER_DESKTOP_PROPS}>
            <Text style={styles.sectionTitle}>{copy.title}</Text>
            <Text style={styles.sectionDescription}>{copy.description}</Text>
          </View>
        )}

        {activeSection === 'organized' ? <MyCreatedTripsList role="organized" /> : null}
        {activeSection === 'participating' ? <MyCreatedTripsList role="participating" /> : null}
        {activeSection === 'applications' ? <MyApplicationsList /> : null}

        {activeSection !== 'applications' && activeListSettled ? (
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

const createStyles = (colors: ThemedColors, isMobile: boolean, contentPaddingBottom: number | string) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: asBottomDimension(contentPaddingBottom), alignItems: 'center' },
    inner: { width: '100%', maxWidth: 1180, gap: 18 },
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
