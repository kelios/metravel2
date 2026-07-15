import type { StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import EmptyState from '@/components/ui/EmptyState';
import { translate as i18nT } from '@/i18n';
import { buildLoginHref } from '@/utils/authNavigation';

export type ListTravelOwnUserGateMode = 'bootstrap' | 'login';

export const getListTravelOwnUserGateMode = ({
  authReady,
  hydrationReady,
  isAuthenticated,
  requiresOwnUser,
}: {
  authReady: boolean;
  hydrationReady: boolean;
  isAuthenticated: boolean;
  requiresOwnUser: boolean;
}): ListTravelOwnUserGateMode | null => {
  if (!requiresOwnUser) return null;
  if (!hydrationReady || !authReady) return 'bootstrap';
  return isAuthenticated ? null : 'login';
};

const ListTravelOwnUserGate = ({
  isExport,
  mode,
  rootStyle,
}: {
  isExport: boolean;
  mode: ListTravelOwnUserGateMode;
  rootStyle: StyleProp<ViewStyle>;
}) => {
  const router = useRouter();

  if (mode === 'bootstrap') {
    return <View testID="list-travel-auth-bootstrap" style={rootStyle} />;
  }

  const redirect = isExport ? '/export' : '/metravel';
  const intent = isExport ? 'export' : 'metravel';
  return (
    <View style={rootStyle}>
      <EmptyState
        icon="map-pin"
        title={i18nT('travel:components.listTravel.ListTravelBase.voydite_v_akkaunt_d8ae79f2')}
        description={i18nT('travel:components.listTravel.ListTravelBase.voydite_chtoby_videt_svoi_puteshestviya_i_so_e65ec44d')}
        action={{
          label: i18nT('travel:components.listTravel.ListTravelBase.voyti_20211a9b'),
          onPress: () => router.push(buildLoginHref({ redirect, intent }) as Href),
        }}
      />
    </View>
  );
};

export default ListTravelOwnUserGate;
