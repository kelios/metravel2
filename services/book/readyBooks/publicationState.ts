import type {PublishedBook} from './publication';

/** A digital print kit can be complete while provider/paper approval is pending. */
export function hasPrintSupplements(book:Pick<PublishedBook,'missing'>):boolean{
  return !book.missing.some(purpose=>purpose==='stickers'||purpose==='instructions'||purpose==='print-passport');
}

/** Editions without a style are the original watercolor series; later styles name themselves (#2854). */
export const bookStyleKey=(style:string|undefined):'styleWatercolor'|'stylePhoto'=>style==='photo'?'stylePhoto':'styleWatercolor';
