import { expect, test } from '@playwright/test';
import { accessHeaders } from './support/access-auth';

test('bottom navigation reaches each product surface on a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setExtraHTTPHeaders(await accessHeaders());
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const nav = page.getByRole('navigation', { name: 'Mobile primary' });
  await expect(nav.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
  const bounds = await nav.boundingBox();
  expect(bounds?.width).toBeLessThanOrEqual(390);

  await nav.getByRole('link', { name: 'Activity' }).click();
  await expect(page.getByRole('heading', { name: 'Activity' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Activity' })).toHaveAttribute('aria-current', 'page');

  await nav.getByRole('link', { name: /^Issues/ }).click();
  await expect(page.getByRole('heading', { name: 'Issues', exact: true })).toBeVisible();
  await expect(nav.getByRole('link', { name: /^Issues/ })).toHaveAttribute('aria-current', 'page');
});
