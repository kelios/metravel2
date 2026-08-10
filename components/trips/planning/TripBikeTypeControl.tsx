// components/trips/planning/TripBikeTypeControl.tsx
// #1308: выбор типа велосипеда во вторичном ряду конструктора маршрута.
// Виден только когда транспорт — велосипед и бэк действительно отдаёт bike_type;
// смена уходит тем же PATCH, что и смена транспорта, отдельного rebuild нет.
import React from 'react';
import { Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { TRIP_BIKE_TYPES, type TripBikeType } from '@/api/plannedTrips';
import Chip from '@/components/ui/Chip';
import { BIKE_TYPE_LABEL } from '@/components/trips/planning/tripPlanFormatting';
import { useTranslation } from '@/i18n/LocaleProvider';

interface Props {
  value: TripBikeType;
  disabled: boolean;
  onChange: (bikeType: TripBikeType) => void;
  styles: {
    bikeTypeControl: StyleProp<ViewStyle>;
    bikeTypeChips: StyleProp<ViewStyle>;
    label: StyleProp<TextStyle>;
  };
}

function TripBikeTypeControl({ value, disabled, onChange, styles }: Props) {
  const { t } = useTranslation();

  return (
    <View style={styles.bikeTypeControl} testID="route-builder-bike-type-control">
      <Text style={styles.label}>{t('tripsStatic:plan.bikeType.label')}</Text>
      {/* Роль radiogroup здесь была бы ложной: Chip рендерится как button с
          aria-pressed, поэтому группа остаётся набором подписанных toggle-кнопок. */}
      <View style={styles.bikeTypeChips}>
        {TRIP_BIKE_TYPES.map((bikeType) => (
          <Chip
            key={bikeType}
            label={BIKE_TYPE_LABEL[bikeType]}
            selected={bikeType === value}
            disabled={disabled}
            onPress={() => onChange(bikeType)}
            testID={`route-builder-bike-type-${bikeType}`}
          />
        ))}
      </View>
    </View>
  );
}

export default React.memo(TripBikeTypeControl);
