import type {PublishedBook} from './publication';

/** A digital print kit can be complete while provider/paper approval is pending. */
export function hasPrintSupplements(book:Pick<PublishedBook,'missing'>):boolean{
  return !book.missing.some(purpose=>purpose==='stickers'||purpose==='instructions'||purpose==='print-passport');
}
