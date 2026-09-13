import React from 'react';
import renderer, { act } from 'react-test-renderer';

// Регресс-страж #1885: Dynamic Type меняет кегль уже отрисованного тела статьи,
// но react-native-render-html держит прежний замер строк — на iPhone хвост
// абзаца обрезался по старой коробке посреди слова («в среднем про», «GR21
// получ»). Лечится пересозданием дерева вместе с `fontScale`, поэтому страж
// считает МОНТАЖИ RenderHTML, а не его пропсы. Отдельный кейс ниже держит цену
// новой подписки на Dimensions: ре-рендер без смены пропсов не должен менять
// identity конфиг-пропов RNRH.

const mounts: string[] = [];
const renders: Record<string, any>[] = [];

jest.mock('react-native-render-html', () => {
  const ReactLocal = require('react');
  return {
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
    default: function RenderHTMLMock(props: any) {
      renders.push(props);
      ReactLocal.useEffect(() => {
        mounts.push(props.source.html);
      }, []);
      return null;
    },
  };
});

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

// В проде `useThemedColors` мемоизирован по теме и отдаёт ту же ссылку, поэтому
// и мок обязан быть стабильным: иначе страж identity ниже проверял бы мок, а не
// компонент.
jest.mock('@/hooks/useTheme', () => {
  const colors = {
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
  };
  return { useThemedColors: () => colors };
});

jest.mock('@/components/travel/FullscreenGallery', () => ({
  __esModule: true,
  default: () => null,
}));

describe('StableContent (native) и системный размер шрифта', () => {
  const html = '<p>Около 180 км, которые в среднем проходят за девять дней.</p>';

  // Настоящий `useWindowDimensions` сам перерисовывает подписчика, когда система
  // меняет размер текста. Подменяем его таким же подписчиком: иначе `memo` на
  // StableContent проглотит обновление и страж проверит не то.
  let applyDimensions: ((next: { width: number; height: number; scale: number; fontScale: number }) => void) | null = null;

  const mockWindowDimensions = (fontScale: number) => {
    const useWindowDimensions = require('react-native').useWindowDimensions as jest.Mock;
    const initial = { width: 375, height: 812, scale: 3, fontScale };
    useWindowDimensions.mockImplementation(() => {
      const [dimensions, setDimensions] = React.useState(initial);
      React.useEffect(() => {
        applyDimensions = setDimensions;
        return () => {
          applyDimensions = null;
        };
      }, []);
      return dimensions;
    });
  };

  const renderNative = () => {
    const StableContent = require('@/components/travel/StableContent').default;
    act(() => {
      renderer.create(<StableContent html={html} contentWidth={343} />);
    });
  };

  const setFontScale = (fontScale: number) => {
    act(() => {
      applyDimensions?.({ width: 375, height: 812, scale: 3, fontScale });
    });
  };

  afterEach(() => {
    mounts.length = 0;
    renders.length = 0;
    applyDimensions = null;
    jest.clearAllMocks();
  });

  it('пересоздаёт дерево RenderHTML при смене fontScale — иначе хвост абзаца режется по старому замеру', () => {
    mockWindowDimensions(1);
    renderNative();
    expect(mounts).toHaveLength(1);

    setFontScale(1.35);

    expect(mounts).toHaveLength(2);
  });

  it('не пересоздаёт дерево, пока fontScale прежний', () => {
    mockWindowDimensions(1);
    renderNative();
    expect(mounts).toHaveLength(1);

    setFontScale(1);

    // Событие Dimensions действительно перерисовало компонент (renders вырос),
    // но дерево осталось прежним — ключ не дёргается на каждый рендер.
    expect(renders.length).toBeGreaterThan(1);
    expect(mounts).toHaveLength(1);
  });

  // Подписка на Dimensions добавила ре-рендеры без смены пропсов (поворот,
  // клавиатура). Конфиг RNRH сравнивается по identity: новый `ignoredDomTags`
  // пересобирает движок и заново парсит весь HTML, новые `renderers` —
  // реестр рендереров, новый `defaultTextProps` — общие пропсы. Тогда memo
  // RenderHTMLSource не спасает и тело статьи перерисовывается целиком.
  it('ре-рендер без смены пропсов не пересобирает конфиг RNRH', () => {
    mockWindowDimensions(1);
    renderNative();

    setFontScale(1);

    expect(renders.length).toBeGreaterThan(1);
    const first = renders[0];
    const last = renders[renders.length - 1];
    for (const prop of [
      'ignoredDomTags',
      'renderers',
      'defaultTextProps',
      'customHTMLElementModels',
      'renderersProps',
      'baseStyle',
      'tagsStyles',
      'classesStyles',
    ]) {
      expect(last[prop]).toBe(first[prop]);
    }
  });
});
