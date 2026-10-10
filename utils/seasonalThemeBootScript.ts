import { SEASONAL_THEMES, SEASONAL_THEME_DOM_ATTRIBUTE, SEASONAL_THEME_STORAGE_KEY } from '@/constants/seasonalThemes'

/**
 * Стартовый ES5-сниппет для `app/+html.tsx`: выставляет `data-season` на `<html>`
 * до гидратации по тем же окнам реестра, что и `resolveSeasonalTheme`, чтобы
 * страница не мигала обычным видом перед праздничным (#2376). Логика окна
 * продублирована в ES5 намеренно — сниппет исполняется до загрузки бандла.
 */
export function getSeasonalThemeBootScript(): string {
  const windows = SEASONAL_THEMES.map((t) => ({
    id: t.id,
    from: t.window.from.month * 100 + t.window.from.day,
    to: t.window.to.month * 100 + t.window.to.day,
  }))
  return (
    `try{var sw=${JSON.stringify(windows)};` +
    `var sp=null;try{sp=window.localStorage.getItem(${JSON.stringify(SEASONAL_THEME_STORAGE_KEY)})}catch(_){}` +
    `var sid=null;` +
    `if(sp!=='off'){` +
    `var fixed=null;for(var i=0;i<sw.length;i++){if(sw[i].id===sp)fixed=sw[i].id}` +
    `if(fixed){sid=fixed}else{` +
    `var now=new Date();var p=(now.getMonth()+1)*100+now.getDate();` +
    `for(var j=0;j<sw.length&&!sid;j++){var w=sw[j];` +
    `if(w.from<=w.to?(p>=w.from&&p<=w.to):(p>=w.from||p<=w.to))sid=w.id}}}` +
    `if(sid)document.documentElement.setAttribute(${JSON.stringify(SEASONAL_THEME_DOM_ATTRIBUTE)},sid);` +
    `}catch(_){}`
  )
}
