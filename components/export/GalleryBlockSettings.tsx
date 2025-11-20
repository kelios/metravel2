// components/export/GalleryBlockSettings.tsx
// ✅ АРХИТЕКТУРА: Настройки блока галереи

import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { LayoutBlock } from '@/src/types/pdf-layout';

interface GalleryBlockSettingsProps {
  visible: boolean;
  onClose: () => void;
  onSave: (config: LayoutBlock['config']) => void;
  block: LayoutBlock;
  availablePhotos?: Array<{ url: string; id?: string | number }>;
}

export default function GalleryBlockSettings({
  visible,
  onClose,
  onSave,
  block,
  availablePhotos = [],
}: GalleryBlockSettingsProps) {
  const [imageSize, setImageSize] = useState<'small' | 'medium' | 'large'>(
    block.config?.imageSize || 'medium'
  );
  const [columns, setColumns] = useState<number>(
    block.config?.columns || 3
  );
  const [selectedPhotos, setSelectedPhotos] = useState<number[]>(
    block.config?.selectedPhotos || []
  );

  const handleSave = () => {
    onSave({
      imageSize,
      columns,
      selectedPhotos: selectedPhotos.length > 0 ? selectedPhotos : undefined,
    });
    onClose();
  };

  const togglePhoto = (index: number) => {
    setSelectedPhotos(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
      } else {
        return [...prev, index];
      }
    });
  };

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
          zIndex: 1001,
        }}
        onClick={onClose}
      >
        <div
          style={{
            backgroundColor: '#fff',
            borderRadius: 16,
            padding: 24,
            maxWidth: 700,
            width: '90%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Настройки галереи</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color="#666" />
            </Pressable>
          </View>

          <ScrollView style={styles.content}>
            {/* Размер изображений */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Размер изображений</Text>
              <View style={styles.optionsRow}>
                {(['small', 'medium', 'large'] as const).map((size) => (
                  <Pressable
                    key={size}
                    onPress={() => setImageSize(size)}
                    style={[
                      styles.optionButton,
                      imageSize === size && styles.optionButtonActive,
                    ]}
                  >
                    <Text style={[
                      styles.optionButtonText,
                      imageSize === size && styles.optionButtonTextActive,
                    ]}>
                      {size === 'small' ? 'Маленький' : size === 'medium' ? 'Средний' : 'Большой'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Количество колонок */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Количество колонок</Text>
              <View style={styles.optionsRow}>
                {[2, 3, 4].map((cols) => (
                  <Pressable
                    key={cols}
                    onPress={() => setColumns(cols)}
                    style={[
                      styles.optionButton,
                      columns === cols && styles.optionButtonActive,
                    ]}
                  >
                    <Text style={[
                      styles.optionButtonText,
                      columns === cols && styles.optionButtonTextActive,
                    ]}>
                      {cols}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Выбор фото */}
            {availablePhotos.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Выбор фото ({selectedPhotos.length} из {availablePhotos.length})
                </Text>
                <Text style={styles.sectionDescription}>
                  Выберите фото для включения в галерею. Если ничего не выбрано, будут использованы все фото.
                </Text>
                <View style={styles.photosGrid}>
                  {availablePhotos.map((photo, index) => {
                    const isSelected = selectedPhotos.includes(index);
                    return (
                      <Pressable
                        key={index}
                        onPress={() => togglePhoto(index)}
                        style={[
                          styles.photoItem,
                          isSelected && styles.photoItemSelected,
                        ]}
                      >
                        <img
                          src={photo.url}
                          alt={`Photo ${index + 1}`}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            borderRadius: 6,
                          }}
                        />
                        {isSelected && (
                          <View style={styles.photoCheck}>
                            <MaterialIcons name="check-circle" size={24} color="#fff" />
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable onPress={onClose} style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>Отмена</Text>
            </Pressable>
            <Pressable onPress={handleSave} style={styles.saveButton}>
              <Text style={styles.saveButtonText}>Применить</Text>
            </Pressable>
          </View>
        </div>
      </div>
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
    fontSize: 20,
    fontWeight: '700',
    color: '#1a202c',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  sectionDescription: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 12,
    lineHeight: 1.5,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  optionButtonActive: {
    backgroundColor: '#ff9f5a',
    borderColor: '#ff9f5a',
  },
  optionButtonText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  optionButtonTextActive: {
    color: '#fff',
  },
  photosGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
    gap: 12,
  },
  photoItem: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  photoItemSelected: {
    borderColor: '#ff9f5a',
  },
  photoCheck: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#ff9f5a',
    borderRadius: 12,
    padding: 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
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

