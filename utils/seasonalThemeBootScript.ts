import { SEASONAL_THEMES, SEASONAL_THEME_DOM_ATTRIBUTE, SEASONAL_THEME_STORAGE_KEY } from '@/constants/seasonalThemes'
import { seasonalCalendarCore } from '@/utils/seasonalCalendarCore'

/**
 * Стартовый ES5-сниппет для `app/+html.tsx`: выставляет `data-season` на `<html>`
 * до гидратации. Включает ту же самодостаточную ES5-функцию календаря, что
 * runtime: вычисления Пасхи, приоритетов и civil date не дублируются.
 */
export function getSeasonalThemeBootScript(): string {
  const registry = SEASONAL_THEMES.map((t) => ({
    id: t.id,
    priority: t.priority,
    rules: t.rules,
  }))
  return (
    `try{var sw=${JSON.stringify(registry)};var calendar=${seasonalCalendarCore.toString()};` +
    `var sp=null;try{sp=window.localStorage.getItem(${JSON.stringify(SEASONAL_THEME_STORAGE_KEY)})}catch(_){}` +
    `var sid=null;` +
    `if(sp!=='off'){` +
    `var fixed=null;for(var i=0;i<sw.length;i++){if(sw[i].id===sp)fixed=sw[i].id}` +
    `if(fixed){sid=fixed}else{` +
    `var now=new Date();sid=calendar(sw,{year:now.getFullYear(),month:now.getMonth()+1,day:now.getDate()}).activeId}}` +
    `if(sid)document.documentElement.setAttribute(${JSON.stringify(SEASONAL_THEME_DOM_ATTRIBUTE)},sid);` +
    `else document.documentElement.removeAttribute(${JSON.stringify(SEASONAL_THEME_DOM_ATTRIBUTE)});` +
    `}catch(_){}`
  )
}
