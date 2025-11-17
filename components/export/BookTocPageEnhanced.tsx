// components/export/BookTocPageEnhanced.tsx
// ✅ УЛУЧШЕНИЕ: Красивое оглавление с миниатюрами и декоративными элементами

import React from 'react';

interface Travel {
  id: number | string;
  name: string;
  countryName?: string;
  year?: string | number;
  travel_image_thumb_url?: string;
  travel_image_thumb_small_url?: string;
}

interface BookTocPageEnhancedProps {
  travels: Travel[];
  startPageNumber?: number;
}

export default function BookTocPageEnhanced({
  travels,
  startPageNumber = 3,
}: BookTocPageEnhancedProps) {
  // Каждое путешествие занимает примерно 2 страницы (разворот)
  const calculatePageNumber = (index: number) => {
    return startPageNumber + index * 2;
  };

  return (
    <section
      className="pdf-page toc-page-enhanced"
      style={{
        width: '210mm',
        minHeight: '297mm',
        padding: '25mm 30mm',
        margin: 0,
        backgroundColor: '#fff',
        pageBreakAfter: 'always',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <style>{`
        .toc-page-enhanced {
          background: linear-gradient(to bottom, #f9fafb 0%, #ffffff 100%);
        }
      `}</style>

      {/* Заголовок */}
      <div
        style={{
          textAlign: 'center',
          marginBottom: '25mm',
          paddingBottom: '15mm',
          borderBottom: '3px solid #ff9f5a',
        }}
      >
        <h2
          style={{
            fontSize: '36pt',
            fontWeight: 800,
            margin: '0 0 8mm 0',
            color: '#1f2937',
            letterSpacing: '-0.02em',
          }}
        >
          Содержание
        </h2>
        <div
          style={{
            fontSize: '14pt',
            color: '#6b7280',
            fontWeight: 400,
          }}
        >
          {travels.length} {travels.length === 1 ? 'путешествие' : travels.length < 5 ? 'путешествия' : 'путешествий'}
        </div>
      </div>

      {/* Список путешествий */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '8mm',
        }}
      >
        {travels.map((travel, index) => {
          const pageNumber = calculatePageNumber(index);
          const thumbnail = travel.travel_image_thumb_small_url || travel.travel_image_thumb_url;

          return (
            <div
              key={travel.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12mm',
                padding: '6mm',
                backgroundColor: '#fff',
                borderRadius: '8mm',
                border: '1px solid #e5e7eb',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                transition: 'all 0.2s',
                breakInside: 'avoid',
              }}
            >
              {/* Миниатюра */}
              {thumbnail ? (
                <div
                  style={{
                    width: '40mm',
                    height: '40mm',
                    borderRadius: '6mm',
                    overflow: 'hidden',
                    flexShrink: 0,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  }}
                >
                  <img
                    src={thumbnail}
                    alt={travel.name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                    crossOrigin="anonymous"
                  />
                </div>
              ) : (
                <div
                  style={{
                    width: '40mm',
                    height: '40mm',
                    borderRadius: '6mm',
                    backgroundColor: '#f3f4f6',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#9ca3af',
                    fontSize: '20pt',
                  }}
                >
                  🗺️
                </div>
              )}

              {/* Информация */}
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    fontSize: '16pt',
                    fontWeight: 700,
                    color: '#1f2937',
                    marginBottom: '3mm',
                    lineHeight: 1.3,
                  }}
                >
                  {index + 1}. {travel.name}
                </div>
                <div
                  style={{
                    fontSize: '12pt',
                    color: '#6b7280',
                    display: 'flex',
                    gap: '8mm',
                    alignItems: 'center',
                  }}
                >
                  {travel.countryName && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '2mm' }}>
                      <span>📍</span>
                      {travel.countryName}
                    </span>
                  )}
                  {travel.year && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '2mm' }}>
                      <span>📅</span>
                      {travel.year}
                    </span>
                  )}
                </div>
              </div>

              {/* Номер страницы */}
              <div
                style={{
                  fontSize: '18pt',
                  fontWeight: 700,
                  color: '#ff9f5a',
                  minWidth: '15mm',
                  textAlign: 'right',
                }}
              >
                {pageNumber}
              </div>
            </div>
          );
        })}
      </div>

      {/* Декоративный элемент внизу */}
      <div
        style={{
          marginTop: 'auto',
          paddingTop: '15mm',
          textAlign: 'center',
          fontSize: '10pt',
          color: '#9ca3af',
          fontStyle: 'italic',
        }}
      >
        Переверните страницу, чтобы начать путешествие
      </div>
    </section>
  );
}

