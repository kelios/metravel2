// components/trips/planning/RoutePointEditForm.tsx
// Форма правки точки маршрута. Вынесена из RouteBuilder.tsx (#1825) дословно —
// разметка, testID и подписи те же; состояние формы по-прежнему живёт в
// контейнере и приходит сюда пропсами, как у соседней RoutePointAddForm.
import React from 'react';
import Feather from '@expo/vector-icons/Feather';
import { Pressable, Text, TextInput, View } from 'react-native';

import type { RoutePointType } from '@/api/plannedTrips';
import AddressSearch from '@/components/MapPage/AddressSearch';
import {
  ROUTE_POINT_ICON_NAME,
  ROUTE_POINT_LABEL,
} from '@/components/trips/planning/tripPlanFormatting';
import Button from '@/components/ui/Button';
import type { ThemedColors } from '@/hooks/useTheme';
import { translate as i18nT } from '@/i18n';
import { isOvernightPoint } from '@/utils/overnightBooking';
import RouteOvernightFields from './RouteOvernightFields';
import RouteDayField from './RouteDayField';
import type { createStyles } from './RouteBuilder.styles';
import type { OvernightBookingDraft, OvernightBookingField } from './routeOvernightBooking';

type RouteBuilderStyles = ReturnType<typeof createStyles>;

interface Props {
  styles: RouteBuilderStyles;
  colors: ThemedColors;
  /** Мобильная раскладка `mapFirst`: форма живёт внутри карточки своей точки. */
  isMapFirst: boolean;
  /** Индекс правимой точки. Секция рендерится только когда он не null. */
  editingIndex: number;
  /** Длина маршрута — для «опустить точку ниже» на последней строке. */
  routeLength: number;
  typeOptions: RoutePointType[];
  type: RoutePointType;
  name: string;
  lat: string;
  lng: string;
  description: string;
  /** #1843: черновик брони. Показывается только у точки «ночёвка». */
  booking: OvernightBookingDraft;
  /** #1845: день похода строкой; пусто — точка без дня. */
  dayNumber: string;
  /** Чипы уже занятых дней маршрута и следующего свободного. */
  dayChips: number[];
  error: string | null;
  onTypeChange: (type: RoutePointType) => void;
  onBookingChange: (field: OvernightBookingField, value: string) => void;
  onDayNumberChange: (value: string) => void;
  onAddressSelect: (address: string, coords: { lat: number; lng: number }) => void;
  onNameChange: (value: string) => void;
  onLatChange: (value: string) => void;
  onLngChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onMove: (index: number, delta: number) => void;
  onDelete: (index: number) => void;
}

export default function RoutePointEditForm({
  styles,
  colors,
  isMapFirst,
  editingIndex,
  routeLength,
  typeOptions,
  type: editType,
  name: editName,
  lat: editLat,
  lng: editLng,
  description: editDescription,
  booking: editBooking,
  dayNumber: editDayNumber,
  dayChips,
  error: editError,
  onTypeChange,
  onBookingChange,
  onDayNumberChange,
  onAddressSelect,
  onNameChange,
  onLatChange,
  onLngChange,
  onDescriptionChange,
  onSave,
  onCancel,
  onMove,
  onDelete,
}: Props) {
  return (
    <View
      style={[styles.editForm, isMapFirst && styles.editFormInline]}
      testID="route-builder-edit-form"
    >
      {/* В мобильной раскладке форма уже подписана номером и названием своей
          точки в карточке над ней — второй заголовок был бы шумом. */}
      {isMapFirst ? null : (
        <Text style={styles.label}>{i18nT('trips:components.trips.planning.RouteBuilder.redaktirovat_tochku_8815b389')}</Text>
      )}
      <View style={styles.chipRow}>
        {typeOptions.map((type) => {
          const active = type === editType;
          return (
            <Pressable
              key={type}
              accessibilityRole="button"
              onPress={() => onTypeChange(type)}
              style={[styles.typeChip, active && styles.typeChipActive]}
              testID={`route-builder-edit-type-${type}`}
            >
              <Feather
                name={ROUTE_POINT_ICON_NAME[type] as never}
                size={13}
                color={active ? colors.textOnPrimary : colors.textSecondary}
              />
              <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>
                {ROUTE_POINT_LABEL[type]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {/* #1782: поиск места по названию. Координаты приходят из результата,
          поля широты и долготы ниже остаются доступны для ручного ввода. */}
      <AddressSearch
        // Переход к правке соседней точки обязан сбрасывать строку поиска:
        // в десктопной раскладке форма живёт на одном месте и без ключа
        // сохранила бы запрос от предыдущей точки.
        key={`edit-address-${editingIndex}`}
        onAddressSelect={onAddressSelect}
        placeholder={i18nT('trips:components.trips.planning.RouteBuilder.nayti_mesto_po_nazvaniyu_ili_adresu_fa7745e0')}
        enableCoordinateInput
        dense
      />
      <TextInput
        value={editName}
        onChangeText={onNameChange}
        placeholder={i18nT('trips:components.trips.planning.RouteBuilder.nazvanie_tochki_0cdacb0f')}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        testID="route-builder-edit-name"
      />
      <View style={styles.coordRow}>
        <TextInput
          value={editLat}
          onChangeText={onLatChange}
          placeholder={i18nT('trips:components.trips.planning.RouteBuilder.shirota_lat_6d696d4a')}
          placeholderTextColor={colors.textMuted}
          keyboardType="numbers-and-punctuation"
          style={[styles.input, styles.coordInput]}
          testID="route-builder-edit-lat"
        />
        <TextInput
          value={editLng}
          onChangeText={onLngChange}
          placeholder={i18nT('trips:components.trips.planning.RouteBuilder.dolgota_lng_f08c3647')}
          placeholderTextColor={colors.textMuted}
          keyboardType="numbers-and-punctuation"
          style={[styles.input, styles.coordInput]}
          testID="route-builder-edit-lng"
        />
      </View>
      <TextInput
        value={editDescription}
        onChangeText={onDescriptionChange}
        placeholder={i18nT('trips:components.trips.planning.RouteBuilder.opisanie_ili_ssylka_po_zhelaniyu_2a1ab272')}
        placeholderTextColor={colors.textMuted}
        multiline
        numberOfLines={3}
        style={[styles.input, styles.textArea]}
        testID="route-builder-edit-description"
      />
      {/* #1843: адрес жилья, ссылка на бронь, цена и время заезда — поля
          единственного типа точки. Раньше всё это уходило в описание одной
          строкой, и отдельно кликнуть по ссылке брони было нечем. */}
      <RouteDayField
        styles={styles}
        colors={colors}
        value={editDayNumber}
        chipDays={dayChips}
        onChange={onDayNumberChange}
      />
      {isOvernightPoint(editType) ? (
        <RouteOvernightFields
          styles={styles}
          colors={colors}
          draft={editBooking}
          onChange={onBookingChange}
        />
      ) : null}
      {editError ? <Text style={styles.errorText}>{editError}</Text> : null}
      <View style={styles.editActions}>
        <Button
          label={i18nT('trips:components.trips.planning.RouteBuilder.sohranit_tochku_467b8cde')}
          onPress={onSave}
          variant="secondary"
          disabled={!editName.trim()}
          testID="route-builder-edit-save"
        />
        <Button
          label={i18nT('trips:components.trips.planning.RouteBuilder.otmena_cb0c29f2')}
          onPress={onCancel}
          variant="ghost"
          testID="route-builder-edit-cancel"
        />
      </View>
      {/* Перестановка живёт здесь в обеих раскладках: в строке точки рядом с
          названием помещаются только правка и удаление, а на 380px панели даже
          четыре иконки по 44dp оставляли тексту ~90px. Клавиатурный и a11y путь
          того же reorder остался на ручке перетаскивания. */}
      <View style={styles.editActions}>
        <Button
          label={i18nT('trips:components.trips.planning.RouteBuilder.podnyat_tochku_vyshe_23208202')}
          onPress={() => onMove(editingIndex, -1)}
          variant="ghost"
          size="sm"
          disabled={editingIndex === 0}
          icon={<Feather name="chevron-up" size={16} color={colors.text} />}
          testID={`route-builder-move-up-${editingIndex}`}
        />
        <Button
          label={i18nT('trips:components.trips.planning.RouteBuilder.opustit_tochku_nizhe_c1c13a3e')}
          onPress={() => onMove(editingIndex, 1)}
          variant="ghost"
          size="sm"
          disabled={editingIndex === routeLength - 1}
          icon={<Feather name="chevron-down" size={16} color={colors.text} />}
          testID={`route-builder-move-down-${editingIndex}`}
        />
      </View>
      {/* Удаление в мобильной раскладке есть только здесь: в строке точки его
          заменил чеврон сворачивания редактора. В `stack` кнопка удаления
          осталась в самой строке — второй такой же в форме быть не должно. */}
      {isMapFirst ? (
        <View style={styles.editDangerRow}>
          <Button
            label={i18nT('trips:components.trips.planning.RouteBuilder.udalit_tochku_37161453')}
            onPress={() => onDelete(editingIndex)}
            variant="ghost"
            size="sm"
            icon={<Feather name="trash-2" size={16} color={colors.danger} />}
            testID={`route-builder-delete-${editingIndex}`}
          />
        </View>
      ) : null}
    </View>
  );
}
