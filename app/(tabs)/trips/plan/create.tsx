// app/(tabs)/trips/plan/create.tsx
// Экран создания запланированной поездки (Sprint 13 / блок D): форма со всеми
// полями и согласием организатора; после создания — переход на страницу поездки.
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import TripCreateForm from '@/components/trips/planning/TripCreateForm';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

export default function CreateTripScreen() {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.inner}>
        <TripCreateForm
          onCreated={(trip) => router.replace(`/trips/plan/${trip.id}`)}
        />
      </View>
    </ScrollView>
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, alignItems: 'center' },
    inner: { width: '100%', maxWidth: 640 },
  });
