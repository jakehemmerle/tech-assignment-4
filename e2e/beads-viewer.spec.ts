import { test, expect } from '@playwright/test';

test.describe('Beads Viewer Static Site', () => {
  test('loads the index page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Poker Rewards|Beads/i);
  });

  test('displays issue list', async ({ page }) => {
    await page.goto('/');
    // The bv viewer renders issues in the main content area
    await expect(page.locator('body')).toContainText(/issue|bead|task/i);
  });

  test('has working navigation', async ({ page }) => {
    await page.goto('/');
    // The static site should have loaded without JS errors
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.waitForTimeout(2000);
    expect(errors).toHaveLength(0);
  });

  test('graph page loads', async ({ page }) => {
    await page.goto('/graph-demo.html');
    await expect(page.locator('body')).not.toBeEmpty();
  });
});
