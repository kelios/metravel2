// src/services/pdf-export/generators/v2/pages/ChecklistPageGenerator.ts
// ✅ GENERATOR: Генератор страницы чек-листа

import { BasePageGenerator } from './PageGenerator';
import type { PageContext } from '../types';
import type { BookSettings } from '@/components/export/BookSettingsModal';

/**
 * Библиотека чек-листов
 */
const CHECKLIST_LIBRARY: Record<BookSettings['checklistSections'][number], string[]> = {
  clothing: ['Термобельё', 'Тёплый слой/флис', 'Дождевик/пончо', 'Треккинговая обувь', 'Шапка, перчатки, бафф'],
  food: ['Перекусы', 'Термос', 'Походная посуда', 'Мультитул/нож', 'Фильтр или запас воды'],
  electronics: ['Повербанк', 'Камера/GoPro', 'Переходники', 'Налобный фонарь', 'Запасные карты памяти'],
  documents: ['Паспорт', 'Билеты/бронирования', 'Страховка', 'Водительские права', 'Список контактов'],
  medicine: ['Индивидуальные лекарства', 'Пластыри и бинт', 'Средство от насекомых', 'Солнцезащита', 'Антисептик'],
};

/**
 * Названия секций
 */
const CHECKLIST_LABELS: Record<BookSettings['checklistSections'][number], string> = {
  clothing: 'Одежда',
  food: 'Еда',
  electronics: 'Электроника',
  documents: 'Документы',
  medicine: 'Аптечка',
};

/**
 * Генератор страницы чек-листа для путешествия
 */
export class ChecklistPageGenerator extends BasePageGenerator {
  /**
   * Генерирует страницу чек-листа
   */
  async generate(context: PageContext): Promise<string> {
    const { theme, pageNumber, settings } = context;

    if (!settings?.checklistSections || !settings.checklistSections.length) {
      return '';
    }

    const { colors, typography, spacing } = theme;

    const sections = settings.checklistSections
      .map((section) => ({
        key: section,
        label: CHECKLIST_LABELS[section] || 'Секция',
        items: CHECKLIST_LIBRARY[section] || [],
      }))
      .filter((section) => section.items.length > 0);

    if (!sections.length) return '';

    const cards = sections
      .map(
        (section) => `
        <div style="
          border: 1px solid ${colors.border};
          border-radius: 14px;
          padding: ${spacing.blockSpacing};
          background: ${colors.surface};
          box-shadow: 0 4px 12px rgba(0,0,0,0.12);
          break-inside: avoid;
          page-break-inside: avoid;
        ">
          <div style="
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: ${spacing.elementSpacing};
          ">
            <h3 style="
              margin: 0;
              font-size: ${typography.h4.size};
              font-weight: ${typography.h4.weight};
              color: ${colors.text};
              font-family: ${typography.headingFont};
            ">${section.label}</h3>
            <span style="
              font-size: ${typography.caption.size};
              color: ${colors.textMuted};
              font-weight: 600;
              font-family: ${typography.bodyFont};
              white-space: nowrap;
              flex-shrink: 0;
              line-height: 1.2;
            ">${section.items.length} пунктов</span>
          </div>
          <ul style="
            margin: 0;
            padding-left: 18px;
            color: ${colors.textMuted};
            font-size: ${typography.body.size};
            line-height: ${typography.body.lineHeight};
            font-family: ${typography.bodyFont};
          ">
            ${section.items.map((item) => `<li>${this.escapeHtml(item)}</li>`).join('')}
          </ul>
        </div>
      `
      )
      .join('');

    return `
      <section class="pdf-page checklist-page" style="padding: ${spacing.pagePadding};">
        <div style="text-align: center; margin-bottom: ${spacing.sectionSpacing};">
          <h2 style="
            font-size: ${typography.h2.size};
            font-weight: ${typography.h2.weight};
            margin-bottom: ${spacing.elementSpacing};
            letter-spacing: -0.01em;
            color: ${colors.text};
            font-family: ${typography.headingFont};
          ">Чек-листы путешествия</h2>
          <p style="
            color: ${colors.textMuted};
            font-size: ${typography.body.size};
            font-family: ${typography.bodyFont};
          ">Подходит для печати и отметок</p>
        </div>
        <div style="
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: ${spacing.elementSpacing};
        ">
          ${cards}
        </div>
        <div style="
          position: absolute;
          bottom: 15mm;
          right: 25mm;
          font-size: ${typography.caption.size};
          color: ${colors.textMuted};
          font-family: ${typography.bodyFont};
        ">${pageNumber}</div>
      </section>
    `;
  }

  /**
   * Оценивает количество страниц (обычно 1)
   */
  estimatePageCount(context: PageContext): number {
    const sections = context.settings?.checklistSections || [];
    if (!sections.length) return 0;
    return 1;
  }
}

