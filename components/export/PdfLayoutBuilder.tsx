// components/export/PdfLayoutBuilder.tsx
// ✅ АРХИТЕКТУРА: Конструктор макета PDF с drag-and-drop

import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ScrollView, Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { LayoutBlock, LayoutBlockType, PdfLayout, BlockMetadata } from '@/src/types/pdf-layout';
import { BLOCK_METADATA, DEFAULT_LAYOUTS } from '@/src/types/pdf-layout';
import BlockPreview from './BlockPreview';
import GalleryBlockSettings from './GalleryBlockSettings';

interface PdfLayoutBuilderProps {
  visible: boolean;
  onClose: () => void;
  onSave: (layout: PdfLayout) => void;
  initialLayout?: PdfLayout;
  travelCount: number;
}

export default function PdfLayoutBuilder({
  visible,
  onClose,
  onSave,
  initialLayout,
  travelCount,
}: PdfLayoutBuilderProps) {
  const [layout, setLayout] = useState<PdfLayout>(
    initialLayout || { ...DEFAULT_LAYOUTS[0], layoutMode: 'page-per-block' }
  );
  const [draggedBlock, setDraggedBlock] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [editingBlock, setEditingBlock] = useState<LayoutBlock | null>(null);

  // Доступные блоки для добавления
  const availableBlocks = useMemo(() => {
    const usedTypes = new Set(layout.blocks.map(b => b.type));
    return Object.values(BLOCK_METADATA).filter(
      meta => !usedTypes.has(meta.type) || meta.type === 'spacer'
    );
  }, [layout.blocks]);

  // Добавление блока
  const handleAddBlock = useCallback((type: LayoutBlockType) => {
    const newBlock: LayoutBlock = {
      id: `block-${Date.now()}-${Math.random()}`,
      type,
      order: layout.blocks.length + 1,
      enabled: true,
      config: BLOCK_METADATA[type].defaultConfig,
    };
    setLayout({
      ...layout,
      blocks: [...layout.blocks, newBlock],
    });
  }, [layout]);

  // Удаление блока
  const handleRemoveBlock = useCallback((id: string) => {
    setLayout({
      ...layout,
      blocks: layout.blocks
        .filter(b => b.id !== id)
        .map((b, index) => ({ ...b, order: index + 1 })),
    });
  }, [layout]);

  // Переключение видимости блока
  const handleToggleBlock = useCallback((id: string) => {
    setLayout({
      ...layout,
      blocks: layout.blocks.map(b =>
        b.id === id ? { ...b, enabled: !b.enabled } : b
      ),
    });
  }, [layout]);

  // Настройка блока
  const handleConfigureBlock = useCallback((block: LayoutBlock) => {
    if (block.type === 'gallery') {
      setEditingBlock(block);
    }
  }, []);

  // Сохранение настроек блока
  const handleSaveBlockConfig = useCallback((config: Record<string, any>) => {
    if (!editingBlock) return;
    setLayout({
      ...layout,
      blocks: layout.blocks.map(b =>
        b.id === editingBlock.id ? { ...b, config } : b
      ),
    });
    setEditingBlock(null);
  }, [editingBlock, layout]);

  // Drag and Drop handlers
  const handleDragStart = useCallback((id: string) => {
    setDraggedBlock(id);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedBlock(null);
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (!draggedBlock) return;

    const draggedIndex = layout.blocks.findIndex(b => b.id === draggedBlock);
    if (draggedIndex === -1 || draggedIndex === targetIndex) {
      setDraggedBlock(null);
      setDragOverIndex(null);
      return;
    }

    const newBlocks = [...layout.blocks];
    const [removed] = newBlocks.splice(draggedIndex, 1);
    newBlocks.splice(targetIndex, 0, removed);

    setLayout({
      ...layout,
      blocks: newBlocks.map((b, index) => ({ ...b, order: index + 1 })),
    });

    setDraggedBlock(null);
    setDragOverIndex(null);
  }, [draggedBlock, layout]);

  // Сохранение макета
  const handleSave = useCallback(() => {
    onSave(layout);
    onClose();
  }, [layout, onSave, onClose]);

  if (Platform.OS !== 'web') {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}
        onClick={onClose}
      >
        <div
          style={{
            backgroundColor: '#fff',
            borderRadius: 16,
            padding: 24,
            maxWidth: 900,
            width: '90%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Заголовок */}
          <View style={styles.header}>
            <Text style={styles.title}>Конструктор макета PDF</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color="#666" />
            </Pressable>
          </View>

          {/* Основной контент */}
          <View style={styles.content}>
            {/* Панель доступных блоков */}
            <View style={styles.sidebar}>
              <Text style={styles.sidebarTitle}>Доступные блоки</Text>
              <ScrollView style={styles.blocksList}>
                {availableBlocks.map((meta) => (
                  <Pressable
                    key={meta.type}
                    onPress={() => handleAddBlock(meta.type)}
                    style={styles.blockItem}
                  >
                    <MaterialIcons name={meta.icon as any} size={20} color="#ff9f5a" />
                    <View style={styles.blockItemText}>
                      <Text style={styles.blockItemLabel}>{meta.label}</Text>
                      <Text style={styles.blockItemDesc}>{meta.description}</Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* Область макета */}
            <View style={styles.canvas}>
              <View style={styles.canvasHeader}>
                <Text style={styles.canvasTitle}>Макет страниц</Text>
                <View style={styles.layoutModeSelector}>
                  <Pressable
                    onPress={() => setLayout({ ...layout, layoutMode: 'flow' })}
                    style={[
                      styles.modeButton,
                      layout.layoutMode === 'flow' && styles.modeButtonActive,
                    ]}
                  >
                    <Text style={[
                      styles.modeButtonText,
                      layout.layoutMode === 'flow' && styles.modeButtonTextActive,
                    ]}>
                      Поток
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setLayout({ ...layout, layoutMode: 'page-per-block' })}
                    style={[
                      styles.modeButton,
                      layout.layoutMode === 'page-per-block' && styles.modeButtonActive,
                    ]}
                  >
                    <Text style={[
                      styles.modeButtonText,
                      layout.layoutMode === 'page-per-block' && styles.modeButtonTextActive,
                    ]}>
                      Каждый блок на новой странице
                    </Text>
                  </Pressable>
                </View>
              </View>
              <ScrollView style={styles.layoutArea}>
                {layout.blocks.length === 0 ? (
                  <View style={styles.emptyState}>
                    <MaterialIcons name="add-photo-alternate" size={48} color="#ccc" />
                    <Text style={styles.emptyStateText}>
                      Перетащите блоки сюда или выберите из списка
                    </Text>
                  </View>
                ) : (
                  layout.blocks.map((block, index) => {
                    const meta = BLOCK_METADATA[block.type];
                    const isDragging = draggedBlock === block.id;
                    const isDragOver = dragOverIndex === index;

                    return (
                      <div
                        key={block.id}
                        draggable
                        onDragStart={() => handleDragStart(block.id)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
                        onDrop={(e) => handleDrop(e, index)}
                        style={{
                          display: 'flex',
                          flexDirection: 'row',
                          alignItems: 'center',
                          padding: 12,
                          marginBottom: 8,
                          backgroundColor: block.enabled ? '#fff' : '#f5f5f5',
                          border: `2px solid ${isDragOver ? '#ff9f5a' : block.enabled ? '#e0e0e0' : '#ccc'}`,
                          borderRadius: 8,
                          cursor: 'move',
                          opacity: isDragging ? 0.5 : 1,
                          transition: 'all 0.2s',
                        }}
                      >
                        <MaterialIcons
                          name="drag-handle"
                          size={20}
                          color="#999"
                          style={{ marginRight: 12 }}
                        />
                        <MaterialIcons
                          name={meta.icon as any}
                          size={24}
                          color={block.enabled ? '#ff9f5a' : '#999'}
                          style={{ marginRight: 12 }}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={[
                            styles.blockLabel,
                            !block.enabled && styles.blockLabelDisabled,
                          ]}>
                            {meta.label}
                          </Text>
                          <Text style={styles.blockOrder}>
                            Порядок: {block.order}
                          </Text>
                          {/* Превью блока */}
                          <View style={{ marginTop: 8 }}>
                            <BlockPreview block={block} meta={meta} />
                          </View>
                        </View>
                        <View style={styles.blockActions}>
                          {block.type === 'gallery' && (
                            <Pressable
                              onPress={() => handleConfigureBlock(block)}
                              style={styles.actionButton}
                            >
                              <MaterialIcons name="settings" size={20} color="#2196f3" />
                            </Pressable>
                          )}
                          {/* Настройка разрыва страницы */}
                          <Pressable
                            onPress={() => {
                              const newPageBreak = block.pageBreak === 'always' 
                                ? 'auto' 
                                : block.pageBreak === 'auto' 
                                ? 'avoid' 
                                : 'always';
                              setLayout({
                                ...layout,
                                blocks: layout.blocks.map(b =>
                                  b.id === block.id ? { ...b, pageBreak: newPageBreak } : b
                                ),
                              });
                            }}
                            style={styles.actionButton}
                            title={
                              block.pageBreak === 'always' 
                                ? 'Всегда новая страница' 
                                : block.pageBreak === 'avoid' 
                                ? 'Избегать разрыва' 
                                : 'Автоматически'
                            }
                          >
                            <MaterialIcons 
                              name={
                                block.pageBreak === 'always' 
                                  ? 'insert-page-break' 
                                  : block.pageBreak === 'avoid' 
                                  ? 'merge-type' 
                                  : 'auto-awesome'
                              } 
                              size={18} 
                              color={
                                block.pageBreak === 'always' 
                                  ? '#ff9f5a' 
                                  : block.pageBreak === 'avoid' 
                                  ? '#9c27b0' 
                                  : '#666'
                              } 
                            />
                          </Pressable>
                          <Pressable
                            onPress={() => handleToggleBlock(block.id)}
                            style={styles.actionButton}
                          >
                            <MaterialIcons
                              name={block.enabled ? 'visibility' : 'visibility-off'}
                              size={20}
                              color={block.enabled ? '#4caf50' : '#999'}
                            />
                          </Pressable>
                          <Pressable
                            onPress={() => handleRemoveBlock(block.id)}
                            style={styles.actionButton}
                          >
                            <MaterialIcons name="delete" size={20} color="#f44336" />
                          </Pressable>
                        </View>
                      </div>
                    );
                  })
                )}
              </ScrollView>
            </View>
          </View>

          {/* Футер с кнопками */}
          <View style={styles.footer}>
            <Pressable onPress={onClose} style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>Отмена</Text>
            </Pressable>
            <Pressable onPress={handleSave} style={styles.saveButton}>
              <Text style={styles.saveButtonText}>Сохранить макет</Text>
            </Pressable>
          </View>
        </div>
      </div>

      {/* Настройки галереи */}
      {editingBlock && editingBlock.type === 'gallery' && (
        <GalleryBlockSettings
          visible={!!editingBlock}
          onClose={() => setEditingBlock(null)}
          onSave={handleSaveBlockConfig}
          block={editingBlock}
        />
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a202c',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flexDirection: 'row',
    gap: 16,
    flex: 1,
    minHeight: 400,
  },
  sidebar: {
    width: 280,
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
    paddingRight: 16,
  },
  sidebarTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  blocksList: {
    maxHeight: 500,
  },
  blockItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    cursor: 'pointer',
  },
  blockItemText: {
    marginLeft: 12,
    flex: 1,
  },
  blockItemLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  blockItemDesc: {
    fontSize: 12,
    color: '#6b7280',
  },
  canvas: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  canvasHeader: {
    marginBottom: 12,
  },
  canvasTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  layoutModeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  modeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  modeButtonActive: {
    backgroundColor: '#ff9f5a',
    borderColor: '#ff9f5a',
  },
  modeButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
  },
  modeButtonTextActive: {
    color: '#fff',
  },
  layoutArea: {
    flex: 1,
    backgroundColor: '#fafafa',
    borderRadius: 8,
    padding: 16,
    minHeight: 400,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    marginTop: 16,
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  blockLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  blockLabelDisabled: {
    color: '#9ca3af',
    textDecorationLine: 'line-through',
  },
  blockOrder: {
    fontSize: 12,
    color: '#6b7280',
  },
  blockActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  saveButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#ff9f5a',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});

