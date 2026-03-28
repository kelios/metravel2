import React, { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import type { Travel } from '@/types/types';
import type { BookSettings } from '@/components/export/BookSettingsModal';
import type { ExportConfig } from '@/types/pdf-export';
import { usePdfExport } from '@/hooks/usePdfExport';
import { Caption } from '@/components/ui/Typography';
import UIButton from '@/components/ui/Button';
import ProgressIndicator from '@/components/ui/ProgressIndicator';
import BookSettingsModal from '@/components/export/BookSettingsModal';
import SelectedTravelOrderCard from './SelectedTravelOrderCard';
import { createStyles } from './listTravelStyles';
import { getTravelLabel } from '@/services/pdf-export/utils/pluralize';

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

function CompactActionLink({
  label,
  onPress,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  icon?: string;
  style?: any;
}) {
  if (Platform.OS !== 'web') {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
      >
        {icon ? <Feather name={icon as any} size={13} color={style?.color} /> : null}
        <Text style={style}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onPress(); }}
      onKeyDown={(e: any) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault(); e.stopPropagation(); onPress();
      }}
      style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
    >
      {icon ? <Feather name={icon as any} size={13} color={style?.color} /> : null}
      <Text style={style}>{label}</Text>
    </div>
  );
}

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
  settingsSummary: _settingsSummary,
  setLastSettings,
  styles,
}: Props) {
  const pdfExport = usePdfExport(selected, pdfConfig);
  const [isBookSettingsOpen, setIsBookSettingsOpen] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const s = styles as ExportBarStyles;

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

  const selectionText = selectionCount
    ? `Выбрано ${selectionCount} ${getTravelLabel(selectionCount)}`
    : 'Выберите путешествия для экспорта';

  const selectedOrderListStyle = useMemo(
    () => [s.selectedOrderList],
    [s.selectedOrderList]
  );

  const renderOrderCards = () => {
    const cards = selected.map((travel, index) => {
      const itemId = String(travel.id ?? travel.slug ?? index);
      return (
        <SelectedTravelOrderCard
          key={String(travel.id ?? travel.slug ?? `${travel.name}-${index}`)}
          travel={travel}
          itemId={itemId}
          index={index}
          isMobile={isMobile}
          styles={s}
          isDragging={draggedId === itemId}
          isDropTarget={dropTargetId === itemId}
          canMoveUp={index > 0}
          canMoveDown={index < selected.length - 1}
          onMoveUp={() => moveSelected(travel.id ?? travel.slug ?? index, 'up')}
          onMoveDown={() => moveSelected(travel.id ?? travel.slug ?? index, 'down')}
          onDragStart={() => setDraggedId(itemId)}
          onDragEnter={() => {
            if (!draggedId || draggedId === itemId) return;
            setDropTargetId(itemId);
          }}
          onDrop={(sourceId) => {
            const effectiveDraggedId = String(sourceId || draggedId || '');
            if (!effectiveDraggedId || effectiveDraggedId === itemId) {
              setDraggedId(null);
              setDropTargetId(null);
              return;
            }
            moveSelectedTo(effectiveDraggedId, itemId);
            setDraggedId(null);
            setDropTargetId(null);
          }}
          onDragEnd={() => {
            setDraggedId(null);
            setDropTargetId(null);
          }}
        />
      );
    });

    if (isWeb) {
      return (
        <div
          style={{
            width: '100%',
            maxWidth: '100%',
            overflowX: 'auto',
            overflowY: 'hidden',
            paddingBottom: 4,
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              minWidth: 'max-content',
              columnGap: 10,
            }}
          >
            {cards}
          </div>
        </div>
      );
    }

    return (
      <ScrollView
        horizontal={isMobile}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={!isMobile}
        contentContainerStyle={
          isMobile ? selectedOrderListStyle : s.selectedOrderGrid
        }
      >
        {cards}
      </ScrollView>
    );
  };

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

      <View style={[s.exportWorkspace, isMobile && s.exportWorkspaceMobile]}>
        {/* Header row: selection info + actions + PDF button */}
        <View style={[s.exportBar, isMobile && s.exportBarMobile]}>
          <View style={s.exportBarInfo}>
            <View style={s.exportBarHeaderRow}>
              <Text style={s.exportBarInfoTitle as any}>{selectionText}</Text>
              {hasSelection && (
                <View style={s.exportBarCountBadge}>
                  <Caption style={s.exportBarCountBadgeText}>{selectionCount}</Caption>
                </View>
              )}
            </View>
            {!hasSelection && (
              <Caption style={s.exportBarHint}>
                Отметьте путешествия ниже, чтобы собрать PDF-книгу
              </Caption>
            )}
          </View>

          <View style={s.exportBarActions}>
            <CompactActionLink
              label={selectionCount === travels.length && travels.length > 0 ? 'Снять все' : 'Выбрать все'}
              onPress={toggleSelectAll}
              style={s.linkButton as any}
            />
            {hasSelection && (
              <CompactActionLink
                label="Очистить"
                onPress={clearSelection}
                style={s.linkButton as any}
              />
            )}
            {hasSelection && (
              <CompactActionLink
                label="Настройки"
                onPress={handleOpenSettings}
                icon="settings"
                style={s.linkButton as any}
              />
            )}
          </View>

          <View style={[s.exportBarButtons, isMobile && s.exportBarButtonsMobile]}>
            <UIButton
              label={pdfExport.isGenerating ? `Генерация... ${pdfExport.progress || 0}%` : 'Сохранить PDF'}
              onPress={handleImmediateSave}
              disabled={!hasSelection || pdfExport.isGenerating}
              size="sm"
            />
          </View>
        </View>

        {/* Progress bar */}
        {pdfExport.isGenerating && isWeb && (
          <View style={s.progressWrapper}>
            <ProgressIndicator
              progress={pdfExport.progress ?? 0}
              stage={
                (pdfExport.progress ?? 0) < 30
                  ? 'Подготовка данных...'
                  : (pdfExport.progress ?? 0) < 60
                    ? 'Генерация содержимого...'
                    : (pdfExport.progress ?? 0) < 90
                      ? 'Обработка изображений...'
                      : 'Создание PDF...'
              }
              message={
                (pdfExport.progress ?? 0) < 30
                  ? 'Проверка выбранных путешествий'
                  : (pdfExport.progress ?? 0) < 60
                    ? 'Формирование макета'
                    : (pdfExport.progress ?? 0) < 90
                      ? 'Оптимизация изображений'
                      : 'Финальная обработка'
              }
              showPercentage
            />
          </View>
        )}

        {/* Compact order strip */}
        {hasSelection && (
          <View style={s.selectedOrderStrip}>
            <View style={s.selectedOrderStripHeader}>
              <Caption style={s.selectedOrderStripLabel}>
                Порядок в книге
              </Caption>
              <Caption style={s.selectedOrderStripHint}>
                Перетаскивайте для перестановки
              </Caption>
            </View>
            <View style={s.selectedOrderScroller}>
              {renderOrderCards()}
            </View>
          </View>
        )}
      </View>
    </>
  );
}

export default React.memo(ListTravelExportControls);
