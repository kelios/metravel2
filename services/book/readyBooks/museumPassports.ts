import type {MuseumPassport} from '@/data/travelBooks/schema/museumPassports';
import type {CatalogueCountry,CatalogueTheme} from './seriesCatalog';

export function selectMuseumPassports(passports:MuseumPassport[],theme:CatalogueTheme,country:CatalogueCountry){
  return passports.filter(passport=>(theme==='all'||theme==='museums')&&(country==='all'||passport.country===country));
}
