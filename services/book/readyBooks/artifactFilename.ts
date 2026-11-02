import type {PublishedBook,PublishedArtifact} from './publication';

type FilenameBook=Pick<PublishedBook,'title'|'country'|'visualStyle'>&{kind?:'places'|'quests';sourceContract?:'thematic-v1';volume?:number};
type FilenameFile=Pick<PublishedArtifact,'profileId'|'purpose'|'component'|'variant'|'controlFor'>;

const COUNTRY={BY:'Беларусь',PL:'Польша'} as const;
const STYLE={watercolor:'акварель',photo:'фото',fantasy:'фэнтези',graphic:'графика'} as const;
const SIZE={'pocket-150x100':'15×10','album-a5':'A5'} as const;
const ASSEMBLY={'home-rings':'на кольцах','home-sewn':'прошивка'} as const;
const PART={body:'страницы',cover:'обложка'} as const;

function partName(file:FilenameFile){
  const part=file.component==='body'||file.component==='cover'?PART[file.component]:'';
  switch(file.purpose){
    case 'read':return file.component==='body'?'книга':'обложка';
    case 'print-shop':return `копицентр, ${part}`;
    case 'home-rings':case 'home-sewn':return `${ASSEMBLY[file.purpose]}, ${part} A4`;
    case 'control':return `проверочный лист, ${file.controlFor?ASSEMBLY[file.controlFor]:''}, ${part}`;
    case 'stickers':return file.variant==='no-background'?'наклейки без фона':'наклейки';
    case 'instructions':return 'инструкция';
    case 'print-passport':return 'паспорт печати';
  }
}

/**
 * The browser and the printed guide use exactly the same download names (#2949):
 * «Беларусь — акварель — A5 — книга.pdf», without revision hashes or profile ids.
 */
export function bookArtifactFilename(book:FilenameBook,file:FilenameFile){
  const name=book.kind==='quests'
    ? `${COUNTRY[book.country]} — квесты, часть ${book.volume}`
    : book.sourceContract==='thematic-v1'?book.title:`${COUNTRY[book.country]} — ${STYLE[book.visualStyle??'watercolor']}`;
  return `${name} — ${SIZE[file.profileId]} — ${partName(file)}.pdf`;
}
