export const mockPush = jest.fn();
export const mockReplace = jest.fn();

export const mockUseRouter = jest.fn(() => ({
  push: mockPush,
  replace: mockReplace,
}));

export const resetExpoRouterMocks = () => {
  mockPush.mockReset();
  mockReplace.mockReset();
  mockUseRouter.mockReset();
  mockUseRouter.mockReturnValue({
    push: mockPush,
    replace: mockReplace,
  });
};

