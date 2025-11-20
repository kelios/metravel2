// components/export/constructor/DraggableBlock.tsx
// ✅ АРХИТЕКТУРА: Компонент блока с поддержкой Drag & Drop

import React, { useState, useRef, useEffect } from 'react';
import type { PdfBlock, PdfTheme } from '@/src/types/pdf-constructor';
import { PAGE_FORMATS } from '@/src/types/pdf-constructor';

interface DraggableBlockProps {
  block: PdfBlock;
  pageFormat: 'A4' | 'A5' | 'A6' | 'Letter';
  theme: PdfTheme;
  scale: number;
  isSelected: boolean;
  onSelect: (blockId: string) => void;
  onUpdate: (blockId: string, updates: Partial<PdfBlock>) => void;
  onDelete: (blockId: string) => void;
  onContextMenu?: (e: React.MouseEvent, blockId: string) => void;
  renderContent: (block: PdfBlock, width: number, height: number) => React.ReactNode;
}

export function DraggableBlock({
  block,
  pageFormat,
  theme,
  scale,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  onContextMenu,
  renderContent,
}: DraggableBlockProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const blockRef = useRef<HTMLDivElement>(null);

  const format = PAGE_FORMATS[pageFormat];
  const displayWidth = format.width * 3.779527559;
  const displayHeight = format.height * 3.779527559;

  // Вычисляем позицию и размеры блока
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

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Только левая кнопка мыши
    
    e.stopPropagation();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - x * scale,
      y: e.clientY - y * scale,
    });
    setDragOffset({ x: 0, y: 0 });
    onSelect(block.id);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = (e.clientX - dragStart.x) / scale;
      const newY = (e.clientY - dragStart.y) / scale;
      
      // Ограничиваем границами страницы
      const minX = 0;
      const minY = 0;
      const maxX = displayWidth - w;
      const maxY = displayHeight - h;
      
      const clampedX = Math.max(minX, Math.min(maxX, newX));
      const clampedY = Math.max(minY, Math.min(maxY, newY));
      
      setDragOffset({
        x: clampedX - x,
        y: clampedY - y,
      });
    };

    const handleMouseUp = () => {
      if (dragOffset.x !== 0 || dragOffset.y !== 0) {
        // Обновляем позицию блока
        const newX = block.position.unit === 'mm' 
          ? (x + dragOffset.x) / 3.779527559
          : ((x + dragOffset.x) / displayWidth) * 100;
        const newY = block.position.unit === 'mm'
          ? (y + dragOffset.y) / 3.779527559
          : ((y + dragOffset.y) / displayHeight) * 100;

        onUpdate(block.id, {
          position: {
            ...block.position,
            x: newX,
            y: newY,
          },
        });
      }

      setIsDragging(false);
      setDragOffset({ x: 0, y: 0 });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart, dragOffset, x, y, scale, block, onUpdate, displayWidth, displayHeight]);

  const currentX = (x + dragOffset.x) * scale;
  const currentY = (y + dragOffset.y) * scale;
  const currentW = w * scale;
  const currentH = h * scale;

  return (
    <div
      ref={blockRef}
      onMouseDown={handleMouseDown}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(block.id);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (onContextMenu) {
          onContextMenu(e, block.id);
        }
      }}
      style={{
        position: 'absolute',
        left: currentX,
        top: currentY,
        width: currentW,
        height: currentH,
        border: isSelected ? '2px solid #ff9f5a' : isDragging ? '2px dashed #ff9f5a' : '1px dashed #ccc',
        backgroundColor: block.styles.backgroundColor || 'transparent',
        cursor: isDragging ? 'grabbing' : 'grab',
        padding: 4,
        overflow: 'hidden',
        boxSizing: 'border-box',
        opacity: isDragging ? 0.7 : 1,
        zIndex: isDragging ? 1000 : isSelected ? 100 : 1,
        transition: isDragging ? 'none' : 'opacity 0.2s',
      }}
    >
      {renderContent(block, currentW, currentH)}
    </div>
  );
}

