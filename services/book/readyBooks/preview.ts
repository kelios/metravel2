import type {PublishedBook} from './publication';
export function previewWindow(page:number,spread:boolean,total:number):number[]{
  if(!Number.isInteger(total)||total<1)return [];
  const current=Math.min(total,Math.max(1,Math.trunc(page)||1));
  if(!spread||current===1) return [current];
  const left=current%2===0?current:current-1;
  return [left,...(left<total?[left+1]:[])];
}
export function bookPreview(book:PublishedBook,profileId:string,component:'body'|'cover'){
  const preview=book.preview.find(p=>p.profileId===profileId&&p.component===component);
  const file=book.artifacts.find(a=>a.profileId===profileId&&a.component===component&&a.purpose==='read');
  if(!preview||!file||preview.revision!==book.revision||preview.sourceSha256!==file.sha256) throw new Error('Preview revision mismatch');
  return preview;
}
