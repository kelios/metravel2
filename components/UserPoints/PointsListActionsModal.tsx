import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import Button from '@/components/ui/Button';
import { translate as i18nT } from '@/i18n'


type Props = {
  styles: Record<string, any>;
  visible: boolean;
  exportError: string | null;
  isExporting: boolean;
  onClose: () => void;
  onImport: () => void;
  onExport: () => void;
  onOpenManualAdd: () => void;
  onStartSelection: () => void;
  onDeleteAll: () => void;
};

export const PointsListActionsModal: React.FC<Props> = ({
  styles,
  visible,
  exportError,
  isExporting,
  onClose,
  onImport,
  onExport,
  onOpenManualAdd,
  onStartSelection,
  onDeleteAll,
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.actionsOverlay}>
        <Pressable
          style={styles.actionsBackdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={i18nT('map:components.UserPoints.PointsListActionsModal.zakryt_menyu_31a2a732')}
        />

        <View style={styles.actionsModal}>
          <View style={styles.actionsHeader}>
            <Text style={styles.actionsTitle}>{i18nT('map:components.UserPoints.PointsListActionsModal.upravlenie_tochkami_a5f80595')}</Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={i18nT('map:components.UserPoints.PointsListActionsModal.zakryt_menyu_deystviy_93b02919')}
              style={styles.actionsCloseButton}
            >
              <Feather name="x" size={20} color={styles.actionsTitle.color} />
            </Pressable>
          </View>

          {exportError ? <Text style={styles.manualErrorText}>{exportError}</Text> : null}

          <Button
            label={i18nT('map:components.UserPoints.PointsListActionsModal.importirovat_tochki_2bbbff1c')}
            onPress={onImport}
            accessibilityLabel={i18nT('map:components.UserPoints.PointsListActionsModal.importirovat_tochki_2bbbff1c')}
            fullWidth
            style={styles.actionsButton}
          />

          <Button
            label={isExporting ? i18nT('map:components.UserPoints.PointsListActionsModal.eksport_18ea80fc') : i18nT('map:components.UserPoints.PointsListActionsModal.eksportirovat_kml_98dccbc3')}
            onPress={onExport}
            accessibilityLabel={i18nT('map:components.UserPoints.PointsListActionsModal.eksportirovat_kml_98dccbc3')}
            fullWidth
            loading={isExporting}
            style={styles.actionsButton}
          />

          <Button
            label={i18nT('map:components.UserPoints.PointsListActionsModal.dobavit_vruchnuyu_05015f8e')}
            onPress={onOpenManualAdd}
            accessibilityLabel={i18nT('map:components.UserPoints.PointsListActionsModal.dobavit_vruchnuyu_05015f8e')}
            fullWidth
            style={styles.actionsButton}
          />

          <Button
            label={i18nT('map:components.UserPoints.PointsListActionsModal.vybrat_tochki_11cd887a')}
            onPress={onStartSelection}
            accessibilityLabel={i18nT('map:components.UserPoints.PointsListActionsModal.vybrat_tochki_11cd887a')}
            fullWidth
            style={styles.actionsButton}
          />

          <Button
            label={i18nT('map:components.UserPoints.PointsListActionsModal.udalit_vse_tochki_f78e6889')}
            onPress={onDeleteAll}
            accessibilityLabel={i18nT('map:components.UserPoints.PointsListActionsModal.udalit_vse_tochki_f78e6889')}
            fullWidth
            variant="danger"
            style={styles.actionsButton}
          />

          <Button
            label={i18nT('map:components.UserPoints.PointsListActionsModal.otmena_bfdbf5e3')}
            onPress={onClose}
            accessibilityLabel={i18nT('map:components.UserPoints.PointsListActionsModal.otmena_bfdbf5e3')}
            fullWidth
            variant="ghost"
          />
        </View>
      </View>
    </Modal>
  );
};
