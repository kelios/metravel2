// components/trips/planning/TripPlanningEmptyState.tsx
// Cold-start онбординг планирования поездок (Sprint 13 / блок D): ценность фичи +
// CTA создать поездку и пример маршрута из шаблонов сообщества.
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import Button from '@/components/ui/Button';
import { useRouteTemplates } from '@/hooks/usePlannedTripsApi';
import { ROUTE_POINT_ICON_NAME } from '@/components/trips/planning/tripPlanFormatting';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

interface Props {
  onCreate: () => void;
}

const VALUE_POINTS = [
  'Соберите маршрут из мест MeTravel — добавляйте точки в один тап.',
  'Пригласите подписчиков и собирайте, кто едет.',
  'Экспортируйте маршрут в навигатор и опубликуйте отчёт после поездки.',
];

function TripPlanningEmptyState({ onCreate }: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data: templates } = useRouteTemplates();
  const example = templates?.[0] ?? null;

  return (
    <View style={styles.wrap} testID="trips-empty-state">
      <Text style={styles.heading}>Спланируйте свою поездку</Text>
      <Text style={styles.subheading}>
        Превратите идею в готовый маршрут и поделитесь им с попутчиками.
      </Text>

      <View style={styles.points}>
        {VALUE_POINTS.map((point) => (
          <View key={point} style={styles.pointRow}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.pointText}>{point}</Text>
          </View>
        ))}
      </View>

      <Button
        label="Запланировать поездку"
        onPress={onCreate}
        fullWidth
        testID="trips-empty-cta"
      />

      {example ? (
        <View style={styles.exampleCard}>
          <Text style={styles.exampleLabel}>Пример маршрута</Text>
          <Text style={styles.exampleTitle}>{example.title}</Text>
          {example.description ? (
            <Text style={styles.exampleDescription}>{example.description}</Text>
          ) : null}
          <View style={styles.chips}>
            {example.points.map((point, index) => (
              <View key={`${point.name}-${index}`} style={styles.chip}>
                <Feather
                  name={ROUTE_POINT_ICON_NAME[point.type] as never}
                  size={13}
                  color={colors.textSecondary}
                />
                <Text style={styles.chipText}>{point.name}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    wrap: { gap: 12 },
    heading: { fontSize: 20, fontWeight: '700', color: colors.text },
    subheading: { fontSize: 15, color: colors.textSecondary, lineHeight: 21 },
    points: { gap: 8, marginVertical: 4 },
    pointRow: { flexDirection: 'row', gap: 8 },
    bullet: { fontSize: 15, color: colors.primaryText, lineHeight: 20 },
    pointText: { flex: 1, fontSize: 14, color: colors.text, lineHeight: 20 },
    exampleCard: {
      marginTop: 4,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      backgroundColor: colors.surfaceElevated,
      padding: 14,
      gap: 8,
    },
    exampleLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    exampleTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
    exampleDescription: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
    chip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    chipText: { fontSize: 13, color: colors.textSecondary },
  });

export default React.memo(TripPlanningEmptyState);
