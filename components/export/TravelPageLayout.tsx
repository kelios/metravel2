// components/export/TravelPageLayout.tsx
// ✅ УЛУЧШЕНИЕ: Разворот путешествия - фото на левой странице, текст на правой

import React from 'react';
import QRCode from 'qrcode';
import { sanitizeRichTextForPdf } from '@/src/utils/sanitizeRichText';

interface Travel {
  id: number | string;
  name: string;
  slug?: string;
  url?: string;
  description?: string | null;
  recommendation?: string | null;
  plus?: string | null;
  minus?: string | null;
  countryName?: string;
  cityName?: string;
  year?: string | number;
  monthName?: string;
  number_days?: number;
  travel_image_thumb_url?: string;
  travel_image_url?: string;
  gallery?: Array<{ url: string; id?: number | string }>;
  userName?: string;
}

interface TravelPageLayoutProps {
  travel: Travel;
  pageNumber: number;
  qrCode?: string;
}

export default function TravelPageLayout({
  travel,
  pageNumber,
  qrCode,
}: TravelPageLayoutProps) {
  const coverImage = travel.travel_image_url || travel.travel_image_thumb_url || travel.gallery?.[0]?.url;
  const url = travel.slug ? `https://metravel.by/travels/${travel.slug}` : travel.url || '';

  return (
    <>
      {/* Левая страница - Фото */}
      <section
        className="pdf-page travel-photo-page"
        style={{
          width: '210mm',
          minHeight: '297mm',
          padding: '20mm',
          margin: 0,
          backgroundColor: '#fff',
          pageBreakAfter: 'always',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {coverImage ? (
          <>
            {/* Большое фото */}
            <div
              style={{
                flex: 1,
                position: 'relative',
                borderRadius: '12mm',
                overflow: 'hidden',
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                marginBottom: '12mm',
              }}
            >
              <img
                src={coverImage}
                alt={travel.name}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
                crossOrigin="anonymous"
              />
              {/* Overlay для текста */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)',
                  padding: '15mm',
                }}
              >
                <h1
                  style={{
                    fontSize: '28pt',
                    fontWeight: 800,
                    color: '#fff',
                    margin: 0,
                    lineHeight: 1.2,
                    textShadow: '0 2px 10px rgba(0,0,0,0.5)',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {travel.name}
                </h1>
              </div>
            </div>

            {/* Мета-информация */}
            <div
              style={{
                display: 'flex',
                gap: '8mm',
                alignItems: 'center',
                padding: '8mm',
                backgroundColor: '#f9fafb',
                borderRadius: '8mm',
              }}
            >
              {travel.countryName && (
                <div style={{ fontSize: '14pt', fontWeight: 600, color: '#1f2937' }}>
                  📍 {travel.countryName}
                </div>
              )}
              {travel.year && (
                <div style={{ fontSize: '14pt', fontWeight: 600, color: '#1f2937' }}>
                  📅 {travel.year}
                  {travel.monthName && ` • ${travel.monthName}`}
                </div>
              )}
              {travel.number_days && (
                <div style={{ fontSize: '14pt', fontWeight: 600, color: '#1f2937' }}>
                  ⏱️ {travel.number_days} {travel.number_days === 1 ? 'день' : travel.number_days < 5 ? 'дня' : 'дней'}
                </div>
              )}
            </div>
          </>
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'linear-gradient(135deg, #ff9f5a 0%, #ff6b35 100%)',
              background: 'linear-gradient(135deg, #ff9f5a 0%, #ff6b35 100%)',
              borderRadius: '12mm',
              padding: '20mm',
              color: '#fff',
            }}
          >
            <div style={{ fontSize: '64pt', marginBottom: '10mm' }}>🗺️</div>
            <h1
              style={{
                fontSize: '24pt',
                fontWeight: 800,
                margin: 0,
                textAlign: 'center',
                lineHeight: 1.3,
              }}
            >
              {travel.name}
            </h1>
          </div>
        )}

        {/* Номер страницы */}
        <div
          style={{
            position: 'absolute',
            bottom: '15mm',
            right: '20mm',
            fontSize: '12pt',
            color: '#9ca3af',
            fontWeight: 500,
          }}
        >
          {pageNumber}
        </div>
      </section>

      {/* Правая страница - Текст */}
      <section
        className="pdf-page travel-text-page"
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
          .pdf-text-content {
            white-space: normal !important;
            word-wrap: break-word;
            letter-spacing: normal !important;
            word-spacing: normal !important;
            text-rendering: optimizeLegibility;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .pdf-text-content p {
            margin: 0 !important;
            padding: 0 !important;
            white-space: normal !important;
            letter-spacing: normal !important;
            word-spacing: normal !important;
            display: block;
            line-height: inherit;
            page-break-inside: avoid !important;
            page-break-after: auto !important;
            page-break-before: auto !important;
            break-inside: avoid !important;
            break-after: auto !important;
            break-before: auto !important;
          }
          .pdf-text-content p + p {
            margin-top: 0 !important;
          }
          .pdf-text-content * {
            white-space: normal !important;
            letter-spacing: normal !important;
            word-spacing: normal !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .pdf-text-content br {
            line-height: inherit;
          }
          .pdf-text-content div,
          .pdf-text-content span {
            display: inline;
          }
        `}</style>
        {/* Описание */}
        {travel.description && (
          <div style={{ marginBottom: '12mm' }}>
            <h2
              style={{
                fontSize: '18pt',
                fontWeight: 700,
                color: '#ff9f5a',
                marginBottom: '6mm',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                borderLeft: '4px solid #ff9f5a',
                paddingLeft: '6mm',
              }}
            >
              Описание
            </h2>
            <div
              dangerouslySetInnerHTML={{ __html: sanitizeRichTextForPdf(travel.description) }}
              style={{
                fontSize: '11pt',
                lineHeight: 1.7,
                color: '#374151',
                textAlign: 'justify',
                whiteSpace: 'normal',
                letterSpacing: 'normal',
                wordSpacing: 'normal',
              }}
              className="pdf-text-content"
            />
          </div>
        )}

        {/* Рекомендации */}
        {travel.recommendation && (
          <div style={{ marginBottom: '12mm' }}>
            <h2
              style={{
                fontSize: '18pt',
                fontWeight: 700,
                color: '#ff9f5a',
                marginBottom: '6mm',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                borderLeft: '4px solid #ff9f5a',
                paddingLeft: '6mm',
              }}
            >
              Рекомендации
            </h2>
            <div
              dangerouslySetInnerHTML={{ __html: sanitizeRichTextForPdf(travel.recommendation) }}
              style={{
                fontSize: '11pt',
                lineHeight: 1.7,
                color: '#374151',
                textAlign: 'justify',
                whiteSpace: 'normal',
                letterSpacing: 'normal',
                wordSpacing: 'normal',
              }}
              className="pdf-text-content"
            />
          </div>
        )}

        {/* Плюсы и минусы */}
        {(travel.plus || travel.minus) && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10mm',
              marginBottom: '12mm',
            }}
          >
            {travel.plus && (
              <div
                style={{
                  backgroundColor: '#f0fdf4',
                  padding: '8mm',
                  borderRadius: '8mm',
                  border: '2px solid #86efac',
                }}
              >
                <h3
                  style={{
                    fontSize: '14pt',
                    fontWeight: 700,
                    color: '#16a34a',
                    marginTop: 0,
                    marginBottom: '4mm',
                  }}
                >
                  ✅ Плюсы
                </h3>
                <div
                  dangerouslySetInnerHTML={{ __html: sanitizeRichTextForPdf(travel.plus) }}
                  style={{
                    fontSize: '10pt',
                    lineHeight: 1.6,
                    color: '#374151',
                    whiteSpace: 'normal',
                    letterSpacing: 'normal',
                    wordSpacing: 'normal',
                  }}
                  className="pdf-text-content"
                />
              </div>
            )}

            {travel.minus && (
              <div
                style={{
                  backgroundColor: '#fef2f2',
                  padding: '8mm',
                  borderRadius: '8mm',
                  border: '2px solid #fca5a5',
                }}
              >
                <h3
                  style={{
                    fontSize: '14pt',
                    fontWeight: 700,
                    color: '#dc2626',
                    marginTop: 0,
                    marginBottom: '4mm',
                  }}
                >
                  ⚠️ Минусы
                </h3>
                <div
                  dangerouslySetInnerHTML={{ __html: sanitizeRichTextForPdf(travel.minus) }}
                  style={{
                    fontSize: '10pt',
                    lineHeight: 1.6,
                    color: '#374151',
                    whiteSpace: 'normal',
                    letterSpacing: 'normal',
                    wordSpacing: 'normal',
                  }}
                  className="pdf-text-content"
                />
              </div>
            )}
          </div>
        )}

        {/* QR-код и ссылка */}
        {url && (
          <div
            style={{
              marginTop: 'auto',
              paddingTop: '15mm',
              display: 'flex',
              alignItems: 'center',
              gap: '10mm',
              justifyContent: 'center',
              borderTop: '2px solid #e5e7eb',
            }}
          >
            {qrCode && (
              <div style={{ textAlign: 'center' }}>
                <img
                  src={qrCode}
                  alt="QR Code"
                  style={{
                    width: '50mm',
                    height: '50mm',
                    border: '4px solid #f3f4f6',
                    borderRadius: '4mm',
                    padding: '2mm',
                  }}
                />
              </div>
            )}
            <div style={{ flex: 1, fontSize: '9pt', color: '#6b7280', textAlign: 'center' }}>
              <div style={{ marginBottom: '2mm', fontWeight: 600 }}>Онлайн-версия:</div>
              <div style={{ wordBreak: 'break-all' }}>{url}</div>
            </div>
          </div>
        )}

        {/* Номер страницы */}
        <div
          style={{
            position: 'absolute',
            bottom: '15mm',
            right: '30mm',
            fontSize: '12pt',
            color: '#9ca3af',
            fontWeight: 500,
          }}
        >
          {pageNumber + 1}
        </div>
      </section>
    </>
  );
}

