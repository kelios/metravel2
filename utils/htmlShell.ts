export function getTravelRouteClassScript(): string {
  // Routes whose first paint is server-rendered enough to not need the FOUC gate.
  // Adds an opt-out class so the gate CSS lets these routes render immediately.
  return String.raw`(function(){try{var p=window.location&&window.location.pathname||'/';if(p==='/'||p==='/index'||/^\/travels\/[^/]+\/?$/.test(p))document.documentElement.classList.add('travel-route')}catch(_){}})();`;
}

export function getRootVisibilityGateCss(): string {
  return `
    html:not(.rnw-styles-ready):not(.travel-route) #root {
      visibility: hidden;
    }

    /* SEO-enriched travel HTML inserts no-JS content before #root. Keep the
       React shell pinned while the fixed SSG shell owns the first screen.
       Once that shell is torn down, the preceding SEO blocks are already
       hidden and #root can return to normal flow without a full-page CLS. */
    html.travel-route:has(#ssg-skeleton .ssg-travel-hero) #root {
      position: fixed;
      inset: 0;
    }
  `;
}
