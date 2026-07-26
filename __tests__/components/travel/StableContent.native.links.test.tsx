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
