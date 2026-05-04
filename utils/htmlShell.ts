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
  `;
}
