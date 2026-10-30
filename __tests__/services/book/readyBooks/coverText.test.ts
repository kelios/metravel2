/** @jest-environment node */
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {webcrypto} from 'node:crypto';
import ts from 'typescript';
import {PDFArray,PDFDict,PDFDocument,PDFName,PDFRawStream,StandardFonts,decodePDFRawStream,rgb} from '@cantoo/pdf-lib';
import {createPersonalizedCoverPdf,normalizeCoverText,type CoverTextRegion} from '@/services/book/readyBooks/coverText';
import coverCopy from '@/data/travelBooks/cover-copy.json';

const fontBytes=new Uint8Array(readFileSync(path.resolve('data/travelBooks/assets/fonts/marckscript/MarckScript-Regular.ttf')));
const cryptoDescriptor=Object.getOwnPropertyDescriptor(globalThis,'crypto');
beforeAll(()=>Object.defineProperty(globalThis,'crypto',{configurable:true,value:{subtle:{
  digest(algorithm:string,bytes:BufferSource){
    const view=ArrayBuffer.isView(bytes)?new Uint8Array(bytes.buffer,bytes.byteOffset,bytes.byteLength):new Uint8Array(bytes);
    return webcrypto.subtle.digest(algorithm,Buffer.from(Array.from(view)));
  },
}}}));
afterAll(()=>{if(cryptoDescriptor)Object.defineProperty(globalThis,'crypto',cryptoDescriptor);else Reflect.deleteProperty(globalThis,'crypto');});
const pt=(mm:number)=>mm*72/25.4;
const regions:Record<string,{widthMm:number;heightMm:number;count:number;region:CoverTextRegion}>={
  read:{widthMm:150,heightMm:100,count:4,region:{pageIndex:0,xMm:15,yMm:8,widthMm:120,heightMm:28,minFontSizePt:12,maxFontSizePt:20,lineHeight:1.18,colorHex:'#31443d'}},
  'print-shop':{widthMm:154,heightMm:216,count:4,region:{pageIndex:0,xMm:18,yMm:18,widthMm:118,heightMm:47,minFontSizePt:16,maxFontSizePt:31,lineHeight:1.18,colorHex:'#31443d'}},
  'home-rings':{widthMm:210,heightMm:297,count:2,region:{pageIndex:0,xMm:45,yMm:170,widthMm:120,heightMm:28,minFontSizePt:12,maxFontSizePt:20,lineHeight:1.18,colorHex:'#31443d'}},
};
async function template(spec:typeof regions[string]) {
  const pdf=await PDFDocument.create();
  const marker=await pdf.embedFont(StandardFonts.Helvetica);
  for(let index=0;index<spec.count;index++) {
    const page=pdf.addPage([pt(spec.widthMm),pt(spec.heightMm)]);
    page.setMediaBox(2,3,pt(spec.widthMm),pt(spec.heightMm));
    page.setCropBox(3,4,pt(spec.widthMm)-2,pt(spec.heightMm)-2);
    page.setTrimBox(4,5,pt(spec.widthMm)-4,pt(spec.heightMm)-4);
    page.setBleedBox(3,4,pt(spec.widthMm)-2,pt(spec.heightMm)-2);
    page.setArtBox(5,6,pt(spec.widthMm)-6,pt(spec.heightMm)-6);
    page.drawRectangle({x:10,y:pt(spec.heightMm)-30,width:40,height:12,color:rgb(.2,.5,.3)});
    page.drawText('UNCHANGED ART '+index,{x:12,y:pt(spec.heightMm)-26,font:marker,size:8});
  }
  return pdf.save({useObjectStreams:false});
}
function streams(pdf:PDFDocument,index:number) {
  const contents=pdf.getPage(index).node.Contents();
  const entries=contents instanceof PDFArray?contents.asArray().map(ref=>pdf.context.lookup(ref)):contents?[contents]:[];
  return entries.filter((entry):entry is PDFRawStream=>entry instanceof PDFRawStream).map(stream=>Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1'));
}
function boxes(pdf:PDFDocument,index:number) {
  const page=pdf.getPage(index);
  return {media:page.getMediaBox(),crop:page.getCropBox(),trim:page.getTrimBox(),bleed:page.getBleedBox(),art:page.getArtBox(),rotation:page.getRotation()};
}
function stampedText(pdf:PDFDocument,before:string[]) {
  const fonts=pdf.getPage(0).node.Resources()!.lookup(PDFName.of('Font'),PDFDict);
  const unicode=new Map<string,string>();
  let marck=false;
  for(const key of fonts.keys()) {
    const font=fonts.lookup(key,PDFDict);
    if(!String(font.get(PDFName.of('BaseFont'))).includes('MarckScript'))continue;
    marck=true;
    const cmap=font.lookup(PDFName.of('ToUnicode'),PDFRawStream);
    const source=Buffer.from(decodePDFRawStream(cmap).decode()).toString();
    for(const match of source.matchAll(/<([A-Fa-f\d]{4})>\s*<([A-Fa-f\d]{4,})>/g)) {
      const chars=match[2].match(/.{4}/g)!.map(hex=>parseInt(hex,16));
      unicode.set(match[1].toUpperCase(),String.fromCharCode(...chars));
    }
  }
  expect(marck).toBe(true);
  const added=streams(pdf,0).filter(stream=>!before.includes(stream)).join('\n');
  return Array.from(added.matchAll(/<([A-Fa-f\d]+)>\s*Tj/g),match=>match[1].match(/.{4}/g)!.map(glyph=>unicode.get(glyph.toUpperCase())??'�').join('')).join(' ');
}

it.each(Object.keys(regions))('stamps real vector text into the %s template and preserves every page/box/art stream',async mode=>{
  const spec=regions[mode],input=await template(spec);
  const before=await PDFDocument.load(input);
  const text=mode==='read'?coverCopy.presets[0].text:mode==='print-shop'?coverCopy.presets[1].text:'Cafe\u0301 — Łódź, Іўе, Київ, «успаміны»';
  const result=await createPersonalizedCoverPdf({templateBytes:input,fontBytes,text,maxCharacters:120,textRegion:spec.region,expectedPageCount:spec.count,widthMm:spec.widthMm,heightMm:spec.heightMm});
  const after=await PDFDocument.load(result);
  expect(after.getPageCount()).toBe(spec.count);
  for(let index=0;index<spec.count;index++) {
    expect(boxes(after,index)).toEqual(boxes(before,index));
    if(index===0)expect(streams(after,index)).toEqual(expect.arrayContaining(streams(before,index)));
    else expect(streams(after,index)).toEqual(streams(before,index));
  }
  const actual=stampedText(after,streams(before,0));
  expect(actual.replace(/\s+/g,' ')).toBe(text.normalize('NFC').trim().replace(/\s+/g,' '));
  if(mode==='home-rings') {
    expect(actual).not.toContain(coverCopy.presets[0].text);
    expect(actual).not.toContain('�');
  }
});
it('counts NFC Unicode code points, keeps the whole title and rejects empty or over-limit text',()=>{
  expect(normalizeCoverText(' e\u0301 '.trim().repeat(120),120)).toBe('é'.repeat(120));
  expect(()=>normalizeCoverText('  ',120)).toThrow('COVER_TEXT_EMPTY');
  expect(()=>normalizeCoverText('e\u0301'.repeat(121),120)).toThrow('COVER_TEXT_TOO_LONG');
});
it('rejects unsupported glyphs, real overflow and wrong physical templates without a standard-cover fallback',async()=>{
  const spec=regions.read,bytes=await template(spec);
  const base={templateBytes:bytes,fontBytes,text:'Мой дневник',maxCharacters:120,textRegion:spec.region,expectedPageCount:spec.count,widthMm:spec.widthMm,heightMm:spec.heightMm};
  await expect(createPersonalizedCoverPdf({...base,text:'😀'})).rejects.toThrow('COVER_UNSUPPORTED_GLYPH');
  await expect(createPersonalizedCoverPdf({...base,textRegion:{...spec.region,widthMm:1,heightMm:1,minFontSizePt:20,maxFontSizePt:20}})).rejects.toThrow('COVER_TEXT_OVERFLOW');
  await expect(createPersonalizedCoverPdf({...base,expectedPageCount:2})).rejects.toThrow('COVER_TEMPLATE_INVALID');
  await expect(createPersonalizedCoverPdf({...base,widthMm:151})).rejects.toThrow('COVER_TEMPLATE_INVALID');
  await expect(createPersonalizedCoverPdf({...base,textRegion:{...spec.region,xMm:149}})).rejects.toThrow('COVER_TEMPLATE_INVALID');
  const alteredFont=fontBytes.slice();alteredFont[alteredFont.length-1]^=1;
  await expect(createPersonalizedCoverPdf({...base,fontBytes:alteredFont})).rejects.toThrow('COVER_FONT_INVALID');
});
it('has no eager PDF/fontkit runtime imports or server DOM/fetch dependency',()=>{
  const source=readFileSync(path.resolve('services/book/readyBooks/coverText.ts'),'utf8');
  const file=ts.createSourceFile('coverText.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
  for(const statement of file.statements) {
    if(ts.isImportDeclaration(statement)&&ts.isStringLiteral(statement.moduleSpecifier)&&statement.moduleSpecifier.text.startsWith('@cantoo/'))expect(statement.importClause?.isTypeOnly).toBe(true);
  }
  const forbidden:string[]=[];
  function visit(node:ts.Node) {
    if(ts.isIdentifier(node)&&['window','document','fetch','localStorage','sessionStorage'].includes(node.text))forbidden.push(node.text);
    ts.forEachChild(node,visit);
  }
  visit(file);
  expect(forbidden).toEqual([]);
  expect(source).not.toContain("import('@cantoo/fontkit')");
  expect(source).toContain("import('./pdfCoverVendor')");
  expect(source).toContain("import('./marckFontAdapter')");
});
