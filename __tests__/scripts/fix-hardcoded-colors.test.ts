const path = require('path');

const {
  isExcludedPath,
  replaceColors,
} = require('../../scripts/fix-hardcoded-colors.js');

describe('fix-hardcoded-colors', () => {
  it('only replaces audited UI color props', () => {
    const source = `
      const styles = StyleSheet.create({
        card: {
          backgroundColor: '#fff',
          borderColor: "#000",
          color: '#FF9F5A',
          shadowColor: '#000',
          outlineColor: '#fff',
          borderColor: 'transparent',
        },
      });
    `;

    const { modified, changeCount } = replaceColors(source);

    expect(changeCount).toBe(3);
    expect(modified).toContain('backgroundColor: DESIGN_TOKENS.colors.surface');
    expect(modified).toContain('borderColor: DESIGN_TOKENS.colors.text');
    expect(modified).toContain('color: DESIGN_TOKENS.colors.primary');
    expect(modified).toContain("shadowColor: '#000'");
    expect(modified).toContain("outlineColor: '#fff'");
    expect(modified).toContain("borderColor: 'transparent'");
  });

  it('excludes token definitions, PDF themes, and map snapshot renderers', () => {
    const root = process.cwd();

    expect(isExcludedPath(path.join(root, 'constants/designSystem.ts'))).toBe(true);
    expect(isExcludedPath(path.join(root, 'constants/modernMattePalette.ts'))).toBe(true);
    expect(isExcludedPath(path.join(root, 'constants/theme.ts'))).toBe(true);
    expect(isExcludedPath(path.join(root, 'services/pdf-export/themes/configs/light.ts'))).toBe(true);
    expect(isExcludedPath(path.join(root, 'utils/mapSnapshot/canvasRenderer.ts'))).toBe(true);
    expect(isExcludedPath(path.join(root, 'components/ui/Button.tsx'))).toBe(false);
  });
});
