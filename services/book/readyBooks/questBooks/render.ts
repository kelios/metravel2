import {escapeHtml as e} from '../../../pdf-export/utils/htmlUtils';
import {printProfileSchema} from '../../../../data/travelBooks/schema/profiles';
import type {PrintProfile} from '../../../../types/readyBook';
import {printQuestLabel,questPrintMetadata} from './labels';
import type {CountryQuestBook,QuestBookEntry} from '../../../../types/questBook';
import {embeddedImage} from '../render/index';
import {readyBookStyles} from '../render/styles';
import {buildQuestBookBlockPlan} from './composition';
import {renderQuestRouteMapSvg} from './maps';
import type {CanvasMapViewport} from '../../../../utils/mapSnapshot/viewport';

export interface QuestBookBlockAssets {
  coverDataUri: string;
  mapDataUri: string;
  mapViewport: CanvasMapViewport;
  qrDataUri: string;
  qrSizeMm: number;
}
export interface QuestBookBlockRenderInput {
  quest: QuestBookEntry;
  contentLocale:CountryQuestBook['contentLocale'];
  profile: PrintProfile;
  assets: QuestBookBlockAssets;
  /** Shared font slots: regular=Noto Sans, bold=Noto Sans Bold, serif=Marck Script. */
  fonts: {regular: string; bold: string; serif: string};
  firstFolio?: number;
}

function validateQuest(quest: QuestBookEntry) {
  const url = new URL(quest.questUrl);
  if (url.origin !== 'https://metravel.by' || url.username || url.password || url.search || url.hash ||
      !/^\/quests\/[a-z0-9-]+\/[a-z0-9-]+\/?$/.test(url.pathname) ||
      url.pathname.split('/').filter(Boolean).at(-1) !== quest.questId) {
    throw new Error('Quest QR must identify the exact published quest');
  }
  if (!quest.title.trim() || !quest.overview.trim() || !quest.points.length ||
      new Set(quest.points.map(point => point.stepId)).size !== quest.points.length ||
      new Set(quest.points.map(point => point.id)).size !== quest.points.length ||
      quest.points.some(point => !point.title.trim() || !Number.isFinite(point.lat) || !Number.isFinite(point.lng) ||
        Math.abs(point.lat) > 90 || Math.abs(point.lng) > 180 || (point.lat === 0 && point.lng === 0))) {
    throw new Error('Quest block requires a complete story and every distinct geographic point');
  }
}

export function questBookStyles(profile: PrintProfile, fonts: QuestBookBlockRenderInput['fonts']) {
  const pocket = profile.id === 'pocket-150x100';
  return readyBookStyles(profile, fonts) + `
@font-face{font-family:QuestBold;src:url('${fonts.bold}')}@font-face{font-family:QuestHand;src:url('${fonts.serif}')}
.quest-story .trim,.quest-map .trim{padding-top:5mm;padding-bottom:5mm}
.quest-content{height:100%;display:flex;flex-direction:column;gap:${pocket ? 1.5 : 2.4}mm;font-size:${pocket ? 9 : 10.5}pt;line-height:1.22}
.quest-city{font-size:${pocket ? 9 : 10.5}pt;color:#805e45}.quest-title{font-family:QuestHand,cursive;font-size:${pocket ? 17 : 23}pt;line-height:1.05;font-weight:400}
.quest-hero{display:flex;align-items:center;justify-content:space-between;gap:${pocket?2:3}mm;flex-shrink:0}.quest-heading{flex:1;min-width:0}.quest-title{font-size:${pocket?17:21}pt}.quest-cover{flex-shrink:0}
.quest-cover{position:relative;width:${pocket ? 28 : 43}mm;height:${pocket ? 19 : 29}mm;overflow:hidden}.quest-cover img{width:100%;height:100%;object-fit:contain}
.quest-cover::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,#fffefa,transparent 7%,transparent 93%,#fffefa),linear-gradient(#fffefa,transparent 7%,transparent 93%,#fffefa);pointer-events:none}
.quest-qr{display:flex;flex-direction:column;align-items:center;gap:1mm;flex-shrink:0;font-size:${pocket ? 9 : 10.5}pt;color:#805e45}.quest-qr img{display:block}
.quest-overview{white-space:pre-line}.quest-points-heading{font-family:QuestBold,sans-serif;font-size:inherit;color:#31443d}
.quest-points{padding-left:5mm;column-count:2;column-gap:6mm;column-fill:balance;font-size:${pocket ? 9 : 10.5}pt;line-height:${pocket?1.1:1.22}}.quest-points li{padding-left:.4mm;margin-bottom:${pocket ? .3 : 1}mm;break-inside:avoid}.quest-optional{font-size:inherit;color:#805e45}
.quest-map-title{font-family:QuestHand,cursive;font-size:${pocket ? 17 : 23}pt}.quest-route-map{width:100%;height:${pocket ? 55 : 161}mm;object-fit:contain;flex-shrink:0}.quest-map-note,.quest-map-attribution{font-size:${pocket ? 9 : 10.5}pt;line-height:1.2}.quest-map-attribution{margin-top:auto}
`;
}

/** A four-page authored block, not a complete volume or a publication manifest. */
export function buildQuestBookBlockHtml(input: QuestBookBlockRenderInput) {
  const {quest, assets, fonts} = input;
  if(input.contentLocale!=='ru')throw new Error('Quest book needs its source content locale');
  validateQuest(quest);
  const profile = printProfileSchema.parse(input.profile);
  const plan = buildQuestBookBlockPlan([quest.questId], input.firstFolio ?? 2);
  const pocket = profile.id === 'pocket-150x100';
  if (!Number.isFinite(assets.qrSizeMm) || assets.qrSizeMm < 22 || assets.qrSizeMm > 29) throw new Error('Quest QR must retain its physical quiet-zone size');
  const cover = embeddedImage(assets.coverDataUri), qr = embeddedImage(assets.qrDataUri);
  const map = renderQuestRouteMapSvg(quest, assets.mapDataUri, assets.mapViewport, profile.widthMm - profile.bindingMm - profile.safeMm, pocket ? 55 : 161, pocket ? 9 : 10.5);
  const content = (value: string) => `<main class="quest-content" data-check-overflow>${value}</main>`;
  const story = content(`<div class="quest-hero"><div class="quest-heading"><p class="quest-city">${e(quest.city)}</p><h2 class="quest-title">${e(printQuestLabel(quest.title))}</h2></div><div class="quest-cover"><img src="${cover}" alt="Обложка: ${e(printQuestLabel(quest.title))}"></div><a class="quest-qr" href="${e(quest.questUrl)}"><img src="${qr}" alt="QR: пройти квест" style="width:${assets.qrSizeMm}mm;height:${assets.qrSizeMm}mm"><span>Пройти квест</span></a></div><p class="quest-overview">${e(pocket?(quest.compactOverview??quest.overview):quest.overview)}</p>${pocket?'':'<p class="quest-points-heading">Точки квеста</p>'}<ol class="quest-points">${quest.points.map(point => `<li>${e(printQuestLabel(point.title))}${point.role === 'optional'&&!/по желанию/i.test(point.title) ? '<span class="quest-optional"> · по желанию</span>' : ''}</li>`).join('')}</ol>`);
  const mapPage = content(`<h2 class="quest-map-title">Карта квеста</h2><p class="quest-map-note">${e(questPrintMetadata(quest))}</p>${map}<p class="quest-map-note">Номера соответствуют точкам на соседней странице. Откройте квест по QR, чтобы начать прохождение.</p><p class="quest-map-attribution">© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors</p>`);
  const pages = plan.map(entry => {
    const side = entry.number % 2 === 0 ? 'left' : 'right';
    const body = entry.kind === 'quest-story' ? story : entry.kind === 'quest-map' ? mapPage : '';
    return `<section class="book-page ${pocket ? 'pocket-layout' : 'album-layout'} ${side} ${entry.kind}" data-folio="${entry.number}" data-kind="${entry.kind}" data-quest-id="${e(quest.questId)}" style="--inner:${profile.bindingMm}mm;--outer:${profile.safeMm}mm"><div class="trim">${body}</div></section>`;
  });
  const stylesCss = questBookStyles(profile, fonts);
  return {html: `<!doctype html><html lang="${e(input.contentLocale)}"><head><meta charset="utf-8"><title>${e(printQuestLabel(quest.title))}</title><style>${stylesCss}</style></head><body>${pages.join('')}</body></html>`, pages, pageMap: plan, stylesCss};
}
