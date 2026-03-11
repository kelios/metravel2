export function getTravelRouteClassScript(): string {
  return String.raw`(function(){try{var p=window.location&&window.location.pathname||'/';if(/^\/travels\/[^/]+\/?$/.test(p))document.documentElement.classList.add('travel-route')}catch(_){}})();`;
}

export function getRootVisibilityGateCss(): string {
  return `
    html:not(.rnw-styles-ready):not(.travel-route) #root {
      visibility: hidden;
    }
  `;
}
