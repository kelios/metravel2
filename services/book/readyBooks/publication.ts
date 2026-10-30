import {z} from 'zod';
import {MIN_READY_BOOK_STOPS, readyBookBodyPageCount, buildReadyBookPagePlan, padPageCount} from './composition';
import {assetUri, sha256} from '../../../data/travelBooks/schema/manifest';
import {profileId, printProfileSchema} from '../../../data/travelBooks/schema/profiles';
import {buildImpositionPlan} from './imposition';
import {coverTextGeometry, imposedCoverTextGeometry} from './render/coverGeometry';
import type {PrintProfile} from '../../../types/readyBook';

const page = z.strictObject({number:z.number().int().positive(),uri:assetUri,sha256,bytes:z.number().int().positive(),alt:z.string().min(1)});
const identifier=z.string().regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/);
const immutableCoverUri=assetUri.refine(uri=>uri.startsWith('https://metravel.by/travel-books/')&&!/[%\\?#\s]/.test(uri)&&uri.slice('https://metravel.by/travel-books/'.length).split('/').every(part=>part&&part!=='.'&&part!=='..'),'Immutable same-origin cover asset required');
const coverTextRegionSchema=z.strictObject({pageIndex:z.literal(0),xMm:z.number().nonnegative(),yMm:z.number().nonnegative(),widthMm:z.number().positive(),heightMm:z.number().positive(),maxFontSizePt:z.number().positive(),minFontSizePt:z.number().positive(),lineHeight:z.number().min(1).max(2),colorHex:z.string().regex(/^#[a-f0-9]{6}$/)});
const coverResource={uri:immutableCoverUri,bytes:z.number().int().positive(),sha256};
export const coverPersonalizationSchema=z.strictObject({
  schemaVersion:z.literal(1),maxCharacters:z.literal(120),defaultPresetId:z.literal('home-memories'),
  presets:z.array(z.strictObject({id:z.enum(['home-memories','world-memories']),text:z.string().min(1).refine(value=>value===value.normalize('NFC').trim()&&Array.from(value).length<=120)})).length(2),
  font:z.strictObject({...coverResource,bytes:z.number().int().positive().max(2*1024*1024),mime:z.literal('font/ttf'),license:z.strictObject({...coverResource,bytes:z.number().int().positive().max(64*1024),mime:z.literal('text/plain')})}),
  templates:z.array(z.strictObject({...coverResource,bytes:z.number().int().positive().max(20*1024*1024),mime:z.literal('application/pdf'),profileId,mode:z.enum(['read','print-shop','home-rings']),pageCount:z.number().int().positive(),widthMm:z.number().positive(),heightMm:z.number().positive(),textRegion:coverTextRegionSchema})).length(6),
}).superRefine((descriptor,ctx)=>{
  const fail=(message:string)=>ctx.addIssue({code:'custom',message});
  if(new Set(descriptor.presets.map(p=>p.id)).size!==2)fail('Both distinct approved cover presets are required');
  if(!descriptor.font.uri.endsWith('.ttf')||!descriptor.font.license.uri.endsWith('.txt'))fail('Full TTF font and plain-text license required');
  if(new Set(descriptor.templates.map(t=>t.profileId+':'+t.mode)).size!==6)fail('Exactly six distinct cover templates required');
  for(const template of descriptor.templates){
    const pocket=template.profileId==='pocket-150x100';
    const profile:PrintProfile={id:template.profileId,widthMm:pocket?150:148,heightMm:pocket?100:210,bleedMm:template.mode==='print-shop'?3:0,safeMm:5,bindingMm:15,binding:'rings'};
    const geometry=template.mode==='home-rings'?imposedCoverTextGeometry(profile,buildImpositionPlan({profileId:profile.id,mode:'home-rings',component:'cover',pageCount:4})):coverTextGeometry(profile);
    if(!template.uri.endsWith('.pdf')||template.pageCount!==(template.mode==='home-rings'?2:4)||Math.abs(template.widthMm-geometry.widthMm)>.001||Math.abs(template.heightMm-geometry.heightMm)>.001||Object.entries(geometry.textRegion).some(([key,value])=>typeof value==='number'?Math.abs(Number(template.textRegion[key as keyof typeof template.textRegion])-value)>.001:template.textRegion[key as keyof typeof template.textRegion]!==value))fail('Cover template geometry differs from the canonical physical layout');
    const r=template.textRegion;
    if(r.xMm+r.widthMm>template.widthMm||r.yMm+r.heightMm>template.heightMm||r.minFontSizePt>r.maxFontSizePt)fail('Cover text region exceeds the actual MediaBox');
  }
});
export const publishedBookSchema = z.strictObject({
  id:identifier,slug:z.string().regex(/^[a-z]+$/),title:z.string().min(1),country:z.enum(['BY','PL']),
  revision:identifier,contentLocale:z.literal('ru'),status:z.literal('partial'),
  layoutVersion:z.union([z.literal(1),z.literal(2)]).default(1),
  bodyPageCount:z.number().int().positive(),coverPageCount:z.literal(4),stopCount:z.number().int().min(MIN_READY_BOOK_STOPS),coverUri:assetUri,
  missing:z.array(z.enum(['stickers','instructions','print-passport','provider-acceptance','paper-check'])).min(1),
  stops:z.array(z.strictObject({id:identifier,title:z.string().min(1),page:z.number().int().positive(),sourceUrl:z.string().url(),pointId:z.number().int().positive(),sourceTravelId:z.number().int().positive(),authorId:z.literal(1),questId:z.number().int().positive().optional()})).min(MIN_READY_BOOK_STOPS),
  quality:z.array(z.strictObject({profileId,printReady:z.literal(false),minIllustrationPpi:z.number().positive(),physicalChecks:z.array(z.enum(['image-resolution','provider-acceptance','paper-check'])).min(2)})).length(2),
  profiles:z.array(printProfileSchema).length(2),
  coverPersonalization:coverPersonalizationSchema.optional(),
  artifacts:z.array(z.strictObject({id:identifier,revision:identifier,profileId,purpose:z.enum(['read','home-rings','home-sewn','print-shop','control','stickers','instructions','print-passport']),component:z.enum(['body','cover','stickers','instructions','passport']),variant:z.enum(['color','no-background']).optional(),outputPageMm:z.strictObject({width:z.number().positive(),height:z.number().positive()}).optional(),controlFor:z.enum(['home-rings','home-sewn']).optional(),uri:assetUri,mime:z.literal('application/pdf'),sha256,bytes:z.number().int().positive(),pageCount:z.number().int().positive()})),
  preview:z.array(z.strictObject({revision:z.string(),profileId,component:z.enum(['body','cover']),sourceSha256:sha256,pages:z.array(page)})).length(4),
}).superRefine((book,ctx)=>{
  const fail=(message:string)=>ctx.addIssue({code:'custom',message});
  if(!book.stops.length)return;
  const bodyCount=readyBookBodyPageCount(book.stops.length);
  if(book.stopCount!==book.stops.length||book.bodyPageCount!==bodyCount)fail('Composition count differs from selected places');
  if(new Set(book.stops.map(stop=>stop.id)).size!==book.stops.length||new Set(book.stops.map(stop=>stop.pointId)).size!==book.stops.length){fail('Duplicate selected place');return;}
  const destinations=buildReadyBookPagePlan(book).filter(page=>page.kind==='destination');
  if(book.stops.some((stop,index)=>stop.page!==destinations[index]?.number))fail('Contents do not match the revision layout version');
  if(new Set(book.quality.map(q=>q.profileId)).size!==2)fail('Missing per-profile measured quality');
  for(const quality of book.quality){if(new Set(quality.physicalChecks).size!==quality.physicalChecks.length||!quality.physicalChecks.includes('provider-acceptance')||!quality.physicalChecks.includes('paper-check')||(quality.minIllustrationPpi<300)!==quality.physicalChecks.includes('image-resolution'))fail('Physical quality limitations differ from measured artwork');}
  if(new Set(book.profiles.map(p=>p.id)).size!==2) fail('Both physical profiles are required');
  if(new Set(book.artifacts.map(a=>a.id)).size!==book.artifacts.length) fail('Duplicate artifact');
  if(new Set(book.preview.map(p=>p.profileId+':'+p.component)).size!==4) fail('Duplicate preview');
  for(const profile of book.profiles){
    for(const pair of ['read:body','read:cover','home-rings:body','home-rings:cover','print-shop:body','print-shop:cover',...(profile.id==='album-a5'?['home-sewn:body']:[])]){
      if(book.artifacts.filter(a=>a.profileId===profile.id&&a.purpose+':'+a.component===pair).length!==1) fail('Missing or duplicate '+pair);
    }
    for(const home of book.artifacts.filter(a=>a.profileId===profile.id&&(a.purpose==='home-rings'||a.purpose==='home-sewn'))){
      if(book.artifacts.filter(a=>a.profileId===profile.id&&a.purpose==='control'&&a.controlFor===home.purpose&&a.component===home.component).length!==1)fail('Missing or duplicate assembly control');
    }
  }
  const resources=new Map<string,{sha256:string,bytes:number}>();
  const cover=book.coverPersonalization;
  const coverResources=cover?[cover.font,cover.font.license,...cover.templates]:[];
  for(const a of [...book.artifacts,...book.preview.flatMap(p=>p.pages),...coverResources]){
    const prior=resources.get(a.uri);
    if(prior&&(prior.sha256!==a.sha256||prior.bytes!==a.bytes))fail('Conflicting immutable asset metadata');
    resources.set(a.uri,a);
  }
  if(coverResources.some(a=>!a.uri.includes('/'+book.id+'/'+book.revision+'/')))fail('Mixed cover template or font revision');
  for(const a of book.artifacts){
    if(a.revision!==book.revision||!a.uri.includes('/'+book.revision+'/')) fail('Mixed artifact revision');
    const supplemental=['stickers','instructions','print-passport'].includes(a.purpose);
    const count=supplemental?a.pageCount:a.purpose==='control'?a.pageCount:a.purpose==='home-rings'||a.purpose==='home-sewn'?padPageCount(a.component==='body'?bodyCount:4,4)/2:(a.component==='body'?bodyCount:4);
    if(a.purpose==='control'){
      if(a.pageCount<2)fail('Control document needs the physical duplex pair');
      if(!a.controlFor||!book.artifacts.some(home=>home.profileId===a.profileId&&home.purpose===a.controlFor&&home.component===a.component))fail('Control document must identify its exact assembly package');
    }else if(a.controlFor!==undefined)fail('Assembly discriminator belongs only to control documents');
    if(a.pageCount!==count)fail('Incorrect physical-package page count');
    if(supplemental){
      const component={stickers:'stickers',instructions:'instructions','print-passport':'passport'}[a.purpose as 'stickers'|'instructions'|'print-passport'];
      if(a.outputPageMm?.width!==210||a.outputPageMm?.height!==297)fail('Supplement must declare A4 geometry');
      if(a.component!==component)fail('Supplement component differs from purpose');
      if(a.purpose==='stickers'?(a.pageCount!==2||!a.variant):a.variant!==undefined)fail('Supplement variant or sheet count differs');
    }else if(!['body','cover'].includes(a.component)||a.variant!==undefined)fail('Core package has invalid component/variant');
    if(a.purpose==='home-sewn'&&(a.profileId!=='album-a5'||a.component!=='body'))fail('Sewn binding belongs only to the A5 body');
  }
  for(const purpose of ['stickers','instructions','print-passport'] as const){
    const present=book.artifacts.filter(a=>a.purpose===purpose);
    if(book.missing.includes(purpose)!==(present.length===0))fail('Missing list contradicts actual supplements');
    if(present.length){
      const expected=purpose==='stickers'?4:2;
      if(present.length!==expected||new Set(present.map(a=>a.profileId+':'+(a.variant??''))).size!==expected)fail('Incomplete or duplicate supplements');
    }
  }
  for(const p of book.preview){
    const source=book.artifacts.find(a=>a.profileId===p.profileId&&a.component===p.component&&a.purpose==='read');
    const count=p.component==='body'?bodyCount:4;
    if(!source||source.sha256!==p.sourceSha256||p.revision!==book.revision||p.pages.length!==count||p.pages.some((a,i)=>a.number!==i+1||!a.uri.includes('/'+book.revision+'/'))) fail('Preview must match the complete reading PDF');
  }
});
export const publicationSchema=z.strictObject({schemaVersion:z.literal(1),releaseId:z.literal('travel-books-v1'),books:z.array(publishedBookSchema).length(2)}).superRefine((value,ctx)=>{
  for(const field of ['id','slug','country'] as const) if(new Set(value.books.map(b=>b[field])).size!==2) ctx.addIssue({code:'custom',message:'Duplicate '+field});
});
export type PublishedBook=z.infer<typeof publishedBookSchema>;
export type PublishedArtifact=PublishedBook['artifacts'][number];
export type CoverPersonalization=z.infer<typeof coverPersonalizationSchema>;
export type CoverTemplate=CoverPersonalization['templates'][number];
export type CoverTextRegion=CoverTemplate['textRegion'];

export {buildReadyBookPagePlan} from './composition';
