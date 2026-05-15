import { expect, test } from '@playwright/test';
import { accessHeaders } from './support/access-auth';

test('timeline renders metric line, event marker, post marker, and chronological log from seeded D1 data', async ({
  page
}) => {
  await page.setExtraHTTPHeaders(await accessHeaders());
  await page.goto(
    '/timeline?since=2026-04-01&until=2026-05-04&sources=github-glockyco,steam-reviews-erenshor&overlay=posts,events',
    { waitUntil: 'domcontentloaded' }
  );

  await expect(page.getByRole('heading', { name: 'Timeline' })).toBeVisible();
  await expect(page.getByTestId('timeline-chart')).toBeVisible();
  await expect(page.getByTestId('timeline-chart').locator('svg').last()).toBeVisible();
  await expect(page.getByTestId('timeline-event-marker')).toContainText('Events');
  await expect(page.getByTestId('timeline-post-marker')).toContainText('Posts');
  await expect(page.getByTestId('timeline-log')).toContainText('Great update');
  await expect(page.getByTestId('timeline-log')).toContainText('Release notes');
});
