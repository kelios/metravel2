import React, { useCallback, useMemo, useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';

import type { Travel } from '@/types/types';
import type { BookSettings } from '@/components/export/BookSettingsModal';
import type { ExportConfig } from '@/types/pdf-export';
import { usePdfExport } from '@/hooks/usePdfExport';
import { Caption, Heading } from '@/components/ui/Typography';
import { ExportBar } from './ExportBar';
import BookSettingsModal from '@/components/export/BookSettingsModal';
import SelectedTravelOrderCard from './SelectedTravelOrderCard';
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
  moveSelectedTo: (id: number | string, targetId: number | string) => void;
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
  moveSelectedTo,
  hasSelection,
  selectionCount,
  baseSettings,
  lastSettings,
  settingsSummary,
  setLastSettings,
  styles,
}: Props) {
  const pdfExport = usePdfExport(selected, pdfConfig);
  const [isBookSettingsOpen, setIsBookSettingsOpen] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

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
  const isWeb = Platform.OS === 'web';
  const selectedOrderListStyle = useMemo(
    () => [
      (styles as ExportBarStyles).selectedOrderList,
    ],
    [styles]
  );

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

      <View
        style={[
          (styles as ExportBarStyles).exportWorkspace,
          isMobile && (styles as ExportBarStyles).exportWorkspaceMobile,
        ]}
      >
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
          <>
            <View
              style={[
                (styles as ExportBarStyles).exportWorkspaceDivider,
                isMobile && (styles as ExportBarStyles).exportWorkspaceDividerMobile,
              ]}
            />
            <View style={(styles as ExportBarStyles).selectedOrderPanel}>
              <View style={(styles as ExportBarStyles).selectedOrderHeaderRow}>
                <View style={(styles as ExportBarStyles).selectedOrderHeader}>
                  <Heading level={3} style={(styles as ExportBarStyles).selectedOrderTitle}>
                    Порядок в книге
                  </Heading>
                  <Caption style={(styles as ExportBarStyles).selectedOrderSubtitle}>
                    Перетаскивайте карточки мышью или используйте стрелки для точной перестановки.
                  </Caption>
                </View>
              </View>
              <View style={(styles as ExportBarStyles).selectedOrderScroller}>
                {isWeb ? (
                  <div
                    style={{
                      width: '100%',
                      maxWidth: '100%',
                      overflowX: 'auto',
                      overflowY: 'hidden',
                      paddingBottom: 6,
                      WebkitOverflowScrolling: 'touch',
                    }}
                  >
                    <div
                      style={{
                        display: 'inline-flex',
                        minWidth: 'max-content',
                        columnGap: 12,
                      }}
                    >
                      {selected.map((travel, index) => (
                        <SelectedTravelOrderCard
                          key={String(travel.id ?? travel.slug ?? `${travel.name}-${index}`)}
                          travel={travel}
                          itemId={String(travel.id ?? travel.slug ?? index)}
                          index={index}
                          isMobile={isMobile}
                          styles={styles as ExportBarStyles}
                          isDragging={draggedId === String(travel.id ?? travel.slug ?? index)}
                          isDropTarget={dropTargetId === String(travel.id ?? travel.slug ?? index)}
                          canMoveUp={index > 0}
                          canMoveDown={index < selected.length - 1}
                          onMoveUp={() => moveSelected(travel.id ?? travel.slug ?? index, 'up')}
                          onMoveDown={() => moveSelected(travel.id ?? travel.slug ?? index, 'down')}
                          onDragStart={() => setDraggedId(String(travel.id ?? travel.slug ?? index))}
                          onDragEnter={() => {
                            if (!draggedId || draggedId === String(travel.id ?? travel.slug ?? index)) return;
                            setDropTargetId(String(travel.id ?? travel.slug ?? index));
                          }}
                          onDrop={(sourceId) => {
                            const currentId = String(travel.id ?? travel.slug ?? index);
                            const effectiveDraggedId = String(sourceId || draggedId || '');
                            if (!effectiveDraggedId || effectiveDraggedId === currentId) {
                              setDraggedId(null);
                              setDropTargetId(null);
                              return;
                            }
                            moveSelectedTo(effectiveDraggedId, currentId);
                            setDraggedId(null);
                            setDropTargetId(null);
                          }}
                          onDragEnd={() => {
                            setDraggedId(null);
                            setDropTargetId(null);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <ScrollView
                    horizontal={isMobile}
                    showsHorizontalScrollIndicator={false}
                    showsVerticalScrollIndicator={!isMobile}
                    contentContainerStyle={
                      isMobile
                        ? selectedOrderListStyle
                        : (styles as ExportBarStyles).selectedOrderGrid
                    }
                  >
                    {selected.map((travel, index) => (
                      <SelectedTravelOrderCard
                        key={String(travel.id ?? travel.slug ?? `${travel.name}-${index}`)}
                        travel={travel}
                        itemId={String(travel.id ?? travel.slug ?? index)}
                        index={index}
                        isMobile={isMobile}
                        styles={styles as ExportBarStyles}
                        isDragging={draggedId === String(travel.id ?? travel.slug ?? index)}
                        isDropTarget={dropTargetId === String(travel.id ?? travel.slug ?? index)}
                        canMoveUp={index > 0}
                        canMoveDown={index < selected.length - 1}
                        onMoveUp={() => moveSelected(travel.id ?? travel.slug ?? index, 'up')}
                        onMoveDown={() => moveSelected(travel.id ?? travel.slug ?? index, 'down')}
                        onDragStart={() => setDraggedId(String(travel.id ?? travel.slug ?? index))}
                        onDragEnter={() => {
                          if (!draggedId || draggedId === String(travel.id ?? travel.slug ?? index)) return;
                          setDropTargetId(String(travel.id ?? travel.slug ?? index));
                        }}
                        onDrop={(sourceId) => {
                          const currentId = String(travel.id ?? travel.slug ?? index);
                          const effectiveDraggedId = String(sourceId || draggedId || '');
                          if (!effectiveDraggedId || effectiveDraggedId === currentId) {
                            setDraggedId(null);
                            setDropTargetId(null);
                            return;
                          }
                          moveSelectedTo(effectiveDraggedId, currentId);
                          setDraggedId(null);
                          setDropTargetId(null);
                        }}
                        onDragEnd={() => {
                          setDraggedId(null);
                          setDropTargetId(null);
                        }}
                      />
                    ))}
                  </ScrollView>
                )}
              </View>
            </View>
          </>
        ) : null}
      </View>
    </>
  );
}

export default React.memo(ListTravelExportControls);
