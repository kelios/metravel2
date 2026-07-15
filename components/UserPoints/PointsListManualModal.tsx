import React from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import FormFieldWithValidation from '@/components/forms/FormFieldWithValidation';
import SimpleMultiSelect from '@/components/forms/SimpleMultiSelect';
import Button from '@/components/ui/Button';
import ColorChip from '@/components/ui/ColorChip';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { PointsListStyles } from './types';
import { translate as i18nT } from '@/i18n'


type CategoryOption = {
  id: string;
  name: string;
};

type PointsListManualModalProps = {
  styles: PointsListStyles;
  visible: boolean;
  editingPointId: number | null;
  onClose: () => void;
  manualName: string;
  onChangeName: (value: string) => void;
  manualError: string | null;
  manualCoords: string;
  manualLat: string;
  onChangeLat: (value: string) => void;
  manualLng: string;
  onChangeLng: (value: string) => void;
  categoryOptions: CategoryOption[];
  manualCategoryIds: string[];
  onChangeCategoryIds: (values: string[]) => void;
  manualColorOptions: string[];
  manualColor: string;
  onChangeColor: (value: string) => void;
  isSavingManual: boolean;
  onSave: () => void;
};

export const PointsListManualModal: React.FC<PointsListManualModalProps> = ({
  styles,
  visible,
  editingPointId,
  onClose,
  manualName,
  onChangeName,
  manualError,
  manualCoords,
  manualLat,
  onChangeLat,
  manualLng,
  onChangeLng,
  categoryOptions,
  manualCategoryIds,
  onChangeCategoryIds,
  manualColorOptions,
  manualColor,
  onChangeColor,
  isSavingManual,
  onSave,
}) => {
  const numericKeyboardType = Platform.OS === 'ios' || Platform.OS === 'android' ? 'numeric' : (undefined as any);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.manualOverlay}>
        <Pressable
          style={styles.manualBackdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={i18nT('map:components.UserPoints.PointsListManualModal.zakryt_formu_6de04b27')}
        />
        <View style={styles.manualModal}>
          <View style={styles.manualHeader}>
            <Text style={styles.manualTitle}>{editingPointId ? i18nT('map:components.UserPoints.PointsListManualModal.redaktirovat_tochku_db3835c8') : i18nT('map:components.UserPoints.PointsListManualModal.dobavit_tochku_vruchnuyu_4666a821')}</Text>
            <Button
              label={i18nT('map:components.UserPoints.PointsListManualModal.zakryt_1cff2e81')}
              onPress={onClose}
              accessibilityLabel={i18nT('map:components.UserPoints.PointsListManualModal.zakryt_1cff2e81')}
              size="sm"
              variant="secondary"
            />
          </View>

          <ScrollView style={styles.manualScroll} contentContainerStyle={styles.manualScrollContent}>
            <FormFieldWithValidation label={i18nT('map:components.UserPoints.PointsListManualModal.nazvanie_98d5f073')} required error={manualError && !manualName.trim() ? manualError : null}>
              <TextInput
                style={styles.manualInput}
                value={manualName}
                onChangeText={onChangeName}
                placeholder={i18nT('map:components.UserPoints.PointsListManualModal.naprimer_lyubimoe_kafe_e519b0f8')}
                placeholderTextColor={DESIGN_TOKENS.colors.textMuted}
              />
            </FormFieldWithValidation>

            <View style={styles.coordsRow}>
              <View style={styles.coordsCol}>
                <FormFieldWithValidation label={i18nT('map:components.UserPoints.PointsListManualModal.lat_8e1c785e')} required error={manualError && !manualCoords ? manualError : null}>
                  <TextInput
                    style={styles.manualInput}
                    value={manualLat}
                    onChangeText={onChangeLat}
                    placeholder="55.755800"
                    placeholderTextColor={DESIGN_TOKENS.colors.textMuted}
                    keyboardType={numericKeyboardType}
                  />
                </FormFieldWithValidation>
              </View>
              <View style={styles.coordsCol}>
                <FormFieldWithValidation label={i18nT('map:components.UserPoints.PointsListManualModal.lng_69d96b26')} required error={manualError && !manualCoords ? manualError : null}>
                  <TextInput
                    style={styles.manualInput}
                    value={manualLng}
                    onChangeText={onChangeLng}
                    placeholder="37.617300"
                    placeholderTextColor={DESIGN_TOKENS.colors.textMuted}
                    keyboardType={numericKeyboardType}
                  />
                </FormFieldWithValidation>
              </View>
            </View>

            <FormFieldWithValidation label={i18nT('map:components.UserPoints.PointsListManualModal.kategoriya_0941378c')} required>
              <SimpleMultiSelect
                data={categoryOptions.map((cat) => ({
                  value: cat.id,
                  label: cat.name,
                }))}
                value={manualCategoryIds}
                onChange={(vals) => onChangeCategoryIds(vals.filter((v): v is string => typeof v === 'string'))}
                labelField="label"
                valueField="value"
                search={false}
              />
            </FormFieldWithValidation>

            <FormFieldWithValidation label={i18nT('map:components.UserPoints.PointsListManualModal.tsvet_d73c5fa7')}>
              <View style={styles.manualColorRow}>
                {manualColorOptions.map((color) => {
                  const isSelected = manualColor === color;
                  return (
                    <ColorChip
                      key={color}
                      color={color}
                      selected={isSelected}
                      onPress={() => onChangeColor(color)}
                      accessibilityLabel={i18nT('map:components.UserPoints.PointsListManualModal.tsvet_value1_5d6679c3', { value1: color })}
                      chipSize={32}
                      dotSize={20}
                      dotBorderWidth={1}
                    />
                  );
                })}
              </View>
            </FormFieldWithValidation>

            {manualError && manualName.trim() && manualCoords ? (
              <Text style={styles.manualErrorText}>{manualError}</Text>
            ) : null}
          </ScrollView>

          <View style={styles.manualFooter}>
            <Button
              label={isSavingManual ? i18nT('map:components.UserPoints.PointsListManualModal.sohranenie_e92faf5d') : i18nT('map:components.UserPoints.PointsListManualModal.sohranit_22439821')}
              onPress={onSave}
              disabled={isSavingManual}
              loading={isSavingManual}
              accessibilityLabel={i18nT('map:components.UserPoints.PointsListManualModal.sohranit_tochku_4307406d')}
              fullWidth
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};
