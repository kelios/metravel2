import type { QuestStep } from '../types';
import { QR_NAV, type PrintableMapPoint } from './constants';

export function qrUrl(data: string, size = QR_NAV): string {
  return `https://quickchart.io/qr?text=${encodeURIComponent(data)}&size=${size * 2}&margin=1&format=png`;
}

export function googleMapsUrl(lat: number, lng: number): string {
  return `https://maps.google.com/maps?q=${lat},${lng}`;
}
export function yandexMapsUrl(lat: number, lng: number): string {
  return `https://yandex.ru/maps/?pt=${lng},${lat}&z=16&l=map`;
}
export function organicMapsUrl(lat: number, lng: number): string {
  return `https://omaps.app/?ll=${lat},${lng}&z=16`;
}

export function buildPrintableMapPoints(steps: QuestStep[]): PrintableMapPoint[] {
  return steps
    .filter((step) => Number.isFinite(step.lat) && Number.isFinite(step.lng) && (step.lat !== 0 || step.lng !== 0))
    .map((step, index) => ({
      lat: step.lat,
      lng: step.lng,
      num: index + 1,
      location: step.location || `Точка ${index + 1}`,
    }));
}

export function resolveStepImageUri(image: unknown): string {
  if (!image) return '';
  if (typeof image === 'string') return image;
  if (typeof image === 'object' && image !== null) {
    const obj = image as Record<string, unknown>;
    if (typeof obj['uri'] === 'string') return obj['uri'];
    if (typeof obj['default'] === 'object' && obj['default'] !== null) {
      const def = obj['default'] as Record<string, unknown>;
      if (typeof def['uri'] === 'string') return def['uri'];
    }
  }
  return '';
}

export function extractCoverLead(story?: string): string {
  const raw = String(story || '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/[_`>#-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!raw) return '';

  const firstSentence = raw.match(/.+?[.!?](?:\s|$)/)?.[0]?.trim() || raw;
  return firstSentence.slice(0, 180).trim();
}

export function escInline(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escHtml(str: string): string {
  return escInline(str).replace(/\n/g, '<br>');
}
