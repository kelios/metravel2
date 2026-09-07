// components/trips/planning/RouteOvernightFields.tsx
// #1843: поля брони ночёвки в форме правки точки. Отдельный компонент, а не
// четыре поля внутри `RoutePointEditForm`: блок появляется и исчезает целиком по
// типу точки, и держать его переключение вперемешку с общими полями значило бы
// проверять `type === 'overnight'` в пяти местах формы.
import React from 'react';
import { Text, TextInput, View } from 'react-native';

import type { ThemedColors } from '@/hooks/useTheme';
import { translate as i18nT } from '@/i18n';
import type { createStyles } from './RouteBuilder.styles';
import type { OvernightBookingDraft, OvernightBookingField } from './routeOvernightBooking';

type RouteBuilderStyles = ReturnType<typeof createStyles>;

interface Props {
  styles: RouteBuilderStyles;
  colors: ThemedColors;
  draft: OvernightBookingDraft;
  /** Одна точка записи вместо четырёх сеттеров в контейнере. */
  onChange: (field: OvernightBookingField, value: string) => void;
}

export default function RouteOvernightFields({ styles, colors, draft, onChange }: Props) {
  return (
    <View style={styles.overnightSection} testID="route-builder-overnight-fields">
      <Text style={styles.overnightLegend}>
        {i18nT('tripsStatic:plan.overnight.section')}
      </Text>
      <TextInput
        value={draft.address}
        onChangeText={(value) => onChange('address', value)}
        placeholder={i18nT('tripsStatic:plan.overnight.address')}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        testID="route-builder-overnight-address"
      />
      <TextInput
        value={draft.url}
        onChangeText={(value) => onChange('url', value)}
        placeholder={i18nT('tripsStatic:plan.overnight.url')}
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        style={styles.input}
        testID="route-builder-overnight-url"
      />
      <View style={styles.overnightPairRow}>
        <TextInput
          value={draft.price}
          onChangeText={(value) => onChange('price', value)}
          placeholder={i18nT('tripsStatic:plan.overnight.price')}
          placeholderTextColor={colors.textMuted}
          // Запятая и точка нужны обе: десятичный разделитель в продуктовых
          // локалях запятая, а вставленная из письма цена приходит с точкой.
          keyboardType="numbers-and-punctuation"
          style={[styles.input, styles.overnightPairInput]}
          testID="route-builder-overnight-price"
        />
        <TextInput
          value={draft.checkinTime}
          onChangeText={(value) => onChange('checkinTime', value)}
          placeholder={i18nT('tripsStatic:plan.overnight.checkin')}
          placeholderTextColor={colors.textMuted}
          keyboardType="numbers-and-punctuation"
          style={[styles.input, styles.overnightPairInput]}
          testID="route-builder-overnight-checkin"
        />
      </View>
    </View>
  );
}
