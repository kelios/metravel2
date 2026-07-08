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
          title="Войдите, чтобы управлять точками"
          description="Для сохранения и просмотра ваших точек на карте необходимо войти в аккаунт."
          action={{
            label: 'Войти',
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
