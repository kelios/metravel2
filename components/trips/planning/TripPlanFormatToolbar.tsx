// components/trips/planning/TripPlanFormatToolbar.tsx
// #2072: панель кнопок оформления текста плана — «Заголовок», «Список»,
// «Нумерованный список», «Жирный», «Курсив». Только кнопки: что делать с
// текстом и выделением, решает `applyTripPlanFormat` у поля ввода.
import Feather from '@expo/vector-icons/Feather';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import IconButton from '@/components/ui/IconButton';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n/LocaleProvider';

import type { TripPlanFormatAction } from './tripPlanFormatActions';

const ICON_SIZE = 18;

interface TripPlanFormatToolbarProps {
  onAction: (action: TripPlanFormatAction) => void;
  disabled?: boolean;
  testIDPrefix: string;
}

const ACTIONS: readonly TripPlanFormatAction[] = ['heading', 'bullet', 'ordered', 'bold', 'italic'];

const FEATHER_ICON: Partial<Record<TripPlanFormatAction, React.ComponentProps<typeof Feather>['name']>> = {
  heading: 'type',
  bullet: 'list',
  bold: 'bold',
  italic: 'italic',
};

export default function TripPlanFormatToolbar({ onAction, disabled = false, testIDPrefix }: TripPlanFormatToolbarProps) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();

  return (
    <View
      style={styles.row}
      accessibilityRole="toolbar"
      accessibilityLabel={t('trips:components.trips.planning.TripPlanFormatToolbar.label')}
      testID={`${testIDPrefix}-format-toolbar`}
    >
      {ACTIONS.map((action) => {
        const iconName = FEATHER_ICON[action];
        return (
          <IconButton
            key={action}
            // В Feather нет значка нумерованного списка — «1.» тем же цветом и кеглем.
            icon={iconName
              ? <Feather name={iconName} size={ICON_SIZE} color={colors.primaryDark} />
              : <Text style={styles.orderedGlyph}>1.</Text>}
            label={t(`trips:components.trips.planning.TripPlanFormatToolbar.${action}`)}
            onPress={() => onAction(action)}
            disabled={disabled}
            size="sm"
            showTooltip
            testID={`${testIDPrefix}-format-${action}`}
          />
        );
      })}
    </View>
  );
}

const createStyles = (colors: ThemedColors) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
  },
  orderedGlyph: {
    fontSize: 15,
    lineHeight: ICON_SIZE,
    fontWeight: '700',
    color: colors.primaryDark,
  },
});
