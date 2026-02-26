import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import FormFieldWithValidation from '@/components/forms/FormFieldWithValidation';
import SimpleMultiSelect from '@/components/forms/SimpleMultiSelect';
import Button from '@/components/ui/Button';
import { PointStatus, STATUS_LABELS } from '@/types/userPoints';
import { PointsListStyles } from './PointsList';

type PointsListBulkModalsProps = {
  styles: PointsListStyles;
  pointToDelete: { name?: string } | null;
  onClosePointDelete: () => void;
  onConfirmPointDelete: () => void;
  showBulkEdit: boolean;
  onCloseBulkEdit: () => void;
  bulkStatus: PointStatus | null;
  onBulkStatusChange: (status: PointStatus | null) => void;
  onApplyBulkEdit: () => void;
  showConfirmDeleteSelected: boolean;
  onCloseConfirmDeleteSelected: () => void;
  selectedCount: number;
  onDeleteSelected: () => void;
  showConfirmDeleteAll: boolean;
  onCloseConfirmDeleteAll: () => void;
  onDeleteAll: () => void;
  isBulkWorking: boolean;
};

export const PointsListBulkModals: React.FC<PointsListBulkModalsProps> = ({
  styles,
  pointToDelete,
  onClosePointDelete,
  onConfirmPointDelete,
  showBulkEdit,
  onCloseBulkEdit,
  bulkStatus,
  onBulkStatusChange,
  onApplyBulkEdit,
  showConfirmDeleteSelected,
  onCloseConfirmDeleteSelected,
  selectedCount,
  onDeleteSelected,
  showConfirmDeleteAll,
  onCloseConfirmDeleteAll,
  onDeleteAll,
  isBulkWorking,
}) => {
  return (
    <>
      <Modal
        visible={Boolean(pointToDelete)}
        transparent
        animationType="fade"
        onRequestClose={onClosePointDelete}
      >
        <View style={styles.actionsOverlay}>
          <Pressable
            style={styles.actionsBackdrop}
            onPress={onClosePointDelete}
            accessibilityRole="button"
            accessibilityLabel="Закрыть"
          />

          <View style={styles.actionsModal}>
            <Text style={styles.actionsTitle}>Удалить точку?</Text>
            <Text style={styles.emptySubtext}>{String(pointToDelete?.name ?? '')}</Text>

            <Button
              label="Удалить"
              onPress={onConfirmPointDelete}
              disabled={isBulkWorking}
              loading={isBulkWorking}
              accessibilityLabel="Удалить"
              fullWidth
              variant="danger"
            />

            <Button
              label="Отмена"
              onPress={onClosePointDelete}
              accessibilityLabel="Отмена"
              fullWidth
              variant="ghost"
              style={styles.modalSpacing}
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={showBulkEdit}
        transparent
        animationType="fade"
        onRequestClose={onCloseBulkEdit}
      >
        <View style={styles.actionsOverlay}>
          <Pressable
            style={styles.actionsBackdrop}
            onPress={onCloseBulkEdit}
            accessibilityRole="button"
            accessibilityLabel="Закрыть"
          />

          <View style={styles.actionsModal}>
            <Text style={styles.actionsTitle}>Изменить выбранные</Text>

            <FormFieldWithValidation label="Статус">
              <SimpleMultiSelect
                data={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
                value={bulkStatus ? [bulkStatus] : []}
                onChange={(vals) => {
                  const next = (vals[vals.length - 1] as PointStatus | undefined) ?? undefined;
                  onBulkStatusChange(next ?? null);
                }}
                labelField="label"
                valueField="value"
                search={false}
              />
            </FormFieldWithValidation>

            <Button
              label="Применить"
              onPress={onApplyBulkEdit}
              disabled={isBulkWorking || selectedCount === 0}
              loading={isBulkWorking}
              accessibilityLabel="Применить"
              fullWidth
            />

            <Button
              label="Отмена"
              onPress={onCloseBulkEdit}
              accessibilityLabel="Отмена"
              fullWidth
              variant="ghost"
              style={styles.modalSpacing}
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={showConfirmDeleteSelected}
        transparent
        animationType="fade"
        onRequestClose={onCloseConfirmDeleteSelected}
      >
        <View style={styles.actionsOverlay}>
          <Pressable
            style={styles.actionsBackdrop}
            onPress={onCloseConfirmDeleteSelected}
            accessibilityRole="button"
            accessibilityLabel="Закрыть"
          />
          <View style={styles.actionsModal}>
            <Text style={styles.actionsTitle}>Удалить выбранные?</Text>
            <Text style={styles.emptySubtext}>Будут удалены: {selectedCount}</Text>

            <Button
              label="Удалить"
              onPress={onDeleteSelected}
              disabled={isBulkWorking}
              loading={isBulkWorking}
              accessibilityLabel="Удалить"
              fullWidth
              variant="danger"
            />

            <Button
              label="Отмена"
              onPress={onCloseConfirmDeleteSelected}
              accessibilityLabel="Отмена"
              fullWidth
              variant="ghost"
              style={styles.modalSpacing}
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={showConfirmDeleteAll}
        transparent
        animationType="fade"
        onRequestClose={onCloseConfirmDeleteAll}
      >
        <View style={styles.actionsOverlay}>
          <Pressable
            style={styles.actionsBackdrop}
            onPress={onCloseConfirmDeleteAll}
            accessibilityRole="button"
            accessibilityLabel="Закрыть"
          />
          <View style={styles.actionsModal}>
            <Text style={styles.actionsTitle}>Удалить все точки?</Text>
            <Text style={styles.emptySubtext}>Это действие нельзя отменить</Text>

            <Button
              label="Удалить все"
              onPress={onDeleteAll}
              disabled={isBulkWorking}
              loading={isBulkWorking}
              accessibilityLabel="Удалить все"
              fullWidth
              variant="danger"
            />

            <Button
              label="Отмена"
              onPress={onCloseConfirmDeleteAll}
              accessibilityLabel="Отмена"
              fullWidth
              variant="ghost"
              style={styles.modalSpacing}
            />
          </View>
        </View>
      </Modal>
    </>
  );
};
