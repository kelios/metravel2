import {escapeHtml as e} from '../../../pdf-export/utils/htmlUtils';
import {countryQuestBookSchema} from '../../../../data/travelBooks/schema/questBooks';
import {renderCoverPage} from '../render/cover';
import {renderReadyBookEndMap} from '../render/endMap';
import type {EmbeddedBookAsset} from '../render';
import {buildQuestBookPagePlan} from './composition';
import {buildQuestBookBlockHtml,questBookStyles,type QuestBookBlockAssets,type QuestBookBlockRenderInput} from './render';
import {printQuestLabel} from './labels';
import type {CountryQuestBook} from '../../../../types/questBook';
import {countRu,editionLabel,QUESTS} from '../render/counts';
import edition from '../../../../data/travelBooks/edition.json';
import type {PrintProfile} from '../../../../types/readyBook';

export interface CountryQuestBookRenderInput{
  book:CountryQuestBook;
  profile:PrintProfile;
  purpose:'read'|'print-shop';
  fonts:QuestBookBlockRenderInput['fonts'];
  assets:Record<string,QuestBookBlockAssets>;
  cover:Pick<EmbeddedBookAsset,'dataUri'|'widthPx'|'heightPx'|'artworkBounds'>;
}
/** Full volumes share block semantics, physical page shell, cover and PDF/imposition consumers. */
export function buildCountryQuestBookHtml(input:CountryQuestBookRenderInput){
  const {book,profile}=input;
  countryQuestBookSchema.parse(book);
  if((input.purpose==='read')!==(profile.bleedMm===0))throw new Error('Quest bleed differs from the physical purpose');
  if(!book.endMatterPages?.length)throw new Error('The country volume needs its recorded ending before assembly');
  if(new Set(book.endMatterPages).size!==book.endMatterPages.length||book.endMatterPages.some(kind=>kind!=='country-map'))throw new Error('This ending has no content adapter');
  const plan=buildQuestBookPagePlan(book,{endMatterPages:book.endMatterPages});
  const stylesCss=questBookStyles(profile,input.fonts)+'\n.quest-title-page .small,.cover-4 .small{overflow-wrap:anywhere}.quest-title-page h1,.quest-country-map h2,.quest-contents h2{font-family:QuestHand,cursive}';
  const page=(number:number,kind:string,body:string,component='body')=>`<section class="book-page ${profile.id==='album-a5'?'album-layout':'pocket-layout'} ${number%2===0?'left':'right'} ${component} ${kind}" data-folio="${number}" data-kind="${kind}" style="--inner:${profile.bindingMm}mm;--outer:${profile.safeMm}mm"><div class="trim">${body}</div></section>`;
  const flow=(body:string)=>`<main class="content" data-check-overflow><div class="flow">${body}</div></main>`;
  const blocks=new Map<string,string[]>();
  for(const quest of book.quests){
    const firstFolio=plan.find(entry=>entry.kind==='quest-story'&&entry.questId===quest.questId)!.number;
    if(!input.assets[quest.questId])throw new Error('Missing complete quest artwork/map/QR: '+quest.questId);
    blocks.set(quest.questId,buildQuestBookBlockHtml({quest,contentLocale:book.contentLocale,profile,fonts:input.fonts,assets:input.assets[quest.questId],firstFolio}).pages);
  }
  const bodyPages=plan.map(entry=>{
    if(entry.questId){const offset=['quest-story','quest-map','photo-memory','notes'].indexOf(entry.kind);return blocks.get(entry.questId)![offset];}
    if(entry.kind==='padding')return page(entry.number,'padding','');
    if(entry.kind==='title')return page(entry.number,'quest-title-page',flow(`<h1>${e(book.title)}</h1><p>${countRu(book.quests.length,QUESTS)} · фотодневник</p><p>Для самостоятельных поездок, любимых кадров и своих историй.</p><p class="small">Русский язык · ${profile.widthMm}×${profile.heightMm} мм</p><p class="small">${editionLabel(edition.editionDate)}</p>`));
    if(entry.kind==='usage')return page(entry.number,'quest-usage',flow('<h2>Ваша история путешествия</h2><p>Выберите квест в содержании. На первом развороте — его история, все точки и карта. QR открывает прохождение на сайте.</p><p>После карты оставлены свободная страница для ваших фотографий и чистая страница для заметок. Сохраните полосу крепления у переплёта.</p><p class="small">Сложность, возрастные и сезонные метки принадлежат отдельным маршрутам. Перед поездкой проверьте условия посещения в онлайн-квесте.</p>'));
    if(entry.kind==='contents'){
      const rows=book.quests.filter(quest=>entry.questIds?.includes(quest.questId));
      return page(entry.number,'quest-contents',flow(`<h2>Квесты этой части</h2><ol class="contents-list">${rows.map(quest=>`<li><span>${book.quests.indexOf(quest)+1}. ${e(printQuestLabel(quest.title))}</span><span>${plan.find(page=>page.kind==='quest-story'&&page.questId===quest.questId)!.number}</span></li>`).join('')}</ol>`));
    }
    const geography={kind:'quests' as const,country:book.country,stops:book.quests.map(quest=>({id:quest.questId,title:quest.title,lat:quest.points[0].lat,lng:quest.points[0].lng}))};
    return page(entry.number,'quest-country-map',flow(`<h2>Квесты на карте страны</h2>${renderReadyBookEndMap(geography,profile)}<p class="small">Номера соответствуют порядку квестов в содержании. Показана первая точка каждого маршрута; для прохождения откройте его QR.</p>`));
  });
  const coverPages=[1,2,3,4].map(number=>page(number,`cover-${number}`,renderCoverPage(input,number),'cover'));
  const document=(pages:string[])=>`<!doctype html><html lang="${e(book.contentLocale)}"><head><meta charset="utf-8"><title>${e(book.title)}</title><style>${stylesCss}</style></head><body>${pages.join('')}</body></html>`;
  return {bodyHtml:document(bodyPages),coverHtml:document(coverPages),bodyPages,coverPages,stylesCss,pageMap:plan.map(({number,...entry})=>({folio:number,...entry}))};
}
