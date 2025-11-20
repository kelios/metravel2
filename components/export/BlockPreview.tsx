// components/export/BlockPreview.tsx
// ✅ АРХИТЕКТУРА: Превью блока для конструктора макета

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { LayoutBlock, BlockMetadata } from '@/src/types/pdf-layout';
import { BLOCK_METADATA } from '@/src/types/pdf-layout';

interface BlockPreviewProps {
  block: LayoutBlock;
  meta: BlockMetadata;
}

export default function BlockPreview({ block, meta }: BlockPreviewProps) {
  const renderPreview = () => {
    switch (block.type) {
      case 'cover':
        return (
          <div style={{
            width: '100%',
            height: '120px',
            backgroundColor: '#ff9f5a', // ✅ FIX: Заменено background на backgroundColor для React Native
            backgroundImage: 'linear-gradient(135deg, #ff9f5a 0%, #ff6b35 100%)', // Для веба
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 700,
            fontSize: '18px',
            textAlign: 'center',
            padding: '16px',
          }}>
            Обложка
          </div>
        );

      case 'toc':
        return (
          <div style={{
            width: '100%',
            padding: '16px',
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
          }}>
            <div style={{ fontWeight: 700, marginBottom: '12px', fontSize: '16px' }}>
              Содержание
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
              1 путешествие
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '8px',
              backgroundColor: '#fff',
              borderRadius: '4px',
              marginTop: '8px',
              fontSize: '12px',
            }}>
              <span>1. Название путешествия</span>
              <span style={{ color: '#ff9f5a', fontWeight: 600 }}>3</span>
            </div>
          </div>
        );

      case 'photo':
        return (
          <div style={{
            width: '100%',
            height: '120px',
            backgroundColor: '#f3f4f6',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px dashed #d1d5db',
          }}>
            <MaterialIcons name="image" size={32} color="#9ca3af" />
            <Text style={{ marginTop: 8, color: '#6b7280', fontSize: 12 }}>
              Главное фото
            </Text>
          </div>
        );

      case 'description':
        return (
          <div style={{
            width: '100%',
            padding: '16px',
            backgroundColor: '#fff',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
          }}>
            <div style={{
              fontWeight: 700,
              color: '#ff9f5a',
              marginBottom: '8px',
              fontSize: '14px',
              borderLeft: '4px solid #ff9f5a',
              paddingLeft: '8px',
            }}>
              Описание
            </div>
            <div style={{
              fontSize: '12px',
              color: '#6b7280',
              lineHeight: '1.6',
            }}>
              Текст описания путешествия будет отображаться здесь...
            </div>
          </div>
        );

      case 'recommendation':
        return (
          <div style={{
            width: '100%',
            padding: '16px',
            backgroundColor: '#fff',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
          }}>
            <div style={{
              fontWeight: 700,
              color: '#ff9f5a',
              marginBottom: '8px',
              fontSize: '14px',
              borderLeft: '4px solid #ff9f5a',
              paddingLeft: '8px',
            }}>
              Рекомендации
            </div>
            <div style={{
              fontSize: '12px',
              color: '#6b7280',
              lineHeight: '1.6',
            }}>
              Рекомендации и советы...
            </div>
          </div>
        );

      case 'plus':
        return (
          <div style={{
            width: '100%',
            padding: '12px',
            backgroundColor: '#dcfce7',
            borderRadius: '8px',
            border: '1px solid #86efac',
          }}>
            <div style={{
              fontWeight: 700,
              color: '#166534',
              marginBottom: '4px',
              fontSize: '13px',
            }}>
              Плюсы
            </div>
            <div style={{
              fontSize: '11px',
              color: '#15803d',
            }}>
              Положительные стороны...
            </div>
          </div>
        );

      case 'minus':
        return (
          <div style={{
            width: '100%',
            padding: '12px',
            backgroundColor: '#fee2e2',
            borderRadius: '8px',
            border: '1px solid #fca5a5',
          }}>
            <div style={{
              fontWeight: 700,
              color: '#991b1b',
              marginBottom: '4px',
              fontSize: '13px',
            }}>
              Минусы
            </div>
            <div style={{
              fontSize: '11px',
              color: '#dc2626',
            }}>
              Отрицательные стороны...
            </div>
          </div>
        );

      case 'gallery':
        const imageSize = block.config?.imageSize || 'medium';
        const columns = block.config?.columns || 3;
        const sizeMap = { small: '60px', medium: '80px', large: '100px' };
        const colMap = { 2: '50%', 3: '33.33%', 4: '25%' };
        
        return (
          <div style={{
            width: '100%',
            padding: '16px',
            backgroundColor: '#fff',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
          }}>
            <div style={{
              fontWeight: 700,
              marginBottom: '12px',
              fontSize: '14px',
            }}>
              Фотогалерея
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${columns}, 1fr)`,
              gap: '8px',
            }}>
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  style={{
                    width: '100%',
                    aspectRatio: '1',
                    backgroundColor: '#f3f4f6',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px dashed #d1d5db',
                  }}
                >
                  <MaterialIcons name="image" size={20} color="#9ca3af" />
                </div>
              ))}
            </div>
            <div style={{
              marginTop: '8px',
              fontSize: '11px',
              color: '#6b7280',
              display: 'flex',
              gap: '8px',
            }}>
              <span>Размер: {imageSize === 'small' ? 'Маленький' : imageSize === 'medium' ? 'Средний' : 'Большой'}</span>
              <span>•</span>
              <span>Колонок: {columns}</span>
            </div>
          </div>
        );

      case 'map':
        return (
          <div style={{
            width: '100%',
            height: '120px',
            backgroundColor: '#f0f9ff',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid #bae6fd',
          }}>
            <MaterialIcons name="map" size={32} color="#0284c7" />
            <Text style={{ marginTop: 8, color: '#0369a1', fontSize: 12 }}>
              Карта маршрута
            </Text>
          </div>
        );

      case 'qr':
        return (
          <div style={{
            width: '100%',
            padding: '16px',
            backgroundColor: '#fff',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <div style={{
              width: '60px',
              height: '60px',
              backgroundColor: '#f3f4f6',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <MaterialIcons name="qr-code" size={32} color="#6b7280" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>
                QR код
              </div>
              <div style={{ fontSize: '11px', color: '#6b7280' }}>
                Ссылка на онлайн-версию
              </div>
            </div>
          </div>
        );

      case 'spacer':
        return (
          <div style={{
            width: '100%',
            height: '40px',
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
            border: '1px dashed #d1d5db',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Text style={{ color: '#9ca3af', fontSize: 12 }}>
              Отступ
            </Text>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {renderPreview()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
});

