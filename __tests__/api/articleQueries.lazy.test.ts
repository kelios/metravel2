/** Header breadcrumbs must not initialize the article transport on other routes. */
it('loads the article transport only when the enabled query executes', async () => {
  const articleModule = jest.fn(() => ({
    fetchArticle: jest.fn(async () => ({ id: 1 })),
    fetchArticleBySlug: jest.fn(),
  }));
  try {
    await jest.isolateModulesAsync(async () => {
      jest.doMock('@/api/articles', articleModule);
      const { articleQueryOptions } = await import('@/api/articleQueries');
      const disabled = articleQueryOptions(null);
      const enabled = articleQueryOptions('1');
      expect(disabled.enabled).toBe(false);
      expect(articleModule).not.toHaveBeenCalled();
      await expect(enabled.queryFn({ signal: new AbortController().signal })).resolves.toHaveProperty('id', 1);
      expect(articleModule).toHaveBeenCalledTimes(1);
    });
  } finally {
    jest.dontMock('@/api/articles');
  }
});
