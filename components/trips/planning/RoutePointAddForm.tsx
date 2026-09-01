import React, { useMemo } from 'react';
import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { RoutePointType } from '@/api/plannedTrips';
import {
  ROUTE_POINT_ICON_NAME,
  ROUTE_POINT_LABEL,
} from '@/components/trips/planning/tripPlanFormatting';
import Button from '@/components/ui/Button';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import type { ThemedColors } from '@/hooks/useTheme';
import { translate as i18nT } from '@/i18n';
import type { createStyles } from './RouteBuilder.styles';

type RouteBuilderStyles = ReturnType<typeof createStyles>;

export type SiteSearchStatus = 'idle' | 'loading' | 'ready' | 'error';

export type SiteRouteOption = {
  key: string;
  kind: 'place' | 'travel';
  id: number | null;
  title: string;
  subtitle: string;
  description: string | null;
  coordinates: [number, number] | null;
  imageUrl: string | null;
};

interface Props {
  styles: RouteBuilderStyles;
  /**
   * Поиск по адресу и ввод координат. Раньше он рисовался отдельно, в секции
   * «Точки маршрута», и открытие «Добавить точку» разносило один сценарий по
   * двум местам панели: сверху адресный поиск, внизу форма.
   */
  addressSlot?: React.ReactNode;
  colors: ThemedColors;
  pointTypes: readonly RoutePointType[];
  type: RoutePointType;
  name: string;
  lat: string;
  lng: string;
  description: string;
  error: string | null;
  siteQuery: string;
  siteOptions: SiteRouteOption[];
  siteSearchStatus: SiteSearchStatus;
  onTypeChange: (type: RoutePointType) => void;
  onNameChange: (value: string) => void;
  onLatChange: (value: string) => void;
  onLngChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onSiteQueryChange: (value: string) => void;
  onAddSitePoint: (option: SiteRouteOption) => void;
  onAdd: () => void;
  onCancel: () => void;
}

export default function RoutePointAddForm({
  styles,
  addressSlot,
  colors,
  pointTypes,
  type,
  name,
  lat,
  lng,
  description,
  error,
  siteQuery,
  siteOptions,
  siteSearchStatus,
  onTypeChange,
  onNameChange,
  onLatChange,
  onLngChange,
  onDescriptionChange,
  onSiteQueryChange,
  onAddSitePoint,
  onAdd,
  onCancel,
}: Props) {
  const localStyles = useMemo(() => createAddStyles(colors), [colors]);

  return (
    <View style={localStyles.addForm} testID="route-builder-add-form">
      <Text style={styles.label}>{i18nT('trips:components.trips.planning.RouteBuilder.dobavit_tochku_60ab5746')}</Text>
      {addressSlot}
      <View style={styles.chipRow}>
        {pointTypes.map((pointType) => {
          const active = pointType === type;
          return (
            <Pressable
              key={pointType}
              accessibilityRole="button"
              onPress={() => onTypeChange(pointType)}
              style={[styles.typeChip, active && styles.typeChipActive]}
              testID={`route-builder-type-${pointType}`}
            >
              <Feather
                name={ROUTE_POINT_ICON_NAME[pointType] as never}
                size={13}
                color={active ? colors.textOnPrimary : colors.textSecondary}
              />
              <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>
                {ROUTE_POINT_LABEL[pointType]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {type === 'place' ? (
        <View style={localStyles.siteSearch}>
          <TextInput
            value={siteQuery}
            onChangeText={onSiteQueryChange}
            placeholder={i18nT('trips:components.trips.planning.RouteBuilder.nayti_mesto_ili_puteshestvie_na_metravel_8780d31c')}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            testID="route-builder-site-search"
          />
          {siteSearchStatus === 'loading' ? (
            <Text style={styles.hint}>{i18nT('trips:components.trips.planning.RouteBuilder.ischem_sovpadeniya_b077a7ac')}</Text>
          ) : null}
          {siteSearchStatus === 'error' ? (
            <Text style={styles.errorText}>{i18nT('trips:components.trips.planning.RouteBuilder.ne_udalos_zagruzit_varianty_a38206ee')}</Text>
          ) : null}
          {siteSearchStatus === 'ready' && siteOptions.length === 0 ? (
            <Text style={styles.hint}>{i18nT('trips:components.trips.planning.RouteBuilder.nichego_ne_naydeno_b39815ed')}</Text>
          ) : null}
          {siteOptions.length > 0 ? (
            <View style={localStyles.siteResults}>
              {siteOptions.map((option) => (
                <Pressable
                  key={option.key}
                  accessibilityRole="button"
                  onPress={() => onAddSitePoint(option)}
                  style={localStyles.siteOption}
                  testID={`route-builder-site-option-${option.key}`}
                >
                  <View style={localStyles.siteOptionImage}>
                    <ImageCardMedia
                      src={option.imageUrl}
                      alt={option.title}
                      height={54}
                      fit="contain"
                      borderRadius={8}
                      showLoadingIndicator={false}
                    />
                  </View>
                  <View style={localStyles.siteOptionBody}>
                    <Text style={localStyles.siteOptionKind}>
                      {option.kind === 'travel' ? i18nT('trips:components.trips.planning.RouteBuilder.puteshestvie_7cbf3a43') : i18nT('trips:components.trips.planning.RouteBuilder.mesto_3991f739')}
                    </Text>
                    <Text style={localStyles.siteOptionTitle} numberOfLines={1}>
                      {option.title}
                    </Text>
                    {option.subtitle ? (
                      <Text style={localStyles.siteOptionSubtitle} numberOfLines={1}>
                        {option.subtitle}
                      </Text>
                    ) : null}
                  </View>
                  <Feather name="plus" size={18} color={colors.primaryDark} />
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      ) : (
        <>
          <TextInput
            value={name}
            onChangeText={onNameChange}
            placeholder={i18nT('trips:components.trips.planning.RouteBuilder.nazvanie_tochki_0cdacb0f')}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            testID="route-builder-name"
          />
          <View style={styles.coordRow}>
            <TextInput
              value={lat}
              onChangeText={onLatChange}
              placeholder={i18nT('trips:components.trips.planning.RouteBuilder.shirota_lat_6d696d4a')}
              placeholderTextColor={colors.textMuted}
              keyboardType="numbers-and-punctuation"
              style={[styles.input, styles.coordInput]}
              testID="route-builder-lat"
            />
            <TextInput
              value={lng}
              onChangeText={onLngChange}
              placeholder={i18nT('trips:components.trips.planning.RouteBuilder.dolgota_lng_f08c3647')}
              placeholderTextColor={colors.textMuted}
              keyboardType="numbers-and-punctuation"
              style={[styles.input, styles.coordInput]}
              testID="route-builder-lng"
            />
          </View>
          <TextInput
            value={description}
            onChangeText={onDescriptionChange}
            placeholder={i18nT('trips:components.trips.planning.RouteBuilder.opisanie_po_zhelaniyu_3bb69cb4')}
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={3}
            style={[styles.input, styles.textArea]}
            testID="route-builder-description"
          />
        </>
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <View style={styles.editActions}>
        {type !== 'place' ? (
          <Button
            label={i18nT('trips:components.trips.planning.RouteBuilder.dobavit_tochku_60ab5746')}
            onPress={onAdd}
            variant="secondary"
            disabled={!name.trim()}
            testID="route-builder-add"
          />
        ) : null}
        <Button
          label={i18nT('trips:components.trips.planning.RouteBuilder.otmena_cb0c29f2')}
          onPress={onCancel}
          variant="ghost"
          testID="route-builder-add-cancel"
        />
      </View>
    </View>
  );
}

const createAddStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    addForm: {
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      backgroundColor: colors.surfaceMuted,
    },
    siteSearch: { gap: 8 },
    siteResults: { gap: 6 },
    siteOption: {
      minHeight: 68,
      paddingVertical: 7,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    siteOptionImage: {
      width: 72,
      height: 54,
      borderRadius: 8,
      overflow: 'hidden',
      backgroundColor: colors.surface,
      flexShrink: 0,
    },
    siteOptionBody: { flex: 1, minWidth: 0, gap: 1 },
    siteOptionKind: { fontSize: 11, color: colors.textMuted, fontWeight: '700' },
    siteOptionTitle: { fontSize: 14, color: colors.text, fontWeight: '700' },
    siteOptionSubtitle: { fontSize: 12, color: colors.textSecondary },
  });
