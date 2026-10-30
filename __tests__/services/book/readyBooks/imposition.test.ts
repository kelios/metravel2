import {buildImpositionPlan} from '../../../../services/book/readyBooks/imposition';
import {buildReadyBookPagePlan, readyBookBodyPageCount, signatureSizes} from '../../../../services/book/readyBooks/composition';

it.each([30,31,32,37])('derives exactly three roles for each of %i selected places, with end padding only',count=>{
  const stops=Array.from({length:count},(_,i)=>({id:`point-${i}`}));const pages=buildReadyBookPagePlan({stops});expect(pages).toHaveLength(readyBookBodyPageCount(count));
  for(const stop of stops)expect(pages.filter(page=>page.stopId===stop.id).map(page=>page.kind)).toEqual(['destination','photo-memory','notes']);
  const padding=pages.findIndex(page=>page.kind==='padding');if(padding>=0)expect(padding).toBe(pages.length-1);
});

describe('A4 home imposition at actual physical size',()=>{
  it.each([['pocket-150x100','home-rings'],['album-a5','home-rings'],['album-a5','home-sewn']] as const)('%s %s preserves every real folio and puts padding after the book', (profileId,mode)=>{
    const pageCount=110,plan=buildImpositionPlan({profileId,mode,pageCount});expect(plan.scale).toBe(1);expect(plan.logicalPageCount).toBe(110);expect(plan.imposedPageCount).toBe(112);expect(plan.endPadding).toBe(2);
    const placements=plan.sheets.flatMap(sheet=>[...sheet.front,...sheet.back]);expect(placements.filter(p=>p.folio!==null).map(p=>p.folio).sort((a,b)=>a!-b!)).toEqual(Array.from({length:110},(_,i)=>i+1));expect(placements.filter(p=>p.folio===null)).toHaveLength(2);
    for(const p of placements){expect(p.xMm).toBeGreaterThanOrEqual(0);expect(p.yMm).toBeGreaterThanOrEqual(0);expect(p.xMm+plan.pageMm[0]).toBeLessThanOrEqual(plan.sheetMm[0]);expect(p.yMm+plan.pageMm[1]).toBeLessThanOrEqual(plan.sheetMm[1]);expect(p.rotation).toBe(0);}
  });
  it.each(['pocket-150x100','album-a5'] as const)('keeps %s cut leaves physically aligned front/back',profileId=>{const plan=buildImpositionPlan({profileId,mode:'home-rings',pageCount:104});for(const sheet of plan.sheets)for(const front of sheet.front){const back=sheet.back.find(p=>p.folio===front.folio!+1)!;expect(back.yMm).toBe(front.yMm);expect(back.xMm).toBeCloseTo(plan.sheetMm[0]-front.xMm-plan.pageMm[0]);}});
  it('reconstructs every sewn signature in reading order and pads only the tail',()=>{
    const count=108,plan=buildImpositionPlan({profileId:'album-a5',mode:'home-sewn',pageCount:count});expect(plan.signatures).toEqual(signatureSizes(count));let offset=0,first=1;
    for(const size of plan.signatures!){const sheets=plan.sheets.slice(offset,offset+size/4),leaves:(number|null)[][]=[];for(const sheet of sheets)leaves.push([sheet.front[1].folio,sheet.back[0].folio]);for(const sheet of [...sheets].reverse())leaves.push([sheet.back[1].folio,sheet.front[0].folio]);expect(leaves.flat()).toEqual(Array.from({length:size},(_,i)=>first+i<=count?first+i:null));offset+=size/4;first+=size;}
  });
  it.each(['pocket-150x100','album-a5'] as const)('numbers %s cover separately and supplies measurable control',profileId=>{const plan=buildImpositionPlan({profileId,mode:'home-rings',component:'cover',pageCount:4});expect(plan.sheets).toHaveLength(1);expect(plan.control).toEqual({rulerMm:50,toleranceMm:1});});
  it('rejects unsupported physical layouts and missing/odd source counts',()=>{expect(()=>buildImpositionPlan({profileId:'pocket-150x100',mode:'home-sewn',pageCount:104})).toThrow('300 mm');expect(()=>buildImpositionPlan({profileId:'album-a5',mode:'home-rings',pageCount:105})).toThrow('actual even');});
});
