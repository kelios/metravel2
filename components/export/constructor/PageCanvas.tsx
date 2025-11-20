// components/export/constructor/PageCanvas.tsx
// ✅ АРХИТЕКТУРА: Холст для отображения и редактирования страницы

import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { PdfPage, PdfBlock, PdfTheme } from '@/src/types/pdf-constructor';
import { PAGE_FORMATS } from '@/src/types/pdf-constructor';
import { DraggableBlock } from './DraggableBlock';
import { EditableTextBlock } from './EditableTextBlock';
import { ResizeHandles } from './ResizeHandles';
import { TipBlock } from './blocks/TipBlock';
import { ImportantBlock } from './blocks/ImportantBlock';
import { WarningBlock } from './blocks/WarningBlock';
import { QuoteBlock } from './blocks/QuoteBlock';
import { ChecklistBlock } from './blocks/ChecklistBlock';
import { TableBlock } from './blocks/TableBlock';
import { ImageGalleryBlock } from './blocks/ImageGalleryBlock';
import { MapBlock } from './blocks/MapBlock';

interface PageCanvasProps {
  page: PdfPage;
  theme: PdfTheme;
  selectedBlockId: string | null;
  editingBlockId: string | null;
  onSelectBlock: (blockId: string) => void;
  onUpdateBlock: (blockId: string, updates: Partial<PdfBlock>) => void;
  onStartEdit: (blockId: string) => void;
  onEndEdit: (blockId: string, text: string) => void;
  onDeleteBlock?: (blockId: string) => void;
  onContextMenu?: (e: React.MouseEvent, blockId: string) => void;
}

export function PageCanvas({
  page,
  theme,
  selectedBlockId,
  editingBlockId,
  onSelectBlock,
  onUpdateBlock,
  onStartEdit,
  onEndEdit,
  onDeleteBlock,
  onContextMenu,
}: PageCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [isResizing, setIsResizing] = useState(false);

  const format = PAGE_FORMATS[page.format];
  const width = page.orientation === 'landscape' ? format.height : format.width;
  const height = page.orientation === 'landscape' ? format.width : format.height;

  // Масштабируем для отображения (1 мм = 3.779527559 пикселей при 96 DPI)
  const displayWidth = width * 3.779527559;
  const displayHeight = height * 3.779527559;

  useEffect(() => {
    // Автоматически подбираем масштаб для отображения
    if (canvasRef.current) {
      const container = canvasRef.current.parentElement;
      if (container) {
        const containerWidth = container.clientWidth - 40;
        const containerHeight = container.clientHeight - 40;
        const scaleX = containerWidth / displayWidth;
        const scaleY = containerHeight / displayHeight;
        setScale(Math.min(scaleX, scaleY, 1) * 0.9); // 90% от доступного пространства
      }
    }
  }, [displayWidth, displayHeight]);

  const handleResize = (blockId: string, newWidth: number, newHeight: number) => {
    // Конвертируем из пикселей обратно в мм или проценты
    const format = PAGE_FORMATS[page.format];
    const displayWidth = (page.orientation === 'landscape' ? format.height : format.width) * 3.779527559;
    const displayHeight = (page.orientation === 'landscape' ? format.width : format.height) * 3.779527559;
    
    const block = page.blocks.find(b => b.id === blockId);
    if (!block) return;

    const newWidthMm = block.position.unit === 'mm'
      ? newWidth / 3.779527559
      : (newWidth / displayWidth) * 100;
    const newHeightMm = block.position.unit === 'mm'
      ? newHeight / 3.779527559
      : (newHeight / displayHeight) * 100;

    onUpdateBlock(blockId, {
      position: {
        ...block.position,
        width: newWidthMm,
        height: newHeightMm,
      },
    });
  };

  const renderBlock = (block: PdfBlock) => {
    const isSelected = block.id === selectedBlockId;
    const isEditing = block.id === editingBlockId;
    const x = block.position.unit === 'percent' 
      ? (block.position.x / 100) * displayWidth 
      : block.position.x * 3.779527559;
    const y = block.position.unit === 'percent' 
      ? (block.position.y / 100) * displayHeight 
      : block.position.y * 3.779527559;
    const w = block.position.unit === 'percent' 
      ? (block.position.width / 100) * displayWidth 
      : block.position.width * 3.779527559;
    const h = block.position.unit === 'percent' 
      ? (block.position.height / 100) * displayHeight 
      : block.position.height * 3.779527559;

    // Определяем, является ли блок текстовым
    const isTextBlock = ['heading-h1', 'heading-h2', 'heading-h3', 'paragraph'].includes(block.type);

    return (
      <DraggableBlock
        key={block.id}
        block={block}
        pageFormat={page.format}
        theme={theme}
        scale={scale}
        isSelected={isSelected}
        onSelect={onSelectBlock}
        onUpdate={(blockId, updates) => onUpdateBlock(blockId, updates)}
        onDelete={onDeleteBlock || (() => {})}
        onContextMenu={onContextMenu}
        renderContent={(block, width, height) => {
          if (isTextBlock && isEditing) {
            return (
              <EditableTextBlock
                block={block}
                theme={theme}
                scale={scale}
                width={width}
                height={height}
                isEditing={true}
                onStartEdit={() => onStartEdit(block.id)}
                onEndEdit={(text) => onEndEdit(block.id, text)}
              />
            );
          }

          if (isTextBlock) {
            return (
              <EditableTextBlock
                block={block}
                theme={theme}
                scale={scale}
                width={width}
                height={height}
                isEditing={false}
                onStartEdit={() => onStartEdit(block.id)}
                onEndEdit={(text) => onEndEdit(block.id, text)}
              />
            );
          }

          return renderBlockContent(block, width, height);
        }}
      />
    );
  };

  const renderBlockContent = (block: PdfBlock, width: number, height: number) => {
    const fontSize = (block.styles.fontSize || theme.typography.bodySize) * scale;
    const color = block.styles.color || theme.colors.text;

    switch (block.type) {
      case 'heading-h1':
      case 'heading-h2':
      case 'heading-h3':
      case 'paragraph':
        return (
          <Text
            style={{
              fontSize: Math.max(fontSize, 10),
              color,
              fontWeight: block.styles.fontWeight || 'normal',
            }}
            numberOfLines={Math.floor(height / (fontSize * 1.5))}
          >
            {typeof block.content === 'string' ? block.content : ''}
          </Text>
        );

      case 'image':
      case 'image-with-caption':
        const imageConfig = typeof block.content === 'object' && 'url' in block.content 
          ? block.content as any 
          : null;
        return (
          <div style={{ width: '100%', height: '100%', backgroundColor: '#f0f0f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            {imageConfig?.url ? (
              <>
                <img 
                  src={imageConfig.url} 
                  alt={imageConfig.alt || ''} 
                  style={{ 
                    maxWidth: '100%', 
                    maxHeight: imageConfig.caption ? 'calc(100% - 30px)' : '100%', 
                    objectFit: imageConfig.fit || 'contain' 
                  }} 
                />
                {imageConfig.caption && (
                  <div style={{ 
                    width: '100%', 
                    padding: '4px 8px', 
                    fontSize: 10 * scale, 
                    color: '#666', 
                    textAlign: 'center',
                    backgroundColor: '#f9f9f9'
                  }}>
                    <Text style={{ fontSize: 10 * scale, color: '#666' }}>{imageConfig.caption}</Text>
                  </div>
                )}
              </>
            ) : (
              <Text style={{ fontSize: 12 * scale, color: '#999' }}>Изображение</Text>
            )}
          </div>
        );

      case 'tip-block':
        return <TipBlock block={block} theme={theme} scale={scale} />;

      case 'important-block':
        return <ImportantBlock block={block} theme={theme} scale={scale} />;

      case 'warning-block':
        return <WarningBlock block={block} theme={theme} scale={scale} />;

      case 'quote':
        return <QuoteBlock block={block} theme={theme} scale={scale} />;

      case 'checklist':
        return <ChecklistBlock block={block} theme={theme} scale={scale} />;

      case 'table':
        return <TableBlock block={block} theme={theme} scale={scale} />;

      case 'image-gallery':
        return <ImageGalleryBlock block={block} theme={theme} scale={scale} />;

      case 'map':
        return <MapBlock block={block} theme={theme} scale={scale} />;

      case 'spacer':
        return <div style={{ width: '100%', height: '100%', backgroundColor: '#f9f9f9' }} />;

      case 'divider':
        return (
          <div style={{ width: '100%', height: '2px', backgroundColor: theme.colors.border || '#e5e7eb', marginTop: height / 2 - 1 }} />
        );

      case 'cover':
      case 'toc':
      case 'author-block':
      case 'recommendations-block':
      case 'background-block':
        // Специальные блоки - рендерим как контейнеры с контентом
        return (
          <div style={{ 
            width: '100%', 
            height: '100%', 
            backgroundColor: block.styles.backgroundColor || theme.colors.background,
            padding: 16 * scale,
            boxSizing: 'border-box',
          }}>
            <Text style={{ fontSize: Math.max(fontSize, 10), color }}>
              {typeof block.content === 'string' ? block.content : block.type}
            </Text>
          </div>
        );

      default:
        return (
          <Text style={{ fontSize: Math.max(fontSize, 10), color }}>
            {block.type}
          </Text>
        );
    }
  };

  return (
    <div
      ref={canvasRef}
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        height: '100%',
        overflow: 'auto',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: displayWidth * scale,
          height: displayHeight * scale,
          backgroundColor: page.background?.color || theme.colors.background,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          margin: 'auto',
        }}
      >
        {/* Фоновое изображение */}
        {page.background?.image && (
          <img
            src={page.background.image}
            alt=""
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: 0.3,
            }}
          />
        )}

        {/* Блоки */}
        {page.blocks.map((block) => renderBlock(block))}

        {/* Маркеры изменения размера для выбранного блока */}
        {selectedBlockId && !isResizing && (() => {
          const selectedBlock = page.blocks.find(b => b.id === selectedBlockId);
          if (!selectedBlock) return null;

          const x = selectedBlock.position.unit === 'percent' 
            ? (selectedBlock.position.x / 100) * displayWidth 
            : selectedBlock.position.x * 3.779527559;
          const y = selectedBlock.position.unit === 'percent' 
            ? (selectedBlock.position.y / 100) * displayHeight 
            : selectedBlock.position.y * 3.779527559;
          const w = selectedBlock.position.unit === 'percent' 
            ? (selectedBlock.position.width / 100) * displayWidth 
            : selectedBlock.position.width * 3.779527559;
          const h = selectedBlock.position.unit === 'percent' 
            ? (selectedBlock.position.height / 100) * displayHeight 
            : selectedBlock.position.height * 3.779527559;

          return (
            <div
              style={{
                position: 'absolute',
                left: x * scale,
                top: y * scale,
                width: w * scale,
                height: h * scale,
                pointerEvents: 'none',
              }}
            >
              <ResizeHandles
                blockWidth={w * scale}
                blockHeight={h * scale}
                scale={scale}
                onResize={(newWidth, newHeight) => {
                  handleResize(selectedBlockId, newWidth, newHeight);
                }}
                onResizeStart={() => setIsResizing(true)}
                onResizeEnd={() => setIsResizing(false)}
              />
            </div>
          );
        })()}
      </div>
    </div>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

