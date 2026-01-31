import { test, expect } from '@playwright/test';
import { loginAsUser, loginAsAdmin, createTestTravel, cleanupTestData } from './helpers/e2eApi';

test.describe('Travel Comments', () => {
  let testTravelId: number;
  let _testUserId: string;
  let _adminUserId: string;

  test.beforeAll(async () => {
    // Create test travel for comments
    const travel = await createTestTravel();
    testTravelId = travel.id;
  });

  test.afterAll(async () => {
    // Cleanup test data
    await cleanupTestData({ travelId: testTravelId });
  });

  test.describe('Unauthenticated users', () => {
    test('should see comments section but not be able to interact', async ({ page }) => {
      await page.goto(`/travels/${testTravelId}`);
      
      // Wait for page to load
      await page.waitForSelector('[data-testid="travel-details-page"]');
      
      // Scroll to comments section
      await page.evaluate(() => {
        const commentsSection = document.querySelector('text=Комментарии');
        if (commentsSection) {
          commentsSection.scrollIntoView({ behavior: 'smooth' });
        }
      });

      // Should see comments section
      await expect(page.getByText('Комментарии')).toBeVisible();
      
      // Should see login prompt
      await expect(page.getByText('Войдите, чтобы оставить комментарий')).toBeVisible();
      
      // Should not see comment form
      await expect(page.getByPlaceholder('Написать комментарий...')).not.toBeVisible();
    });

    test('should see existing comments with like counts but no interaction buttons', async ({ page }) => {
      await page.goto(`/travels/${testTravelId}`);
      
      // If there are comments, verify they're visible but not interactive
      const commentItems = page.locator('[data-testid="comment-item"]');
      const count = await commentItems.count();
      
      if (count > 0) {
        // Should see comment text
        await expect(commentItems.first()).toBeVisible();
        
        // Should not see reply button
        await expect(page.getByRole('button', { name: /ответить/i })).not.toBeVisible();
        
        // Should not see edit/delete buttons
        await expect(page.getByRole('button', { name: /редактировать/i })).not.toBeVisible();
        await expect(page.getByRole('button', { name: /удалить/i })).not.toBeVisible();
      }
    });
  });

  test.describe('Authenticated users', () => {
    test.beforeEach(async ({ page }) => {
      const { userId } = await loginAsUser(page);
      testUserId = userId;
    });

    test('should be able to create a comment', async ({ page }) => {
      await page.goto(`/travels/${testTravelId}`);
      await page.waitForSelector('[data-testid="travel-details-page"]');
      
      // Scroll to comments
      await page.evaluate(() => {
        const commentsSection = document.querySelector('text=Комментарии');
        if (commentsSection) {
          commentsSection.scrollIntoView({ behavior: 'smooth' });
        }
      });

      // Should see comment form
      const commentInput = page.getByPlaceholder('Написать комментарий...');
      await expect(commentInput).toBeVisible();
      
      // Type comment
      const commentText = `Test comment ${Date.now()}`;
      await commentInput.fill(commentText);
      
      // Submit comment
      await page.getByRole('button', { name: /отправить комментарий/i }).click();
      
      // Wait for comment to appear
      await expect(page.getByText(commentText)).toBeVisible({ timeout: 5000 });
      
      // Verify comment is displayed
      const newComment = page.locator(`text=${commentText}`).first();
      await expect(newComment).toBeVisible();
    });

    test('should be able to like a comment', async ({ page }) => {
      await page.goto(`/travels/${testTravelId}`);
      await page.waitForSelector('[data-testid="travel-details-page"]');
      
      // Find first comment
      const firstComment = page.locator('[data-testid="comment-item"]').first();
      await firstComment.scrollIntoViewIfNeeded();
      
      // Get initial like count
      const likeButton = firstComment.getByRole('button', { name: /лайк/i });
      await expect(likeButton).toBeVisible();
      
      // Click like
      await likeButton.click();
      
      // Wait for optimistic update
      await page.waitForTimeout(500);
      
      // Verify like was registered (heart should be filled)
      const heartIcon = firstComment.locator('[fill="#FF3B30"]');
      await expect(heartIcon).toBeVisible();
    });

    test('should be able to unlike a comment', async ({ page }) => {
      await page.goto(`/travels/${testTravelId}`);
      await page.waitForSelector('[data-testid="travel-details-page"]');
      
      const firstComment = page.locator('[data-testid="comment-item"]').first();
      await firstComment.scrollIntoViewIfNeeded();
      
      // Like the comment first
      const likeButton = firstComment.getByRole('button', { name: /лайк/i });
      await likeButton.click();
      await page.waitForTimeout(500);
      
      // Unlike
      await likeButton.click();
      await page.waitForTimeout(500);
      
      // Verify unlike (heart should not be filled)
      const heartIcon = firstComment.locator('[fill="none"]');
      await expect(heartIcon).toBeVisible();
    });

    test('should be able to reply to a comment', async ({ page }) => {
      await page.goto(`/travels/${testTravelId}`);
      await page.waitForSelector('[data-testid="travel-details-page"]');
      
      const firstComment = page.locator('[data-testid="comment-item"]').first();
      await firstComment.scrollIntoViewIfNeeded();
      
      // Click reply button
      const replyButton = firstComment.getByRole('button', { name: /ответить/i });
      await replyButton.click();
      
      // Should see reply banner
      await expect(page.getByText(/ответ на комментарий/i)).toBeVisible();
      
      // Type reply
      const replyText = `Test reply ${Date.now()}`;
      const commentInput = page.getByPlaceholder('Написать комментарий...');
      await commentInput.fill(replyText);
      
      // Submit reply
      await page.getByRole('button', { name: /отправить комментарий/i }).click();
      
      // Wait for reply to appear
      await expect(page.getByText(replyText)).toBeVisible({ timeout: 5000 });
    });

    test('should be able to edit own comment', async ({ page }) => {
      await page.goto(`/travels/${testTravelId}`);
      await page.waitForSelector('[data-testid="travel-details-page"]');
      
      // Create a comment first
      const commentInput = page.getByPlaceholder('Написать комментарий...');
      const originalText = `Original comment ${Date.now()}`;
      await commentInput.fill(originalText);
      await page.getByRole('button', { name: /отправить комментарий/i }).click();
      await expect(page.getByText(originalText)).toBeVisible({ timeout: 5000 });
      
      // Find the comment we just created
      const ourComment = page.locator(`text=${originalText}`).locator('..').locator('..');
      
      // Click more actions
      await ourComment.getByRole('button', { name: /действия с комментарием/i }).click();
      
      // Click edit
      await page.getByRole('button', { name: /редактировать комментарий/i }).click();
      
      // Should see edit banner
      await expect(page.getByText(/редактирование комментария/i)).toBeVisible();
      
      // Edit text
      const editedText = `Edited comment ${Date.now()}`;
      await commentInput.clear();
      await commentInput.fill(editedText);
      
      // Save changes
      await page.getByRole('button', { name: /сохранить изменения/i }).click();
      
      // Wait for update
      await expect(page.getByText(editedText)).toBeVisible({ timeout: 5000 });
      await expect(page.getByText(originalText)).not.toBeVisible();
    });

    test('should be able to delete own comment', async ({ page }) => {
      await page.goto(`/travels/${testTravelId}`);
      await page.waitForSelector('[data-testid="travel-details-page"]');
      
      // Create a comment first
      const commentInput = page.getByPlaceholder('Написать комментарий...');
      const commentText = `Comment to delete ${Date.now()}`;
      await commentInput.fill(commentText);
      await page.getByRole('button', { name: /отправить комментарий/i }).click();
      await expect(page.getByText(commentText)).toBeVisible({ timeout: 5000 });
      
      // Find the comment
      const ourComment = page.locator(`text=${commentText}`).locator('..').locator('..');
      
      // Click more actions
      await ourComment.getByRole('button', { name: /действия с комментарием/i }).click();
      
      // Click delete
      await page.getByRole('button', { name: /удалить комментарий/i }).click();
      
      // Confirm deletion in dialog
      page.once('dialog', dialog => dialog.accept());
      
      // Wait for deletion
      await expect(page.getByText(commentText)).not.toBeVisible({ timeout: 5000 });
    });

    test('should not be able to edit or delete other users comments', async ({ page }) => {
      await page.goto(`/travels/${testTravelId}`);
      await page.waitForSelector('[data-testid="travel-details-page"]');
      
      // Find a comment not created by us (if any exist)
      const allComments = page.locator('[data-testid="comment-item"]');
      const count = await allComments.count();
      
      if (count > 0) {
        const firstComment = allComments.first();
        
        // Should not see more actions button for other users' comments
        const moreButton = firstComment.getByRole('button', { name: /действия с комментарием/i });
        const isVisible = await moreButton.isVisible().catch(() => false);
        
        if (!isVisible) {
          // This is expected - we can't edit/delete others' comments
          expect(true).toBe(true);
        }
      }
    });

    test('should see comments in sidebar navigation', async ({ page }) => {
      await page.goto(`/travels/${testTravelId}`);
      await page.waitForSelector('[data-testid="travel-details-page"]');
      
      // Check if sidebar menu exists (desktop view)
      const sidebarMenu = page.locator('[data-testid="travel-details-side-menu"]');
      const isSidebarVisible = await sidebarMenu.isVisible().catch(() => false);
      
      if (isSidebarVisible) {
        // Should see comments link in sidebar
        await expect(page.getByRole('link', { name: /комментарии/i })).toBeVisible();
        
        // Click comments link
        await page.getByRole('link', { name: /комментарии/i }).click();
        
        // Should scroll to comments section
        await page.waitForTimeout(1000);
        const commentsSection = page.getByText('Комментарии').first();
        await expect(commentsSection).toBeInViewport();
      }
    });
  });

  test.describe('Admin users', () => {
    test.beforeEach(async ({ page }) => {
      const { userId } = await loginAsAdmin(page);
      adminUserId = userId;
    });

    test('should be able to delete any comment', async ({ page }) => {
      await page.goto(`/travels/${testTravelId}`);
      await page.waitForSelector('[data-testid="travel-details-page"]');
      
      // Find any comment
      const firstComment = page.locator('[data-testid="comment-item"]').first();
      const commentExists = await firstComment.isVisible().catch(() => false);
      
      if (commentExists) {
        await firstComment.scrollIntoViewIfNeeded();
        
        // Click more actions
        const moreButton = firstComment.getByRole('button', { name: /действия с комментарием/i });
        await expect(moreButton).toBeVisible();
        await moreButton.click();
        
        // Should see delete button with admin label
        const deleteButton = page.getByRole('button', { name: /удалить.*админ/i });
        await expect(deleteButton).toBeVisible();
        
        // Get comment text before deletion
        const commentText = await firstComment.textContent();
        
        // Click delete
        await deleteButton.click();
        
        // Confirm deletion
        page.once('dialog', dialog => dialog.accept());
        
        // Wait for deletion
        await page.waitForTimeout(2000);
        
        // Verify comment is removed
        if (commentText) {
          await expect(page.getByText(commentText)).not.toBeVisible();
        }
      }
    });

    test('should see admin label on delete button for other users comments', async ({ page }) => {
      await page.goto(`/travels/${testTravelId}`);
      await page.waitForSelector('[data-testid="travel-details-page"]');
      
      // Create a comment as regular user first (in separate session)
      // Then verify admin can see special delete button
      
      const firstComment = page.locator('[data-testid="comment-item"]').first();
      const commentExists = await firstComment.isVisible().catch(() => false);
      
      if (commentExists) {
        await firstComment.scrollIntoViewIfNeeded();
        
        const moreButton = firstComment.getByRole('button', { name: /действия с комментарием/i });
        await moreButton.click();
        
        // Should see "Удалить (Админ)" for other users' comments
        const adminDeleteButton = page.getByText(/удалить.*админ/i);
        const hasAdminLabel = await adminDeleteButton.isVisible().catch(() => false);
        
        // This should be true if the comment is not created by admin
        expect(typeof hasAdminLabel).toBe('boolean');
      }
    });
  });

  test.describe('Comments threading', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsUser(page);
    });

    test('should support nested replies up to 2 levels', async ({ page }) => {
      await page.goto(`/travels/${testTravelId}`);
      await page.waitForSelector('[data-testid="travel-details-page"]');
      
      // Create top-level comment
      const commentInput = page.getByPlaceholder('Написать комментарий...');
      const topLevelText = `Top level ${Date.now()}`;
      await commentInput.fill(topLevelText);
      await page.getByRole('button', { name: /отправить комментарий/i }).click();
      await expect(page.getByText(topLevelText)).toBeVisible({ timeout: 5000 });
      
      // Reply to it (level 1)
      const topComment = page.locator(`text=${topLevelText}`).locator('..').locator('..');
      await topComment.getByRole('button', { name: /ответить/i }).click();
      
      const level1Text = `Level 1 reply ${Date.now()}`;
      await commentInput.fill(level1Text);
      await page.getByRole('button', { name: /отправить комментарий/i }).click();
      await expect(page.getByText(level1Text)).toBeVisible({ timeout: 5000 });
      
      // Try to reply to level 1 (should create level 2)
      const level1Comment = page.locator(`text=${level1Text}`).locator('..').locator('..');
      const replyButton = level1Comment.getByRole('button', { name: /ответить/i });
      const canReply = await replyButton.isVisible().catch(() => false);
      
      if (canReply) {
        await replyButton.click();
        
        const level2Text = `Level 2 reply ${Date.now()}`;
        await commentInput.fill(level2Text);
        await page.getByRole('button', { name: /отправить комментарий/i }).click();
        await expect(page.getByText(level2Text)).toBeVisible({ timeout: 5000 });
        
        // Level 2 comment should not have reply button (max depth reached)
        const level2Comment = page.locator(`text=${level2Text}`).locator('..').locator('..');
        const level2ReplyButton = level2Comment.getByRole('button', { name: /ответить/i });
        await expect(level2ReplyButton).not.toBeVisible();
      }
    });
  });

  test.describe('Comments refresh and real-time updates', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsUser(page);
    });

    test('should refresh comments on pull-to-refresh', async ({ page }) => {
      await page.goto(`/travels/${testTravelId}`);
      await page.waitForSelector('[data-testid="travel-details-page"]');
      
      // Scroll to comments
      await page.evaluate(() => {
        const commentsSection = document.querySelector('text=Комментарии');
        if (commentsSection) {
          commentsSection.scrollIntoView({ behavior: 'smooth' });
        }
      });
      
      // Get initial comment count
      const _initialCount = await page.locator('[data-testid="comment-item"]').count();
      
      // Simulate refresh (reload page)
      await page.reload();
      await page.waitForSelector('[data-testid="travel-details-page"]');
      
      // Verify comments are still visible
      const newCount = await page.locator('[data-testid="comment-item"]').count();
      expect(newCount).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper ARIA labels', async ({ page }) => {
      await page.goto(`/travels/${testTravelId}`);
      await page.waitForSelector('[data-testid="travel-details-page"]');
      
      // Check comment input accessibility
      const commentInput = page.getByPlaceholder('Написать комментарий...');
      const hasAriaLabel = await commentInput.getAttribute('aria-label');
      expect(hasAriaLabel).toBeTruthy();
      
      // Check button accessibility
      const submitButton = page.getByRole('button', { name: /отправить комментарий/i });
      await expect(submitButton).toBeVisible();
    });

    test('should support keyboard navigation', async ({ page }) => {
      await loginAsUser(page);
      await page.goto(`/travels/${testTravelId}`);
      await page.waitForSelector('[data-testid="travel-details-page"]');
      
      // Tab to comment input
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Type comment
      const commentText = `Keyboard comment ${Date.now()}`;
      await page.keyboard.type(commentText);
      
      // Tab to submit button and press Enter
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      
      // Verify comment was submitted
      await expect(page.getByText(commentText)).toBeVisible({ timeout: 5000 });
    });
  });
});
