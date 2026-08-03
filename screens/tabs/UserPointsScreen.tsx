// src/screens/tabs/UserPointsScreen.tsx
import { useState } from 'react';
import { View, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { PointsList } from '@/components/UserPoints/PointsList';
import { ImportWizard } from '@/components/UserPoints/ImportWizard';
import { useAuth } from '@/context/AuthContext';
import { router } from 'expo-router';
import { useThemedColors } from '@/hooks/useTheme';
import { buildLoginHref } from '@/utils/authNavigation';
import EmptyState from '@/components/ui/EmptyState';
import { translate as i18nT } from '@/i18n'


export default function UserPointsScreen() {
  const [showImportWizard, setShowImportWizard] = useState(false);
  const { isAuthenticated, authReady } = useAuth();
  const colors = useThemedColors();

  const styles = createStyles(colors);

  if (!authReady) {
    return (
      <View style={styles.authContainer} testID="userpoints-auth-loading">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // EMPTY-01: Используем EmptyState для консистентного UX
  if (!isAuthenticated) {
    return (
      <View style={styles.authContainer}>
        <EmptyState
          icon="map-pin"
          title={i18nT('shared:screens.tabs.UserPointsScreen.voydite_chtoby_upravlyat_tochkami_c083ffa1')}
          description={i18nT('shared:screens.tabs.UserPointsScreen.dlya_sohraneniya_i_prosmotra_vashih_tochek_n_5b5b8307')}
          action={{
            label: i18nT('shared:screens.tabs.UserPointsScreen.voyti_784c8ba4'),
            onPress: () => router.push(buildLoginHref({ redirect: '/userpoints', intent: 'userpoints' }) as any),
          }}
          variant="empty"
        />
      </View>
    );
  }

  return (
    <View style={styles.container} testID="userpoints-screen">
      <PointsList onImportPress={() => setShowImportWizard(true)} />

      <Modal
        visible={showImportWizard}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <ImportWizard
          onComplete={() => setShowImportWizard(false)}
          onCancel={() => setShowImportWizard(false)}
        />
      </Modal>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: colors.background,
  },
});
