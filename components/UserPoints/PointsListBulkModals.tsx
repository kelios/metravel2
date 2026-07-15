import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import FormFieldWithValidation from '@/components/forms/FormFieldWithValidation';
import SimpleMultiSelect from '@/components/forms/SimpleMultiSelect';
import Button from '@/components/ui/Button';
import { PointStatus, STATUS_LABELS } from '@/types/userPoints';
import { PointsListStyles } from './types';
import { translate as i18nT } from '@/i18n'


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
            accessibilityLabel={i18nT('map:components.UserPoints.PointsListBulkModals.zakryt_1fe45ea3')}
          />

          <View style={styles.actionsModal}>
            <Text style={styles.actionsTitle}>{i18nT('map:components.UserPoints.PointsListBulkModals.udalit_tochku_c48d576a')}</Text>
            <Text style={styles.emptySubtext}>{String(pointToDelete?.name ?? '')}</Text>

            <Button
              label={i18nT('map:components.UserPoints.PointsListBulkModals.udalit_0873ed30')}
              onPress={onConfirmPointDelete}
              disabled={isBulkWorking}
              loading={isBulkWorking}
              accessibilityLabel={i18nT('map:components.UserPoints.PointsListBulkModals.udalit_0873ed30')}
              fullWidth
              variant="danger"
            />

            <Button
              label={i18nT('map:components.UserPoints.PointsListBulkModals.otmena_95ebfb0e')}
              onPress={onClosePointDelete}
              accessibilityLabel={i18nT('map:components.UserPoints.PointsListBulkModals.otmena_95ebfb0e')}
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
            accessibilityLabel={i18nT('map:components.UserPoints.PointsListBulkModals.zakryt_1fe45ea3')}
          />

          <View style={styles.actionsModal}>
            <Text style={styles.actionsTitle}>{i18nT('map:components.UserPoints.PointsListBulkModals.izmenit_vybrannye_ad179ef8')}</Text>

            <FormFieldWithValidation label={i18nT('map:components.UserPoints.PointsListBulkModals.status_735b7b60')}>
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
              label={i18nT('map:components.UserPoints.PointsListBulkModals.primenit_51a90795')}
              onPress={onApplyBulkEdit}
              disabled={isBulkWorking || selectedCount === 0}
              loading={isBulkWorking}
              accessibilityLabel={i18nT('map:components.UserPoints.PointsListBulkModals.primenit_51a90795')}
              fullWidth
            />

            <Button
              label={i18nT('map:components.UserPoints.PointsListBulkModals.otmena_95ebfb0e')}
              onPress={onCloseBulkEdit}
              accessibilityLabel={i18nT('map:components.UserPoints.PointsListBulkModals.otmena_95ebfb0e')}
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
            accessibilityLabel={i18nT('map:components.UserPoints.PointsListBulkModals.zakryt_1fe45ea3')}
          />
          <View style={styles.actionsModal}>
            <Text style={styles.actionsTitle}>{i18nT('map:components.UserPoints.PointsListBulkModals.udalit_vybrannye_e97d9bbe')}</Text>
            <Text style={styles.emptySubtext}>{i18nT('map:components.UserPoints.PointsListBulkModals.budut_udaleny_625a665a')}{selectedCount}</Text>

            <Button
              label={i18nT('map:components.UserPoints.PointsListBulkModals.udalit_0873ed30')}
              onPress={onDeleteSelected}
              disabled={isBulkWorking}
              loading={isBulkWorking}
              accessibilityLabel={i18nT('map:components.UserPoints.PointsListBulkModals.udalit_0873ed30')}
              fullWidth
              variant="danger"
            />

            <Button
              label={i18nT('map:components.UserPoints.PointsListBulkModals.otmena_95ebfb0e')}
              onPress={onCloseConfirmDeleteSelected}
              accessibilityLabel={i18nT('map:components.UserPoints.PointsListBulkModals.otmena_95ebfb0e')}
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
            accessibilityLabel={i18nT('map:components.UserPoints.PointsListBulkModals.zakryt_1fe45ea3')}
          />
          <View style={styles.actionsModal}>
            <Text style={styles.actionsTitle}>{i18nT('map:components.UserPoints.PointsListBulkModals.udalit_vse_tochki_e0facc9e')}</Text>
            <Text style={styles.emptySubtext}>{i18nT('map:components.UserPoints.PointsListBulkModals.eto_deystvie_nelzya_otmenit_f93bb176')}</Text>

            <Button
              label={i18nT('map:components.UserPoints.PointsListBulkModals.udalit_vse_faada381')}
              onPress={onDeleteAll}
              disabled={isBulkWorking}
              loading={isBulkWorking}
              accessibilityLabel={i18nT('map:components.UserPoints.PointsListBulkModals.udalit_vse_faada381')}
              fullWidth
              variant="danger"
            />

            <Button
              label={i18nT('map:components.UserPoints.PointsListBulkModals.otmena_95ebfb0e')}
              onPress={onCloseConfirmDeleteAll}
              accessibilityLabel={i18nT('map:components.UserPoints.PointsListBulkModals.otmena_95ebfb0e')}
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
