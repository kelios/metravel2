// components/export/constructor/Tooltip.tsx
// ✅ АРХИТЕКТУРА: Компонент подсказки

import React, { useState } from 'react';

interface TooltipProps {
  text: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

export function Tooltip({ text, children, position = 'top', delay = 500 }: TooltipProps) {
  const [show, setShow] = useState(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    const id = setTimeout(() => {
      setShow(true);
    }, delay);
    setTimeoutId(id);
  };

  const handleMouseLeave = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    setShow(false);
  };

  const getPositionStyles = (): React.CSSProperties => {
    const baseStyles: React.CSSProperties = {
      position: 'absolute',
      backgroundColor: '#333',
      color: '#fff',
      padding: '6px 10px',
      borderRadius: 4,
      fontSize: 12,
      whiteSpace: 'nowrap',
      zIndex: 10000,
      pointerEvents: 'none',
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    };

    switch (position) {
      case 'top':
        return {
          ...baseStyles,
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: 8,
        } as React.CSSProperties;
      case 'bottom':
        return {
          ...baseStyles,
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginTop: 8,
        } as React.CSSProperties;
      case 'left':
        return {
          ...baseStyles,
          right: '100%',
          top: '50%',
          transform: 'translateY(-50%)',
          marginRight: 8,
        } as React.CSSProperties;
      case 'right':
        return {
          ...baseStyles,
          left: '100%',
          top: '50%',
          transform: 'translateY(-50%)',
          marginLeft: 8,
        } as React.CSSProperties;
      default:
        return baseStyles;
    }
  };

  return (
    <div
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {show && (
        <div style={getPositionStyles()}>
          {text}
          <div
            style={(() => {
              const arrowStyle: React.CSSProperties = {
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)',
                width: 0,
                height: 0,
                borderLeft: '4px solid transparent',
                borderRight: '4px solid transparent',
              };
              
              if (position === 'top') {
                arrowStyle.bottom = -4;
                arrowStyle.borderTop = '4px solid #333';
              } else {
                arrowStyle.top = -4;
                arrowStyle.borderBottom = '4px solid #333';
              }
              
              return arrowStyle;
            })()}
          />
        </div>
      )}
    </div>
  );
}

