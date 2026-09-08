import React from 'react';
import { Platform } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// Регресс-страж android-link-tap: selectable-текст на Android перехватывает тапы,
// и onPress вложенных <a> в RenderHTML не срабатывает (RN #22811) — ссылки в статьях
// молча не открываются. selectable допустим только на iOS.

const renderHTMLProps: any[] = [];

jest.mock('react-native-render-html', () => ({
  __esModule: true,
  HTMLContentModel: {
    block: 'block',
    mixed: 'mixed',
  },
  HTMLElementModel: {
    fromCustomModel: (model: unknown) => model,
  },
  defaultHTMLElementModels: jest.requireActual('@native-html/transient-render-engine').defaultHTMLElementModels,
  TChildrenRenderer: () => null,
  default: (props: any) => {
    renderHTMLProps.push(props);
    return null;
  },
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    text: '#111111',
    textMuted: '#666666',
    primary: '#0a84ff',
    primaryText: '#0a6b5f',
    focus: '#ff00ff',
    surfaceMuted: '#f7f7f7',
    borderLight: '#e5e7eb',
    backgroundSecondary: '#fafafa',
    mutedBackground: '#f3f4f6',
    boxShadows: {
      card: '0 8px 24px rgba(0, 0, 0, 0.08)',
      light: '0 4px 14px rgba(0, 0, 0, 0.06)',
    },
  }),
}));

jest.mock('@/components/travel/FullscreenGallery', () => ({
  __esModule: true,
  default: () => null,
}));

const setPlatformOs = (os: string) => {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
};

describe('StableContent (native) links', () => {
  const originalOs = Platform.OS;

  afterEach(() => {
    setPlatformOs(originalOs);
    renderHTMLProps.length = 0;
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  const renderNative = (
    html = '<p>См. <a href="https://metravel.by/travels/test">рядом</a></p>'
  ) => {
    const StableContent = require('@/components/travel/StableContent').default;
    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <StableContent
          html={html}
          contentWidth={360}
        />
      );
    });
    return tree!;
  };

  it('android: текст НЕ selectable — иначе тапы по ссылкам не срабатывают', () => {
    setPlatformOs('android');
    renderNative();

    expect(renderHTMLProps.length).toBeGreaterThan(0);
    const props = renderHTMLProps[renderHTMLProps.length - 1];
    expect(props.defaultTextProps?.selectable).toBe(false);
  });

  it.each(['android', 'ios'])('%s: class formats resolve to real native text styles', (os) => {
    setPlatformOs(os);
    renderNative(
      '<p class="ql-align-center ql-indent-4"><span class="ql-font-serif ql-size-large"><strong>Текст</strong></span></p>' +
      '<h2 class="ql-align-right"><span class="ql-font-monospace ql-size-huge">Заголовок</span></h2>' +
      '<p><span id="plain">Обычный текст</span></p>'
    );
    const props = renderHTMLProps[renderHTMLProps.length - 1];
    // Use the same defaults/font resolver as RenderHTML. An always-successful
    // isFontSupported stub would wrongly accept missing native font families.
    jest.isolateModules(() => {
      const nativePlatform = require('react-native').Platform;
      Object.defineProperty(nativePlatform, 'OS', { value: os, configurable: true });
      jest.spyOn(nativePlatform, 'select').mockImplementation((values: any) =>
        values[os] ?? values.native ?? values.default
      );
      const { default: buildTREFromConfig } = jest.requireActual(
        'react-native-render-html/lib/commonjs/helpers/buildTREFromConfig'
      );
      const { defaultTRenderEngineProviderProps } = jest.requireActual(
        'react-native-render-html/lib/commonjs/TRenderEngineProvider'
      );
      const engine = buildTREFromConfig({ ...defaultTRenderEngineProviderProps, ...props });
      const tree = engine.buildTTree(props.source.html);
      const collect = (node: any): any[] => [node, ...(node.children ?? []).flatMap(collect)];
      const nodes = collect(tree);
      const paragraph = nodes.find((node) => node.tagName === 'p');
      const text = nodes.find((node) => node.classes?.includes('ql-size-large'));
      const heading = nodes.find((node) => node.tagName === 'h2');
      const headingText = nodes.find((node) => node.classes?.includes('ql-size-huge'));
      expect(paragraph.styles.nativeTextFlow.textAlign).toBe('center');
      expect(paragraph.styles.nativeBlockRet.marginLeft).toBe(96);
      expect(text.styles.nativeTextFlow.fontFamily).toBe(os === 'ios' ? 'Times New Roman' : 'serif');
      expect(text.styles.nativeTextFlow.fontSize).toBe(24);
      expect(text.styles.nativeTextFlow.lineHeight).toBeCloseTo(38.4);
      expect(heading.styles.nativeTextFlow.textAlign).toBe('right');
      expect(headingText.styles.nativeTextFlow.fontFamily).toBe(os === 'ios' ? 'Menlo' : 'monospace');
      expect(headingText.styles.nativeTextFlow.fontSize).toBe(60);
      expect(headingText.styles.nativeTextFlow.lineHeight).toBe(96);
      const bold = nodes.find((node) => node.tagName === 'strong');
      expect(bold.styles.nativeTextFlow.fontSize).toBe(24);
      const plain = nodes.find((node) => node.attributes?.id === 'plain');
      expect(plain.styles.nativeTextFlow.fontSize).toBe(16);
    });
  });

  it('android: первый маркер списка выровнен с первой строкой текста', () => {
    setPlatformOs('android');
    renderNative();

    const props = renderHTMLProps[renderHTMLProps.length - 1];
    expect(props.tagsStyles?.li).toMatchObject({
      marginTop: 0,
      marginBottom: 8,
    });
    expect(props.tagsStyles?.li?.marginVertical).toBeUndefined();
    expect(props.enableExperimentalGhostLinesPrevention).toBe(true);
  });

  it('android: маркер-точка <ul> прижат к верху пункта, а не к его низу', () => {
    setPlatformOs('android');
    renderNative('<ul><li>Первый пункт в две строки</li><li>Второй</li></ul>');

    // Символьный маркер (disc) RNRH рендерит в собственной строке
    // (`flexDirection: 'row'` + `justifyContent: 'flex-end'`), поэтому alignItems
    // из markerBoxStyle — это вертикальная ось. `flex-end` уводил точку в низ
    // пункта: у многострочных пунктов маркеры сползали к следующему пункту,
    // а маркер последнего пункта оказывался под списком.
    const props = renderHTMLProps[renderHTMLProps.length - 1];
    expect(props.renderersProps?.ul?.markerBoxStyle?.alignItems).toBe('flex-start');
  });

  it('android: длинный пункт списка ограничен доступной шириной и переносится после маркера', () => {
    setPlatformOs('android');
    renderNative([
      '<ol>',
      '<li><strong>Длина маршрута:</strong> около 100 км</li>',
      '<li><strong>Высшая точка:</strong> гора Броккен (1 142 м)</li>',
      '</ol>',
    ].join(''));

    const props = renderHTMLProps[renderHTMLProps.length - 1];
    expect(props.source.html).toContain('около 100 км');
    expect(props.source.html).toContain('гора Броккен (1 142 м)');
    expect(props.tagsStyles?.li).toMatchObject({
      flexShrink: 1,
      minWidth: 0,
      maxWidth: '100%',
    });
    expect(props.renderersProps?.ol?.enableDynamicMarkerBoxWidth).toBe(true);
  });

  it('android: FAQ details/summary регистрируются как раскрываемый native renderer', () => {
    setPlatformOs('android');
    renderNative('<details><summary>Вопрос?</summary><p>Ответ.</p></details>');

    const props = renderHTMLProps[renderHTMLProps.length - 1];
    expect(props.source.html).toContain('<details>')
    expect(props.source.html).toContain('<summary>Вопрос?</summary>')
    expect(props.customHTMLElementModels?.details).toMatchObject({
      tagName: 'details',
      contentModel: 'block',
    })
    expect(props.customHTMLElementModels?.summary).toMatchObject({
      tagName: 'summary',
      contentModel: 'mixed',
    })
    expect(typeof props.renderers?.details).toBe('function')
  });

  it('android: заголовок FAQ извлекается из исходного details DOM после hoisting', () => {
    const { __testables } = require('@/components/travel/stableContent/useRenderConfig');
    const detailsDomNode = {
      type: 'tag',
      children: [
        {
          type: 'tag',
          name: 'summary',
          children: [
            {
              type: 'tag',
              children: [{ type: 'text', data: '  Сколько времени ' }],
            },
            { type: 'text', data: 'нужно?  ' },
          ],
        },
        {
          type: 'tag',
          name: 'p',
          children: [{ type: 'text', data: 'Ответ.' }],
        },
      ],
    };

    expect(__testables.getDetailsSummaryText(undefined, detailsDomNode).replace(/\s+/g, ' ').trim())
      .toBe('Сколько времени нужно?');
  });

  it('android: заголовок FAQ извлекается из transient summary, когда он доступен', () => {
    const { __testables } = require('@/components/travel/stableContent/useRenderConfig');
    const summaryNode = {
      type: 'phrasing',
      children: [
        {
          type: 'tag',
          children: [{ type: 'text', data: 'Когда ехать?' }],
        },
      ],
    };

    expect(__testables.getDetailsSummaryText(summaryNode)).toBe('Когда ехать?');
  });

  it('android: hoisted summary не дублируется в раскрытом ответе', () => {
    const { __testables } = require('@/components/travel/stableContent/useRenderConfig');
    const questionNode = {
      type: 'phrasing',
      children: [{ type: 'text', data: 'Когда ехать?' }],
    };
    const answerNode = {
      type: 'block',
      children: [{ type: 'text', data: 'Весной.' }],
    };

    expect(
      __testables.getDetailsAnswerNodes(
        [questionNode, answerNode],
        undefined,
        'Когда ехать?'
      )
    ).toEqual([answerNode]);
  });

  it('android: onPress внутренней ссылки ведёт через router.push внутри приложения', () => {
    setPlatformOs('android');
    renderNative();

    const props = renderHTMLProps[renderHTMLProps.length - 1];
    const onPress = props.renderersProps?.a?.onPress;
    expect(typeof onPress).toBe('function');

    onPress({}, 'https://metravel.by/travels/test');
    const { router } = require('expo-router');
    expect(router.push).toHaveBeenCalledWith('/travels/test');
  });

  it('android: относительный href, нормализованный RNRH в about:/// — тоже router.push', () => {
    setPlatformOs('android');
    renderNative();

    const props = renderHTMLProps[renderHTMLProps.length - 1];
    props.renderersProps.a.onPress({}, 'about:///travels/oriavskii-zamok');
    const { router } = require('expo-router');
    expect(router.push).toHaveBeenCalledWith('/travels/oriavskii-zamok');
  });
});
