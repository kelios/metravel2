import { getRootVisibilityGateCss, getTravelRouteClassScript } from '@/utils/htmlShell';

describe('html shell travel route gating', () => {
  it('keeps the RNW visibility gate only for non-travel routes', () => {
    const css = getRootVisibilityGateCss();

    expect(css).toContain('html:not(.rnw-styles-ready):not(.travel-route) #root');
    expect(css).not.toContain('html:not(.rnw-styles-ready) #root');
  });

  it('pins the travel root for the lifetime of the fixed SSG shell', () => {
    const css = getRootVisibilityGateCss();

    expect(css).toContain(
      'html.travel-route:has(#ssg-skeleton .ssg-travel-hero) #root',
    );
    expect(css).toContain('position: fixed');
    expect(css).toContain('inset: 0');
  });

  it('marks travel detail routes before the root visibility gate applies', () => {
    const script = getTravelRouteClassScript();

    expect(script).toContain("document.documentElement.classList.add('travel-route')");
    expect(script).toContain('^\\/travels\\/');
  });
});
