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

