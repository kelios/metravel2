// components/export/constructor/StylePanelImproved.tsx
// ✅ АРХИТЕКТУРА: Улучшенная панель стилей с лучшей организацией

import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import type { PdfBlock, PdfTheme } from '@/src/types/pdf-constructor';

interface StylePanelImprovedProps {
  block: PdfBlock;
  theme: PdfTheme;
  onUpdate: (updates: Partial<PdfBlock>) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function StylePanelImproved({ block, theme, onUpdate, onDelete, onClose }: StylePanelImprovedProps) {
  const [localStyles, setLocalStyles] = useState(block.styles);
  const [localContent, setLocalContent] = useState(block.content);
  const [activeTab, setActiveTab] = useState<'content' | 'text' | 'layout' | 'advanced'>('content');

  useEffect(() => {
    setLocalStyles(block.styles);
    setLocalContent(block.content);
  }, [block]);

  const handleUpdate = () => {
    onUpdate({
      styles: localStyles,
      content: localContent,
    });
  };

  const isTextBlock = ['heading-h1', 'heading-h2', 'heading-h3', 'paragraph', 'quote'].includes(block.type);
  const isImageBlock = ['image', 'image-with-caption', 'image-gallery'].includes(block.type);

  return (
    <div
      style={{
        width: 340,
        backgroundColor: '#fff',
        borderLeft: '1px solid #e0e0e0',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        boxShadow: '-2px 0 8px rgba(0,0,0,0.1)',
      }}
    >
      {/* Заголовок */}
      <div style={{ padding: 16, borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#1a202c', marginBottom: 4 }}>
            Стили блока
          </Text>
          <Text style={{ fontSize: 12, color: '#6b7280' }}>
            {block.type.replace('-', ' ')}
          </Text>
        </div>
        <Pressable onPress={onClose}>
          <div style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Text style={{ fontSize: 20, color: '#6b7280' }}>×</Text>
          </div>
        </Pressable>
      </div>

      {/* Вкладки */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e0e0e0' }}>
        {(['content', 'text', 'layout', 'advanced'] as const).map((tab) => (
          <Pressable
            key={tab}
            onPress={() => setActiveTab(tab)}
          >
            <div
              style={{
                flex: 1,
                padding: 12,
                textAlign: 'center',
                cursor: 'pointer',
                borderBottom: activeTab === tab ? '2px solid #ff9f5a' : '2px solid transparent',
                backgroundColor: activeTab === tab ? '#fff5f0' : '#fff',
                transition: 'all 0.2s',
              } as React.CSSProperties}
            >
              <Text style={{ fontSize: 12, fontWeight: activeTab === tab ? '600' : '400', color: activeTab === tab ? '#ff9f5a' : '#6b7280' }}>
                {tab === 'content' ? 'Контент' : tab === 'text' ? 'Текст' : tab === 'layout' ? 'Макет' : 'Доп.'}
              </Text>
            </div>
          </Pressable>
        ))}
      </div>

      {/* Контент вкладок */}
      <ScrollView style={{ flex: 1 }}>
        {activeTab === 'content' && (
          <div style={{ padding: 16 }}>
            {/* Редактирование контента */}
            {typeof block.content === 'string' && (
              <div style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#1a202c', marginBottom: 8 }}>
                  Текст
                </Text>
                <textarea
                  value={localContent as string}
                  onChange={(e) => setLocalContent(e.target.value)}
                  onBlur={handleUpdate}
                  style={{
                    width: '100%',
                    minHeight: 120,
                    padding: 12,
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    fontSize: 14,
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    outline: 'none',
                  }}
                  placeholder="Введите текст..."
                />
              </div>
            )}

            {/* Для изображений */}
            {isImageBlock && typeof block.content === 'object' && 'url' in block.content && (
              <div style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#1a202c', marginBottom: 8 }}>
                  URL изображения
                </Text>
                <input
                  type="text"
                  value={(block.content as any).url || ''}
                  onChange={(e) => {
                    onUpdate({
                      content: { ...(block.content as any), url: e.target.value },
                    });
                  }}
                  style={{
                    width: '100%',
                    padding: 10,
                    border: '1px solid #e5e7eb',
                    borderRadius: 6,
                    fontSize: 14,
                    outline: 'none',
                  }}
                  placeholder="https://example.com/image.jpg"
                />
              </div>
            )}
          </div>
        )}

        {activeTab === 'text' && isTextBlock && (
          <div style={{ padding: 16 }}>
            {/* Размер шрифта */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#1a202c' }}>
                  Размер шрифта
                </Text>
                <Text style={{ fontSize: 12, color: '#6b7280' }}>
                  {localStyles.fontSize || theme.typography.bodySize}px
                </Text>
              </div>
              <input
                type="range"
                min="8"
                max="72"
                value={localStyles.fontSize || theme.typography.bodySize}
                onChange={(e) => {
                  setLocalStyles({ ...localStyles, fontSize: parseFloat(e.target.value) });
                  handleUpdate();
                }}
                style={{ width: '100%' }}
              />
              <input
                type="number"
                value={localStyles.fontSize || theme.typography.bodySize}
                onChange={(e) => {
                  setLocalStyles({ ...localStyles, fontSize: parseFloat(e.target.value) || theme.typography.bodySize });
                }}
                onBlur={handleUpdate}
                style={{
                  width: '100%',
                  marginTop: 8,
                  padding: 8,
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  fontSize: 14,
                  outline: 'none',
                }}
              />
            </div>

            {/* Цвет текста */}
            <div style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#1a202c', marginBottom: 8 }}>
                Цвет текста
              </Text>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="color"
                  value={localStyles.color || theme.colors.text}
                  onChange={(e) => {
                    setLocalStyles({ ...localStyles, color: e.target.value });
                    handleUpdate();
                  }}
                  style={{
                    width: 50,
                    height: 40,
                    border: '1px solid #e5e7eb',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                />
                <input
                  type="text"
                  value={localStyles.color || theme.colors.text}
                  onChange={(e) => {
                    setLocalStyles({ ...localStyles, color: e.target.value });
                  }}
                  onBlur={handleUpdate}
                  style={{
                    flex: 1,
                    padding: 8,
                    border: '1px solid #e5e7eb',
                    borderRadius: 6,
                    fontSize: 14,
                    outline: 'none',
                  }}
                  placeholder="#000000"
                />
              </div>
            </div>

            {/* Выравнивание */}
            <div style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#1a202c', marginBottom: 8 }}>
                Выравнивание
              </Text>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['left', 'center', 'right', 'justify'] as const).map((align) => (
                  <Pressable
                    key={align}
                    onPress={() => {
                      setLocalStyles({ ...localStyles, textAlign: align });
                      handleUpdate();
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        padding: 10,
                        borderRadius: 6,
                        backgroundColor: localStyles.textAlign === align ? '#ff9f5a' : '#f3f4f6',
                        textAlign: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      } as React.CSSProperties}
                    >
                      <Text style={{ fontSize: 18, color: localStyles.textAlign === align ? '#fff' : '#1a202c' }}>
                        {align === 'left' ? '←' : align === 'center' ? '↔' : align === 'right' ? '→' : '═'}
                      </Text>
                    </div>
                  </Pressable>
                ))}
              </div>
            </div>

            {/* Жирность */}
            <div style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#1a202c', marginBottom: 8 }}>
                Начертание
              </Text>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['normal', 'bold', '300', '500', '700'] as const).map((weight) => (
                  <Pressable
                    key={weight}
                    onPress={() => {
                      setLocalStyles({ ...localStyles, fontWeight: weight });
                      handleUpdate();
                    }}
                  >
                    <div
                      style={{
                        padding: '8px 12px',
                        borderRadius: 6,
                        backgroundColor: localStyles.fontWeight === weight ? '#ff9f5a' : '#f3f4f6',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      } as React.CSSProperties}
                    >
                      <Text style={{ fontSize: 12, fontWeight: weight === 'normal' ? '400' : weight, color: localStyles.fontWeight === weight ? '#fff' : '#1a202c' }}>
                        {weight === 'normal' ? 'Обычный' : weight === 'bold' ? 'Жирный' : weight}
                      </Text>
                    </div>
                  </Pressable>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'layout' && (
          <div style={{ padding: 16 }}>
            {/* Фон */}
            <div style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#1a202c', marginBottom: 8 }}>
                Фон
              </Text>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="color"
                  value={localStyles.backgroundColor || 'transparent'}
                  onChange={(e) => {
                    setLocalStyles({ ...localStyles, backgroundColor: e.target.value });
                    handleUpdate();
                  }}
                  style={{
                    width: 50,
                    height: 40,
                    border: '1px solid #e5e7eb',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                />
                <input
                  type="text"
                  value={localStyles.backgroundColor || ''}
                  onChange={(e) => {
                    setLocalStyles({ ...localStyles, backgroundColor: e.target.value || undefined });
                  }}
                  onBlur={handleUpdate}
                  style={{
                    flex: 1,
                    padding: 8,
                    border: '1px solid #e5e7eb',
                    borderRadius: 6,
                    fontSize: 14,
                    outline: 'none',
                  }}
                  placeholder="transparent или #ffffff"
                />
              </div>
            </div>

            {/* Отступы */}
            <div style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#1a202c', marginBottom: 12 }}>
                Отступы
              </Text>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
                  <div key={side}>
                    <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                      {side === 'top' ? 'Сверху' : side === 'right' ? 'Справа' : side === 'bottom' ? 'Снизу' : 'Слева'}
                    </Text>
                    <input
                      type="number"
                      value={localStyles.padding?.[side] || 0}
                      onChange={(e) => {
                        setLocalStyles({
                          ...localStyles,
                          padding: { ...(localStyles.padding || {}), [side]: parseFloat(e.target.value) || 0 },
                        });
                      }}
                      onBlur={handleUpdate}
                      style={{
                        width: '100%',
                        padding: 8,
                        border: '1px solid #e5e7eb',
                        borderRadius: 6,
                        fontSize: 14,
                        outline: 'none',
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Граница */}
            <div style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#1a202c', marginBottom: 8 }}>
                Граница
              </Text>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  type="number"
                  value={localStyles.border?.width || 0}
                  onChange={(e) => {
                    setLocalStyles({
                      ...localStyles,
                      border: { ...(localStyles.border || {}), width: parseFloat(e.target.value) || 0 },
                    });
                  }}
                  onBlur={handleUpdate}
                  style={{
                    flex: 1,
                    padding: 8,
                    border: '1px solid #e5e7eb',
                    borderRadius: 6,
                    fontSize: 14,
                    outline: 'none',
                  }}
                  placeholder="Ширина"
                />
                <input
                  type="color"
                  value={localStyles.border?.color || '#000000'}
                  onChange={(e) => {
                    setLocalStyles({
                      ...localStyles,
                      border: { ...(localStyles.border || {}), color: e.target.value },
                    });
                    handleUpdate();
                  }}
                  style={{
                    width: 50,
                    height: 40,
                    border: '1px solid #e5e7eb',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                />
              </div>
              <select
                value={localStyles.border?.style || 'solid'}
                onChange={(e) => {
                  setLocalStyles({
                    ...localStyles,
                    border: { ...(localStyles.border || {}), style: e.target.value as any },
                  });
                  handleUpdate();
                }}
                style={{
                  width: '100%',
                  padding: 8,
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  fontSize: 14,
                  outline: 'none',
                }}
              >
                <option value="solid">Сплошная</option>
                <option value="dashed">Пунктирная</option>
                <option value="dotted">Точечная</option>
              </select>
            </div>
          </div>
        )}

        {activeTab === 'advanced' && (
          <div style={{ padding: 16 }}>
            {/* Прозрачность */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#1a202c' }}>
                  Прозрачность
                </Text>
                <Text style={{ fontSize: 12, color: '#6b7280' }}>
                  {Math.round((localStyles.opacity || 1) * 100)}%
                </Text>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={localStyles.opacity || 1}
                onChange={(e) => {
                  setLocalStyles({ ...localStyles, opacity: parseFloat(e.target.value) });
                  handleUpdate();
                }}
                style={{ width: '100%' }}
              />
            </div>

            {/* Тень */}
            <div style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#1a202c', marginBottom: 8 }}>
                Тень
              </Text>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <input
                  type="number"
                  value={localStyles.shadow?.offsetX || 0}
                  onChange={(e) => {
                    setLocalStyles({
                      ...localStyles,
                      shadow: { ...(localStyles.shadow || {}), offsetX: parseFloat(e.target.value) || 0 },
                    });
                  }}
                  onBlur={handleUpdate}
                  style={{
                    padding: 8,
                    border: '1px solid #e5e7eb',
                    borderRadius: 6,
                    fontSize: 14,
                    outline: 'none',
                  }}
                  placeholder="X"
                />
                <input
                  type="number"
                  value={localStyles.shadow?.offsetY || 0}
                  onChange={(e) => {
                    setLocalStyles({
                      ...localStyles,
                      shadow: { ...(localStyles.shadow || {}), offsetY: parseFloat(e.target.value) || 0 },
                    });
                  }}
                  onBlur={handleUpdate}
                  style={{
                    padding: 8,
                    border: '1px solid #e5e7eb',
                    borderRadius: 6,
                    fontSize: 14,
                    outline: 'none',
                  }}
                  placeholder="Y"
                />
              </div>
              <input
                type="number"
                value={localStyles.shadow?.blur || 0}
                onChange={(e) => {
                  setLocalStyles({
                    ...localStyles,
                    shadow: { ...(localStyles.shadow || {}), blur: parseFloat(e.target.value) || 0 },
                  });
                }}
                onBlur={handleUpdate}
                style={{
                  width: '100%',
                  marginBottom: 8,
                  padding: 8,
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  fontSize: 14,
                  outline: 'none',
                }}
                placeholder="Размытие"
              />
              <input
                type="color"
                value={localStyles.shadow?.color || '#000000'}
                onChange={(e) => {
                  setLocalStyles({
                    ...localStyles,
                    shadow: { ...(localStyles.shadow || {}), color: e.target.value },
                  });
                  handleUpdate();
                }}
                style={{
                  width: '100%',
                  height: 40,
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              />
            </div>
          </div>
        )}
      </ScrollView>

      {/* Действия */}
      <div style={{ padding: 16, borderTop: '1px solid #e0e0e0', display: 'flex', gap: 8 }}>
        <Pressable
          onPress={onDelete}
          style={{ flex: 1 }}
        >
          <div
            style={{
              padding: 12,
              backgroundColor: '#fee2e2',
              borderRadius: 6,
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
            } as React.CSSProperties}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#dc2626' }}>
              Удалить блок
            </Text>
          </div>
        </Pressable>
      </div>
    </div>
  );
}

