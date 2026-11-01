import {formatNumber} from '../../../../i18n/format';

/** Keep the source intact; decorative leading icons are not part of a printed place name. */
export function printQuestLabel(value:string):string{
  return value.replace(/^(?:(?![©®™])\p{Extended_Pictographic}[\uFE0F\u200D]*\s+)+/u,'');
}

/** Russian editorial metadata from explicit source tags; no inferred common audience. */
export function questPrintMetadata(quest:{durationMinutes:number;difficulty:string;tags:readonly string[]}):string{
  const difficulty:Record<string,string>={easy:'лёгкий',medium:'средний',hard:'сложный'};
  if(!Object.hasOwn(difficulty,quest.difficulty))throw new Error('Unknown source quest difficulty');
  const age=quest.tags.find(tag=>/^age-\d+-\d+$/.test(tag));
  const tags:Record<string,string>={family:'семейный',kids:'для детей',teens:'для подростков','adult-recommended':'рекомендуется взрослым',spring:'весна',summer:'лето',autumn:'осень',winter:'зима',christmas:'рождественский',halloween:'Хэллоуин',bike:'велосипед',roadtrip:'автомобиль'};
  const duration=formatNumber(quest.durationMinutes,{style:'unit',unit:'minute',unitDisplay:'short'},'ru');
  const labels=[duration,difficulty[quest.difficulty],...(age?[age.slice(4).replace('-','–')+' лет']:[]),...quest.tags.filter(tag=>!(age&&tag==='kids')&&Object.hasOwn(tags,tag)).map(tag=>tags[tag])];
  return labels.join(' · ');
}
