import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from './config'
import { LOCALE_PREFERENCE_STORAGE_KEY } from './localeStorage'
import { DESIGN_COLORS } from '@/constants/designSystem'
import { getBootLocaleRecoveryCopy } from './bootLocaleRecoveryCopy'

export const LOCALE_BOOT_PENDING_CLASS = 'locale-boot-pending'

/** Runs in <head>, before the Russian SSG body can paint (#2327). */
export const getLocaleBootScript = (): string => `
(function(){try{
  if(window.__metravelLocaleBootErrorHandler)window.removeEventListener('error',window.__metravelLocaleBootErrorHandler,true);
  var p=JSON.parse(window.localStorage.getItem(${JSON.stringify(LOCALE_PREFERENCE_STORAGE_KEY)}));
  if(!p||p.version!==1)return;
  var locales=${JSON.stringify(SUPPORTED_LOCALES)};
  var locale=p.mode==='explicit'?p.locale:null;
  if(p.mode==='system'){
    var languages=navigator.languages||[navigator.language];
    for(var i=0;i<languages.length;i++){
      var candidate=String(languages[i]).toLowerCase().replace(/_/g,'-').split('-')[0];
      if(locales.indexOf(candidate)!==-1){locale=candidate;break;}
    }
  }
  if(locale===${JSON.stringify(DEFAULT_LOCALE)}||locales.indexOf(locale)===-1)return;
  document.documentElement.classList.add(${JSON.stringify(LOCALE_BOOT_PENDING_CLASS)});
  var copy=${JSON.stringify(Object.fromEntries(SUPPORTED_LOCALES.map((locale) => [locale, getBootLocaleRecoveryCopy(locale)])))}[locale];
  function recover(){
    if(!document.documentElement.classList.contains(${JSON.stringify(LOCALE_BOOT_PENDING_CLASS)}))return;
    // Reuse the existing guarded stale-chunk reload; after its one retry, give
    // the visitor controls even if the React entry point never executed.
    if(window.__metravelReloadStaleChunk&&window.__metravelReloadStaleChunk())return;
    function show(){
      if(document.getElementById('locale-boot-recovery'))return;
      var panel=document.createElement('div');
      panel.id='locale-boot-recovery';panel.lang=locale;
      panel.setAttribute('data-static-recovery','true');
      var status=document.createElement('p');status.setAttribute('role','status');status.textContent=copy.failed;
      var retry=document.createElement('button');retry.type='button';retry.textContent=copy.retry;
      retry.onclick=function(){window.location.reload();};
      var fallback=document.createElement('button');fallback.type='button';fallback.textContent=copy.fallback;
      fallback.onclick=function(){
        try{window.localStorage.setItem(${JSON.stringify(LOCALE_PREFERENCE_STORAGE_KEY)},JSON.stringify({version:1,mode:'explicit',locale:'ru'}));}catch(_){}
        document.documentElement.classList.remove(${JSON.stringify(LOCALE_BOOT_PENDING_CLASS)});
        var root=document.getElementById('root');if(root)root.style.setProperty('visibility','visible','important');
        panel.remove();
      };
      panel.appendChild(status);panel.appendChild(retry);panel.appendChild(fallback);document.body.appendChild(panel);
    }
    if(document.body)show();else document.addEventListener('DOMContentLoaded',show,{once:true});
  }
  window.__metravelLocaleBootErrorHandler=function(event){
    var target=event&&event.target;
    var src=target&&target.tagName==='SCRIPT'?target.src:event.filename;
    try{var url=new URL(src,window.location.href);
      if(url.origin===window.location.origin&&url.pathname.indexOf('/_expo/static/js/web/')===0&&url.pathname.slice(-3)==='.js')recover();
    }catch(_){}
  };
  window.addEventListener('error',window.__metravelLocaleBootErrorHandler,true);
}catch(_){}})();`

// visibility preserves the SSG layout. It also covers SEO shells outside #root;
// hiding only the React root would leave Russian headings visible before boot.
export const getLocaleBootCss = (): string =>
  `html.${LOCALE_BOOT_PENDING_CLASS} body, html.${LOCALE_BOOT_PENDING_CLASS} body * { visibility: hidden !important; pointer-events: none; }
   html.${LOCALE_BOOT_PENDING_CLASS} #locale-boot-recovery, html.${LOCALE_BOOT_PENDING_CLASS} #locale-boot-recovery * { visibility: visible !important; pointer-events: auto; }
   #locale-boot-recovery { position: fixed; inset: 0; z-index: 2147483647; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 24px; background: var(--color-surface, ${DESIGN_COLORS.criticalSurfaceLight}); color: var(--color-text, ${DESIGN_COLORS.criticalTextLight}); font: 16px/1.5 system-ui, sans-serif; }
   #locale-boot-recovery button { min-height: 44px; padding: 10px 18px; cursor: pointer; color: inherit; background: var(--color-backgroundSecondary, ${DESIGN_COLORS.criticalBgSecondaryLight}); border: 1px solid currentColor; border-radius: 8px; }`

export const releaseLocaleBootShell = (): void => {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.remove(LOCALE_BOOT_PENDING_CLASS)
    document.querySelector('[data-static-recovery="true"]')?.remove()
  }
}
