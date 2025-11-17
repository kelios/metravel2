// src/generators/html/templates/CoverTemplate.ts
// ✅ АРХИТЕКТУРА: Шаблон обложки для PDF

import type { BookSettings } from '@/components/export/BookSettingsModal';
import type { TravelForBook } from '@/src/types/pdf-export';

export interface CoverTemplateData {
  title: string;
  subtitle?: string;
  userName: string;
  travelCount: number;
  yearRange?: string;
  coverImage?: string;
  createdDate: string;
}

/**
 * Генерирует HTML для обложки
 */
export function generateCoverTemplate(data: CoverTemplateData, settings: BookSettings): string {
  const { title, subtitle, userName, travelCount, yearRange, coverImage, createdDate } = data;

  const backgroundStyle = coverImage
    ? `linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.7) 100%), url('${escapeHtml(coverImage)}')`
    : 'linear-gradient(135deg, #ff9f5a 0%, #ff6b35 50%, #ff8c42 100%)';

  return `
    <section class="pdf-page cover-page" style="
      width: 210mm;
      height: 297mm;
      padding: 0;
      margin: 0;
      position: relative;
      overflow: hidden;
      background: ${backgroundStyle};
      background-size: cover;
      background-position: center;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      align-items: center;
      text-align: center;
      color: #fff;
      page-break-after: always;
    ">
      <div style="padding: 40mm 30mm; width: 100%; position: relative; z-index: 2;">
        ${subtitle ? `
          <div style="font-size: 14pt; font-weight: 500; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 15mm; opacity: 0.9; color: #ffd28f;">
            ${escapeHtml(subtitle)}
          </div>
        ` : ''}
        <h1 style="font-size: 48pt; font-weight: 800; margin: 0 0 20mm 0; line-height: 1.2; text-shadow: 0 4px 20px rgba(0,0,0,0.5); letter-spacing: -0.02em;">
          ${escapeHtml(title)}
        </h1>
        <div style="width: 80mm; height: 3px; background-color: #ff9f5a; margin: 0 auto 20mm; border-radius: 2px; box-shadow: 0 2px 10px rgba(255,159,90,0.5);"></div>
        <div style="font-size: 18pt; font-weight: 400; margin-bottom: 15mm; opacity: 0.95; font-style: italic;">
          ${escapeHtml(userName)}
        </div>
        <div style="display: flex; justify-content: center; gap: 20mm; margin-top: 30mm; font-size: 16pt; font-weight: 600;">
          <div>
            <div style="font-size: 32pt; font-weight: 800; color: #ff9f5a; margin-bottom: 3mm;">${travelCount}</div>
            <div style="font-size: 12pt; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.1em;">
              ${travelCount === 1 ? 'путешествие' : travelCount < 5 ? 'путешествия' : 'путешествий'}
            </div>
          </div>
          ${yearRange ? `
            <div style="border-left: 1px solid rgba(255,255,255,0.3); padding-left: 20mm;">
              <div style="font-size: 32pt; font-weight: 800; color: #ff9f5a; margin-bottom: 3mm;">${escapeHtml(yearRange)}</div>
              <div style="font-size: 12pt; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.1em;">годы</div>
            </div>
          ` : ''}
        </div>
        <div style="margin-top: auto; padding-top: 20mm; font-size: 11pt; opacity: 0.7; font-style: italic;">
          Создано ${createdDate}
        </div>
      </div>
      <div style="position: absolute; bottom: 15mm; right: 20mm; font-size: 10pt; opacity: 0.6; font-weight: 500;">MeTravel</div>
    </section>
  `;
}

function escapeHtml(s: string): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

