import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { Platform } from 'react-native';

import { DESIGN_TOKENS, getThemedColors } from '@/constants/designSystem';
import { getStyles } from '@/screens/tabs/QuestsScreen.styles';
import { getQuestsMapStyles } from '@/screens/tabs/QuestsMapSection.styles';
import { getQuestsSidebarStyles } from '@/screens/tabs/QuestsSidebar.styles';

const ROOT = path.resolve(__dirname, '../../..');
const originalPlatform = Platform.OS;
const WEB_MAP_HEIGHT = 'calc(100dvh - 148px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))';
const sourceExtensions = ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js'];

// Follow runtime edges, including barrels and require(), but stop at import().
// A type-only edge must not make a private style factory appear eager.
const importCache = new Map<string, { sync: string[]; dynamic: string[] }>();
function runtimeImports(file: string) {
    const cached = importCache.get(file);
    if (cached) return cached;
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const sync: string[] = [];
    const dynamic: string[] = [];
    const add = (target: string[], node: ts.Node | undefined) => {
        if (node && ts.isStringLiteralLike(node)) target.push(node.text);
    };
    const visit = (node: ts.Node) => {
        if (ts.isTypeNode(node)) return;
        if (ts.isImportDeclaration(node)) {
            const clause = node.importClause;
            const bindings = clause?.namedBindings;
            const onlyInlineTypes = bindings && ts.isNamedImports(bindings)
                && bindings.elements.length > 0 && bindings.elements.every((item) => item.isTypeOnly);
            if (!clause?.isTypeOnly && (!onlyInlineTypes || clause?.name)) add(sync, node.moduleSpecifier);
            return;
        }
        if (ts.isExportDeclaration(node)) {
            const bindings = node.exportClause;
            const onlyInlineTypes = bindings && ts.isNamedExports(bindings)
                && bindings.elements.length > 0 && bindings.elements.every((item) => item.isTypeOnly);
            if (!node.isTypeOnly && !onlyInlineTypes) add(sync, node.moduleSpecifier);
            return;
        }
        if (ts.isCallExpression(node)) {
            if (node.expression.kind === ts.SyntaxKind.ImportKeyword) add(dynamic, node.arguments[0]);
            else if (ts.isIdentifier(node.expression) && node.expression.text === 'require') add(sync, node.arguments[0]);
        }
        ts.forEachChild(node, visit);
    };
    visit(source);
    const imports = { sync, dynamic };
    importCache.set(file, imports);
    return imports;
}

function resolveLocalImport(from: string, specifier: string) {
    const base = specifier.startsWith('@/') ? path.join(ROOT, specifier.slice(2))
        : specifier.startsWith('.') ? path.resolve(path.dirname(from), specifier) : null;
    if (!base) return null;
    const candidates = [
        ...sourceExtensions.map((extension) => base + extension),
        ...sourceExtensions.map((extension) => path.join(base, `index${extension}`)),
    ];
    if (/\.[jt]sx?$/.test(base)) candidates.push(base);
    return candidates.find((file) => fs.existsSync(file) && fs.statSync(file).isFile()) ?? null;
}

function eagerSources(entry: string) {
    const reached = new Set([entry]);
    for (const file of reached) {
        for (const specifier of runtimeImports(file).sync) {
            const target = resolveLocalImport(file, specifier);
            if (target) reached.add(target);
        }
    }
    return reached;
}

beforeEach(() => {
    // The native Jest preset's select() is bound to its module's platform;
    // changing OS alone would mix web dimensions with native style branches.
    jest.spyOn(Platform, 'select').mockImplementation((spec) => {
        const os = Platform.OS;
        if (os in spec) return spec[os];
        if (os !== 'web' && 'native' in spec) return spec.native;
        return 'default' in spec ? spec.default : undefined;
    });
});

afterEach(() => {
    (Platform as { OS: string }).OS = originalPlatform;
    jest.mocked(Platform.select).mockRestore();
});

it('loads each private factory through its lazy owner and keeps it out of the eager catalog graph', () => {
    const entry = path.join(ROOT, 'screens/tabs/QuestsScreen.tsx');
    const eager = eagerSources(entry);
    expect(eager.has(path.join(ROOT, 'screens/tabs/QuestsScreen.styles.ts'))).toBe(true);
    expect(eager.has(path.join(ROOT, 'screens/tabs/QuestsContentPanel.tsx'))).toBe(true);
    for (const owner of ['QuestsMapSection', 'QuestsSidebar']) {
        const ownerFile = path.join(ROOT, `screens/tabs/${owner}.tsx`);
        const stylesFile = path.join(ROOT, `screens/tabs/${owner}.styles.ts`);
        expect(runtimeImports(entry).dynamic.map((specifier) => resolveLocalImport(entry, specifier))).toContain(ownerFile);
        expect(runtimeImports(ownerFile).sync.map((specifier) => resolveLocalImport(ownerFile, specifier))).toContain(stylesFile);
        expect(eager.has(ownerFile)).toBe(false);
        expect(eager.has(stylesFile)).toBe(false);
    }
});

it('keeps only shared loading/layout styles in core and drops the unread actionBtn', () => {
    const colors = getThemedColors(false);
    const core = getStyles(colors, 390, 800);
    const mapKeys = Object.keys(getQuestsMapStyles(colors, 390, 800));
    const sidebarKeys = Object.keys(getQuestsSidebarStyles(colors, 390));
    expect(mapKeys).toHaveLength(5);
    expect(sidebarKeys).toHaveLength(38);
    for (const key of [...mapKeys, ...sidebarKeys, 'actionBtn']) expect(core).not.toHaveProperty(key);
    for (const key of ['mapSection', 'mapLoading', 'sidebarOverlay', 'sidebarMobile', 'desktopSidebarSlot']) {
        expect(core).toHaveProperty(key);
    }
    expect(core.questCardBadgeText.fontSize).toBe(11);
    expect(getStyles(colors, 320).questCardBadgeText.fontSize).toBe(12);
});

const viewports = [
    { width: 320, height: 320, nativeMapHeight: 420, sidebarWidth: 340 },
    { width: 359, height: 800, nativeMapHeight: 628, sidebarWidth: 340 },
    { width: 390, height: 640, nativeMapHeight: 468, sidebarWidth: 340 },
    { width: 767, height: undefined, nativeMapHeight: 528, sidebarWidth: 340 },
    { width: 768, height: 640, nativeMapHeight: 384, sidebarWidth: 260 },
    { width: 1024, height: 1200, nativeMapHeight: 620, sidebarWidth: 340 },
    { width: 1366, height: 900, nativeMapHeight: 540, sidebarWidth: 340 },
    { width: 1440, height: 0, nativeMapHeight: 620, sidebarWidth: 340 },
    { width: 1440, height: undefined, nativeMapHeight: 620, sidebarWidth: 340 },
];

describe.each(['web', 'android', 'ios'])('%s geometry and theme parity', (platform) => {
    it.each(viewports)('preserves width $width / height $height without changing dock reserves', ({ width, height, nativeMapHeight, sidebarWidth }) => {
        (Platform as { OS: string }).OS = platform;
        const mobile = width < 768;
        for (const isDark of [false, true]) {
            const colors = getThemedColors(isDark);
            const map = getQuestsMapStyles(colors, width, height);
            const sidebar = getQuestsSidebarStyles(colors, width);
            expect(map.mapContainer.height).toBe(platform === 'web' && mobile ? WEB_MAP_HEIGHT : nativeMapHeight);
            expect(map.mapContainer).toEqual(expect.objectContaining({
                minHeight: mobile ? 420 : undefined,
                borderRadius: mobile ? 0 : DESIGN_TOKENS.radii.lg,
                borderWidth: mobile ? 0 : 1,
                backgroundColor: colors.backgroundSecondary,
                borderColor: colors.borderLight,
            }));
            expect(map.geoBanner.backgroundColor).toBe(colors.warningSoft);
            expect(map.geoBannerText.color).toBe(colors.warningDark);
            expect(map.mapSearchAreaBtn.backgroundColor).toBe(colors.brand);
            expect(sidebar.sidebar.width).toBe(mobile ? '100%' : sidebarWidth);
            expect(sidebar.sidebarHeader.padding).toBe(mobile ? DESIGN_TOKENS.spacing.md : DESIGN_TOKENS.spacing.lg);
            expect(sidebar.cityItemIcon.width).toBe(mobile ? 28 : 32);
            expect(sidebar.countryHeader.minHeight).toBe(DESIGN_TOKENS.touchTarget.minHeight);
            expect(sidebar.countryLabelActive.color).toBe(colors.brandText);
            expect(sidebar.sidebarActionPillActive.backgroundColor).toBe(colors.brand);
            expect(sidebar.cityItemCountTextActive.color).toBe(colors.textOnPrimary);

            for (const dockPx of [0, 96]) {
                const core = getStyles(colors, width, height, dockPx);
                expect(core.mapLoading.height).toBe(map.mapContainer.height);
                expect(core.desktopSidebarSlot.width).toBe(mobile ? 0 : sidebarWidth);
                expect(core.contentBody.paddingBottom).toBe(!mobile ? DESIGN_TOKENS.spacing.lg
                    : platform === 'web'
                        ? `calc(max(var(--mt-dock-h, 0px), var(--mt-consent-h, 0px)) + ${DESIGN_TOKENS.spacing.xl}px)`
                        : dockPx + DESIGN_TOKENS.spacing.xl);
                if (platform === 'web') expect(core.sidebarOverlay).toEqual(expect.objectContaining({ bottom: 'var(--mt-dock-h, 0px)' }));
            }
            if (platform === 'web') {
                expect(map.mapSearchAreaBtn).toEqual(expect.objectContaining({
                    top: `calc(${DESIGN_TOKENS.spacing.sm}px + env(safe-area-inset-top, 0px))`,
                    boxShadow: colors.boxShadows.modal,
                }));
                expect(sidebar.sidebar).toEqual(expect.objectContaining({
                    maxHeight: mobile ? '100%' : '100vh',
                    position: mobile ? 'relative' : 'sticky',
                    overflowX: 'hidden',
                    overflowY: 'auto',
                    boxShadow: colors.boxShadows.card,
                }));
                expect(sidebar.sidebarActionPillLabelWrap).toEqual(expect.objectContaining({ opacity: 0, transform: 'translateY(-4px)' }));
                expect(sidebar.sidebarActionPillLabelWrapOpen).toEqual(expect.objectContaining({ opacity: 1, transform: 'translateY(0)' }));
            } else {
                expect(map.mapSearchAreaBtn).not.toHaveProperty('cursor');
                expect(sidebar.sidebar).not.toHaveProperty('position');
                expect(sidebar.sidebarScroll).not.toHaveProperty('overflowY');
            }
        }
    });
});
