// src/screens/tabs/UserPointsScreen.tsx
import { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Modal, ActivityIndicator } from 'react-native';
import { PointsList } from '@/components/UserPoints/PointsList';
import { ImportWizard } from '@/components/UserPoints/ImportWizard';
import { useAuth } from '@/context/AuthContext';
import { router } from 'expo-router';
import { useThemedColors } from '@/hooks/useTheme';
import { buildLoginHref } from '@/utils/authNavigation';

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

  if (!isAuthenticated) {
    return (
      <View style={styles.authContainer}>
        <Text style={styles.authTitle}>Требуется авторизация</Text>
        <Text style={styles.authText}>
          Для использования этой функции необходимо войти в систему
        </Text>
        <TouchableOpacity
          style={styles.authButton}
          onPress={() => router.push(buildLoginHref({ redirect: '/userpoints', intent: 'userpoints' }) as any)}
        >
          <Text style={styles.authButtonText}>Войти</Text>
        </TouchableOpacity>
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
  authTitle: {
    fontSize: 24,
    fontWeight: '700' as any,
    color: colors.text,
    marginBottom: 12,
  },
  authText: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 24,
  },
  authButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  authButtonText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '600' as any,
  },
});
