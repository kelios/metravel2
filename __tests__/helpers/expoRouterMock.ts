export const mockPush = jest.fn();
export const mockReplace = jest.fn();
export const mockBack = jest.fn();
export const mockCanGoBack = jest.fn(() => true);
export const mockUsePathname = jest.fn(() => '/subscriptions');

export const mockUseRouter = jest.fn(() => ({
  push: mockPush,
  replace: mockReplace,
  back: mockBack,
  canGoBack: mockCanGoBack,
}));

export const resetExpoRouterMocks = () => {
  mockPush.mockReset();
  mockReplace.mockReset();
  mockBack.mockReset();
  mockCanGoBack.mockReset();
  mockCanGoBack.mockReturnValue(true);
  mockUsePathname.mockReset();
  mockUsePathname.mockReturnValue('/subscriptions');
  mockUseRouter.mockReset();
  mockUseRouter.mockReturnValue({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
    canGoBack: mockCanGoBack,
  });
};


// Мок `Link` для файлов, которые подменяют `expo-router` целиком: компоненты на
// `LinkPressable` (`<Link href asChild>`) без него падают с «Element type is
// invalid» (#3281). Повторяет контракт настоящего Link: с `asChild` отдаёт
// единственного ребёнка с `href`, без него — обёртку-ссылку.
export const mockExpoRouterLink = ({ href, asChild, children, ...props }: {
  href: unknown;
  asChild?: boolean;
  children?: unknown;
  [prop: string]: unknown;
}) => {
  const React = require('react');
  if (asChild) return React.cloneElement(React.Children.only(children), { ...props, href });
  const { Pressable } = require('react-native');
  return React.createElement(Pressable, { accessibilityRole: 'link', ...props, href }, children);
};

// Модульный `router` из `expo-router` (его читает `LinkPressable` на web).
export const mockExpoRouterSingleton = { push: mockPush, replace: mockReplace, back: mockBack };
