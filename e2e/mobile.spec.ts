import { expect, test } from '@playwright/test';
import { accessHeaders } from './support/access-auth';

test('core pages remain usable on a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setExtraHTTPHeaders(await accessHeaders());

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
  const refreshBox = await page.getByRole('button', { name: 'Refresh' }).first().boundingBox();
  expect(refreshBox?.height).toBeGreaterThanOrEqual(44);
  const firstTile = await page.locator('[data-source-id]').first().boundingBox();
  expect(firstTile?.width).toBeLessThanOrEqual(390);

  await page.goto('/posts', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('link', { name: 'Release notes' })).toBeVisible();

  await page.goto('/timeline?since=2026-04-01&until=2026-05-04&sources=github-glockyco,steam-reviews-erenshor&overlay=posts,events', { waitUntil: 'domcontentloaded' });
  const chartScroll = await page.getByTestId('timeline-chart').evaluate((element) => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }));
  expect(chartScroll.scrollWidth).toBeGreaterThanOrEqual(720);
});
