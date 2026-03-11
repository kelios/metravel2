import { getRootVisibilityGateCss, getTravelRouteClassScript } from '@/utils/htmlShell';

describe('html shell travel route gating', () => {
  it('keeps the RNW visibility gate only for non-travel routes', () => {
    const css = getRootVisibilityGateCss();

    expect(css).toContain('html:not(.rnw-styles-ready):not(.travel-route) #root');
    expect(css).not.toContain('html:not(.rnw-styles-ready) #root');
  });

  it('marks travel detail routes before the root visibility gate applies', () => {
    const script = getTravelRouteClassScript();

    expect(script).toContain("document.documentElement.classList.add('travel-route')");
    expect(script).toContain('^\\/travels\\/');
  });
});
