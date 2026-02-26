import React from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import FormFieldWithValidation from '@/components/forms/FormFieldWithValidation';
import SimpleMultiSelect from '@/components/forms/SimpleMultiSelect';
import Button from '@/components/ui/Button';
import ColorChip from '@/components/ui/ColorChip';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { PointsListStyles } from './PointsList';

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
          accessibilityLabel="Закрыть форму"
        />
        <View style={styles.manualModal}>
          <View style={styles.manualHeader}>
            <Text style={styles.manualTitle}>{editingPointId ? 'Редактировать точку' : 'Добавить точку вручную'}</Text>
            <Button
              label="Закрыть"
              onPress={onClose}
              accessibilityLabel="Закрыть"
              size="sm"
              variant="secondary"
            />
          </View>

          <ScrollView style={styles.manualScroll} contentContainerStyle={styles.manualScrollContent}>
            <FormFieldWithValidation label="Название" required error={manualError && !manualName.trim() ? manualError : null}>
              <TextInput
                style={styles.manualInput}
                value={manualName}
                onChangeText={onChangeName}
                placeholder="Например: Любимое кафе"
                placeholderTextColor={DESIGN_TOKENS.colors.textMuted}
              />
            </FormFieldWithValidation>

            <View style={styles.coordsRow}>
              <View style={styles.coordsCol}>
                <FormFieldWithValidation label="Lat" required error={manualError && !manualCoords ? manualError : null}>
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
                <FormFieldWithValidation label="Lng" required error={manualError && !manualCoords ? manualError : null}>
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

            <FormFieldWithValidation label="Категория" required>
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

            <FormFieldWithValidation label="Цвет">
              <View style={styles.manualColorRow}>
                {manualColorOptions.map((color) => {
                  const isSelected = manualColor === color;
                  return (
                    <ColorChip
                      key={color}
                      color={color}
                      selected={isSelected}
                      onPress={() => onChangeColor(color)}
                      accessibilityLabel={`Цвет ${color}`}
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
              label={isSavingManual ? 'Сохранение…' : 'Сохранить'}
              onPress={onSave}
              disabled={isSavingManual}
              loading={isSavingManual}
              accessibilityLabel="Сохранить точку"
              fullWidth
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};
