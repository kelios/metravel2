import {createHash} from 'node:crypto';

/** A production batch is either the accepted country pair or both explicitly declared thematic pilots. */
export function assertProductionEditionSet(index) {
  const books=index?.books;
  if(index?.schemaVersion!==1||books?.length!==2||new Set(books.map(b=>b.bookId)).size!==2)throw new Error('Expected two distinct complete production editions');
  if(index.sourceContract==='thematic-v1') {
    const expected=new Map([['mountains-pl',{id:'poland-mountains-memory',theme:'mountains',count:40}],['castles-pl',{id:'poland-castles-memory',theme:'castles',count:30}]]);
    if(new Set(books.map(b=>b.seriesId)).size!==2||books.some(b=>{
      const target=expected.get(b.seriesId);
      return !target||b.sourceContract!=='thematic-v1'||b.country!=='PL'||b.bookId!==target.id||b.theme!==target.theme||b.stopCount!==target.count;
    }))throw new Error('Thematic production requires the complete approved 40-mountain / 30-castle pair');
  } else if(books.some(b=>b.sourceContract)||new Set(books.map(b=>b.country)).size!==2||!books.every(b=>['BY','PL'].includes(b.country)))throw new Error('Expected both BY and PL production editions');
  return index;
}

/** The accepted production identity and the snapshot used to publish must describe one edition. */
export function assertProductionEditorialIdentity(source, editorial) {
  if (source.bookId !== editorial.id || source.revision !== editorial.revision || source.country !== editorial.country ||
      (source.kind ?? 'places') !== (editorial.kind ?? 'places') || source.sourceContract !== editorial.sourceContract ||
      (source.sourceContract === 'thematic-v1' && (source.seriesId !== editorial.seriesId || source.theme !== editorial.theme))) {
    throw new Error('Production edition identity differs from editorial source');
  }
}

/** Bind thematic metadata to the exact source bytes whose printed facts were inspected. */
export function thematicEditorialAcceptance(source, bytes) {
  if(source.sourceContract!=='thematic-v1')throw new Error('Expected a thematic editorial source');
  return {bookId:source.bookId,revision:source.revision,sourceContract:'thematic-v1',
    sha256:createHash('sha256').update(bytes).digest('hex')};
}

export function assertAcceptedThematicEditorial(source, bytes, acceptance) {
  if(source.sourceContract!=='thematic-v1')return;
  const expected=thematicEditorialAcceptance(source,bytes);
  const matches=Array.isArray(acceptance.editorialSources)?acceptance.editorialSources.filter(record=>record.bookId===source.bookId&&record.revision===source.revision):[];
  if(matches?.length!==1||matches[0].sourceContract!==expected.sourceContract||matches[0].sha256!==expected.sha256){
    throw new Error('Thematic editorial bytes differ from accepted PDF source');
  }
}
