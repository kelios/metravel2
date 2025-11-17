// components/export/BookCoverPageEnhanced.tsx
// ✅ УЛУЧШЕНИЕ: Красивая обложка фотоальбома с градиентами и декоративными элементами

import React from 'react';

interface BookCoverPageProps {
  title: string;
  subtitle?: string;
  userName?: string;
  travelCount: number;
  coverImage?: string;
  yearRange?: string;
}

export default function BookCoverPageEnhanced({
  title,
  subtitle,
  userName,
  travelCount,
  coverImage,
  yearRange,
}: BookCoverPageProps) {
  const hasImage = !!coverImage;

  return (
    <section
      className="pdf-page cover-page-enhanced"
      style={{
        width: '210mm',
        height: '297mm',
        padding: 0,
        margin: 0,
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#1f2937',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        alignItems: 'center',
        textAlign: 'center',
        color: '#fff',
        pageBreakAfter: 'always',
      }}
    >
      <style>{`
        .cover-page-enhanced {
          background: ${hasImage 
            ? `linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.7) 100%), url(${coverImage})`
            : 'linear-gradient(135deg, #ff9f5a 0%, #ff6b35 50%, #ff8c42 100%)'
          };
          background-size: cover;
          background-position: center;
        }
      `}</style>

      {/* Декоративные элементы */}
      <div
        style={{
          position: 'absolute',
          top: '20mm',
          left: '20mm',
          width: '60mm',
          height: '60mm',
          border: '2px solid rgba(255,255,255,0.2)',
          borderRadius: '50%',
          opacity: 0.3,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '30mm',
          right: '30mm',
          width: '40mm',
          height: '40mm',
          border: '2px solid rgba(255,255,255,0.15)',
          borderRadius: '50%',
          opacity: 0.2,
        }}
      />

      {/* Основной контент */}
      <div
        style={{
          padding: '40mm 30mm',
          width: '100%',
          position: 'relative',
          zIndex: 2,
        }}
      >
        {/* Подзаголовок (если есть) */}
        {subtitle && (
          <div
            style={{
              fontSize: '14pt',
              fontWeight: 500,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              marginBottom: '15mm',
              opacity: 0.9,
              color: '#ffd28f',
            }}
          >
            {subtitle}
          </div>
        )}

        {/* Главный заголовок */}
        <h1
          style={{
            fontSize: '48pt',
            fontWeight: 800,
            margin: '0 0 20mm 0',
            lineHeight: 1.2,
            textShadow: '0 4px 20px rgba(0,0,0,0.5)',
            letterSpacing: '-0.02em',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          {title}
        </h1>

        {/* Декоративная линия */}
        <div
          style={{
            width: '80mm',
            height: '3px',
            backgroundColor: '#ff9f5a',
            margin: '0 auto 20mm',
            borderRadius: '2px',
            boxShadow: '0 2px 10px rgba(255,159,90,0.5)',
          }}
        />

        {/* Информация об авторе */}
        {userName && (
          <div
            style={{
              fontSize: '18pt',
              fontWeight: 400,
              marginBottom: '15mm',
              opacity: 0.95,
              fontStyle: 'italic',
            }}
          >
            {userName}
          </div>
        )}

        {/* Статистика */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '20mm',
            marginTop: '30mm',
            fontSize: '16pt',
            fontWeight: 600,
          }}
        >
          <div>
            <div style={{ fontSize: '32pt', fontWeight: 800, color: '#ff9f5a', marginBottom: '3mm' }}>
              {travelCount}
            </div>
            <div style={{ fontSize: '12pt', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {travelCount === 1 ? 'путешествие' : travelCount < 5 ? 'путешествия' : 'путешествий'}
            </div>
          </div>
          {yearRange && (
            <div style={{ borderLeft: '1px solid rgba(255,255,255,0.3)', paddingLeft: '20mm' }}>
              <div style={{ fontSize: '32pt', fontWeight: 800, color: '#ff9f5a', marginBottom: '3mm' }}>
                {yearRange}
              </div>
              <div style={{ fontSize: '12pt', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                годы
              </div>
            </div>
          )}
        </div>

        {/* Дата создания */}
        <div
          style={{
            marginTop: 'auto',
            paddingTop: '20mm',
            fontSize: '11pt',
            opacity: 0.7,
            fontStyle: 'italic',
          }}
        >
          Создано {new Date().toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </div>
      </div>

      {/* Логотип в углу (опционально) */}
      <div
        style={{
          position: 'absolute',
          bottom: '15mm',
          right: '20mm',
          fontSize: '10pt',
          opacity: 0.6,
          fontWeight: 500,
        }}
      >
        MeTravel
      </div>
    </section>
  );
}

