// components/export/constructor/ResizeHandles.tsx
// ✅ АРХИТЕКТУРА: Маркеры для изменения размера блока

import React, { useState, useEffect } from 'react';

interface ResizeHandlesProps {
  blockWidth: number;
  blockHeight: number;
  scale: number;
  onResize: (newWidth: number, newHeight: number, handle: string) => void;
  onResizeStart: () => void;
  onResizeEnd: () => void;
}

export function ResizeHandles({
  blockWidth,
  blockHeight,
  scale,
  onResize,
  onResizeStart,
  onResizeEnd,
}: ResizeHandlesProps) {
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [startSize, setStartSize] = useState({ width: 0, height: 0 });

  const handleSize = 8;
  const handleOffset = -4;

  const handles = [
    { position: 'nw', x: handleOffset, y: handleOffset, cursor: 'nw-resize' },
    { position: 'n', x: blockWidth / 2 + handleOffset, y: handleOffset, cursor: 'n-resize' },
    { position: 'ne', x: blockWidth + handleOffset, y: handleOffset, cursor: 'ne-resize' },
    { position: 'e', x: blockWidth + handleOffset, y: blockHeight / 2 + handleOffset, cursor: 'e-resize' },
    { position: 'se', x: blockWidth + handleOffset, y: blockHeight + handleOffset, cursor: 'se-resize' },
    { position: 's', x: blockWidth / 2 + handleOffset, y: blockHeight + handleOffset, cursor: 's-resize' },
    { position: 'sw', x: handleOffset, y: blockHeight + handleOffset, cursor: 'sw-resize' },
    { position: 'w', x: handleOffset, y: blockHeight / 2 + handleOffset, cursor: 'w-resize' },
  ];

  const handleMouseDown = (e: React.MouseEvent, handle: string) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeHandle(handle);
    setStartPos({ x: e.clientX, y: e.clientY });
    setStartSize({ width: blockWidth, height: blockHeight });
    onResizeStart();
  };

  useEffect(() => {
    if (!isResizing || !resizeHandle) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = (e.clientX - startPos.x) / scale;
      const deltaY = (e.clientY - startPos.y) / scale;

      let newWidth = startSize.width;
      let newHeight = startSize.height;

      // Сохраняем пропорции при зажатом Shift
      if (e.shiftKey) {
        const aspectRatio = startSize.width / startSize.height;
        
        // Вычисляем изменение размера в зависимости от маркера
        switch (resizeHandle) {
          case 'nw':
          case 'se':
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
              newWidth = Math.max(20, startSize.width + (resizeHandle === 'nw' ? -deltaX : deltaX));
              newHeight = newWidth / aspectRatio;
            } else {
              newHeight = Math.max(20, startSize.height + (resizeHandle === 'nw' ? -deltaY : deltaY));
              newWidth = newHeight * aspectRatio;
            }
            break;
          case 'ne':
          case 'sw':
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
              newWidth = Math.max(20, startSize.width + (resizeHandle === 'ne' ? deltaX : -deltaX));
              newHeight = newWidth / aspectRatio;
            } else {
              newHeight = Math.max(20, startSize.height + (resizeHandle === 'ne' ? -deltaY : deltaY));
              newWidth = newHeight * aspectRatio;
            }
            break;
          case 'n':
          case 's':
            newHeight = Math.max(20, startSize.height + (resizeHandle === 'n' ? -deltaY : deltaY));
            newWidth = newHeight * aspectRatio;
            break;
          case 'e':
          case 'w':
            newWidth = Math.max(20, startSize.width + (resizeHandle === 'e' ? deltaX : -deltaX));
            newHeight = newWidth / aspectRatio;
            break;
        }
      } else {
        // Обычное изменение размера без сохранения пропорций
        switch (resizeHandle) {
          case 'nw':
            newWidth = Math.max(20, startSize.width - deltaX);
            newHeight = Math.max(20, startSize.height - deltaY);
            break;
          case 'n':
            newHeight = Math.max(20, startSize.height - deltaY);
            break;
          case 'ne':
            newWidth = Math.max(20, startSize.width + deltaX);
            newHeight = Math.max(20, startSize.height - deltaY);
            break;
          case 'e':
            newWidth = Math.max(20, startSize.width + deltaX);
            break;
          case 'se':
            newWidth = Math.max(20, startSize.width + deltaX);
            newHeight = Math.max(20, startSize.height + deltaY);
            break;
          case 's':
            newHeight = Math.max(20, startSize.height + deltaY);
            break;
          case 'sw':
            newWidth = Math.max(20, startSize.width - deltaX);
            newHeight = Math.max(20, startSize.height + deltaY);
            break;
          case 'w':
            newWidth = Math.max(20, startSize.width - deltaX);
            break;
        }
      }

      onResize(newWidth, newHeight, resizeHandle);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setResizeHandle(null);
      onResizeEnd();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, resizeHandle, startPos, startSize, scale, onResize, onResizeEnd]);

  return (
    <>
      {handles.map((handle) => (
        <div
          key={handle.position}
          onMouseDown={(e) => handleMouseDown(e, handle.position)}
          style={{
            position: 'absolute',
            left: handle.x,
            top: handle.y,
            width: handleSize,
            height: handleSize,
            backgroundColor: '#ff9f5a',
            border: '1px solid #fff',
            borderRadius: '2px',
            cursor: handle.cursor,
            zIndex: 1001,
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          }}
        />
      ))}
    </>
  );
}

