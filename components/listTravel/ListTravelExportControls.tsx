import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import type { Travel } from '@/types/types';
import type { BookSettings } from '@/components/export/BookSettingsModal';
import type { ExportConfig } from '@/types/pdf-export';
import { usePdfExport } from '@/hooks/usePdfExport';
import { useThemedColors } from '@/hooks/useTheme';
import { ExportBar } from './ExportBar';
import BookSettingsModal from '@/components/export/BookSettingsModal';
import { createStyles } from './listTravelStyles';

type ExportBarStyles = ReturnType<typeof createStyles>;

type Props = {
  isMobile: boolean;
  travels: Travel[];
  selected: Travel[];
  ownerName?: string | null;
  pdfConfig?: ExportConfig;
  toggleSelectAll: () => void;
  clearSelection: () => void;
  moveSelected: (id: number | string, direction: 'up' | 'down') => void;
  hasSelection: boolean;
  selectionCount: number;
  baseSettings: BookSettings;
  lastSettings: BookSettings;
  settingsSummary: string;
  setLastSettings: React.Dispatch<React.SetStateAction<BookSettings>>;
  styles: Record<string, unknown>;
};

function ListTravelExportControls({
  isMobile,
  travels,
  selected,
  ownerName,
  pdfConfig,
  toggleSelectAll,
  clearSelection,
  moveSelected,
  hasSelection,
  selectionCount,
  baseSettings,
  lastSettings,
  settingsSummary,
  setLastSettings,
  styles,
}: Props) {
  const colors = useThemedColors();
  const pdfExport = usePdfExport(selected, pdfConfig);
  const [isBookSettingsOpen, setIsBookSettingsOpen] = useState(false);

  const handleCloseSettings = useCallback(() => {
    setIsBookSettingsOpen(false);
  }, []);

  const handleImmediateSave = useCallback(() => {
    void pdfExport.openPrintBook(lastSettings);
  }, [lastSettings, pdfExport]);

  const handleOpenSettings = useCallback(() => {
    setIsBookSettingsOpen(true);
  }, []);

  const handleSaveWithSettings = useCallback(
    async (settings: BookSettings) => {
      setLastSettings(settings);
      await pdfExport.openPrintBook(settings);
    },
    [pdfExport, setLastSettings],
  );

  const handlePreviewWithSettings = useCallback(
    async (settings: BookSettings) => {
      setLastSettings(settings);
      await pdfExport.openPrintBook(settings);
    },
    [pdfExport, setLastSettings],
  );

  const userName = useMemo(() => String(ownerName || ''), [ownerName]);

  return (
    <>
      <BookSettingsModal
        visible={isBookSettingsOpen}
        onClose={handleCloseSettings}
        onSave={handleSaveWithSettings}
        onPreview={handlePreviewWithSettings}
        defaultSettings={lastSettings || baseSettings}
        travelCount={selectionCount}
        userName={userName}
        mode="save"
      />

      <ExportBar
        isMobile={isMobile}
        selectedCount={selectionCount}
        allCount={travels.length}
        onToggleSelectAll={toggleSelectAll}
        onClearSelection={clearSelection}
        onSave={handleImmediateSave}
        onSettings={handleOpenSettings}
        isGenerating={pdfExport.isGenerating}
        progress={pdfExport.progress}
        settingsSummary={settingsSummary}
        hasSelection={hasSelection}
        styles={styles as ExportBarStyles}
      />

      {hasSelection ? (
        <View style={(styles as ExportBarStyles).selectedOrderPanel}>
          <View style={(styles as ExportBarStyles).selectedOrderHeader}>
            <Text style={(styles as ExportBarStyles).selectedOrderTitle}>Порядок в книге</Text>
            <Text style={(styles as ExportBarStyles).selectedOrderSubtitle}>
              Меняйте местами выбранные путешествия. Этот порядок используется в режиме "Как расположено в списке выбора".
            </Text>
          </View>
          <View style={(styles as ExportBarStyles).selectedOrderList}>
            {selected.map((travel, index) => (
              <View
                key={String(travel.id ?? travel.slug ?? `${travel.name}-${index}`)}
                style={(styles as ExportBarStyles).selectedOrderItem}
              >
                <View style={(styles as ExportBarStyles).selectedOrderItemInfo}>
                  <Text style={(styles as ExportBarStyles).selectedOrderIndex}>{index + 1}</Text>
                  <View style={(styles as ExportBarStyles).selectedOrderTextBlock}>
                    <Text
                      style={(styles as ExportBarStyles).selectedOrderItemTitle}
                      numberOfLines={1}
                    >
                      {travel.name || 'Без названия'}
                    </Text>
                    {!!(travel.countryName || travel.year) && (
                      <Text
                        style={(styles as ExportBarStyles).selectedOrderItemMeta}
                        numberOfLines={1}
                    >
                        {[travel.countryName, travel.year].filter(Boolean).join(' • ')}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={(styles as ExportBarStyles).selectedOrderActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Поднять ${travel.name || 'путешествие'} выше`}
                    disabled={index === 0}
                    onPress={() => moveSelected(travel.id ?? travel.slug ?? index, 'up')}
                    style={[
                      (styles as ExportBarStyles).selectedOrderActionButton,
                      index === 0 && (styles as ExportBarStyles).selectedOrderActionButtonDisabled,
                    ]}
                  >
                    <Feather
                      name="chevron-up"
                      size={16}
                      color={index === 0 ? colors.textTertiary : colors.text}
                    />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Опустить ${travel.name || 'путешествие'} ниже`}
                    disabled={index === selected.length - 1}
                    onPress={() => moveSelected(travel.id ?? travel.slug ?? index, 'down')}
                    style={[
                      (styles as ExportBarStyles).selectedOrderActionButton,
                      index === selected.length - 1 &&
                        (styles as ExportBarStyles).selectedOrderActionButtonDisabled,
                    ]}
                  >
                    <Feather
                      name="chevron-down"
                      size={16}
                      color={index === selected.length - 1 ? colors.textTertiary : colors.text}
                    />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </>
  );
}

export default React.memo(ListTravelExportControls);
