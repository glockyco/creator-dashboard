import { expect, test } from '@playwright/test';
import { accessHeaders } from './support/access-auth';

test('settings persist theme, date range, and identity colors in localStorage', async ({ page }) => {
  await page.setExtraHTTPHeaders(await accessHeaders());
  await page.goto('/settings', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await page.getByRole('button', { name: 'Light' }).click();
  await page.getByLabel('Default date range').selectOption('7d');
  await page.locator('input[type="color"]').first().fill('#111111');

  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('light');
  await page.reload({ waitUntil: 'domcontentloaded' });

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('creator-dashboard-settings') ?? '{}'));
  expect(stored).toMatchObject({ theme: 'light', defaultDateRange: '7d', identityColors: { glockyco: '#111111' } });
  await expect(page.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'true');
});
