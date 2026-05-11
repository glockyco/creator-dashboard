import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { accessHeaders } from "./support/access-auth";

async function openDrawerNav(page: Page) {
  await page.getByRole("button", { name: "Open navigation" }).click();
  const nav = page.getByRole("navigation", { name: "Primary" });
  await expect(nav).toBeVisible();
  return nav;
}

test("core pages remain usable on a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setExtraHTTPHeaders(await accessHeaders());

  await page.goto("/", { waitUntil: "domcontentloaded" });
  let primaryNav = await openDrawerNav(page);
  await expect(
    primaryNav.getByRole("link", { name: /Dashboard/ }),
  ).toHaveAttribute("aria-current", "page");
  await expect(primaryNav.getByRole("link", { name: "Settings" })).toBeVisible();
  await page.keyboard.press("Escape");

  const refreshBox = await page
    .getByRole("button", { name: /^Refresh/ })
    .first()
    .boundingBox();
  expect(refreshBox?.height).toBeGreaterThanOrEqual(44);
  const firstTile = await page
    .locator("[data-source-id]")
    .first()
    .boundingBox();
  expect(firstTile?.width).toBeLessThanOrEqual(390);

  await page.goto("/sources/github-glockyco", {
    waitUntil: "domcontentloaded",
  });
  primaryNav = await openDrawerNav(page);
  await expect(
    primaryNav.getByRole("link", { name: /Dashboard/ }),
  ).toHaveAttribute("aria-current", "page");
  await page.keyboard.press("Escape");

  await page.goto("/health", { waitUntil: "domcontentloaded" });
  primaryNav = await openDrawerNav(page);
  await expect(
    primaryNav.getByRole("link", { name: /Health/ }),
  ).toHaveAttribute("aria-current", "page");
  await page.keyboard.press("Escape");

  await page.goto("/posts", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("link", { name: "Release notes" })).toBeVisible();
  primaryNav = await openDrawerNav(page);
  await expect(primaryNav.getByRole("link", { name: /Posts/ })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.keyboard.press("Escape");

  await page.goto(
    "/timeline?since=2026-04-01&until=2026-05-04&sources=github-glockyco,steam-reviews-erenshor&overlay=posts,events",
    { waitUntil: "domcontentloaded" },
  );
  primaryNav = await openDrawerNav(page);
  await expect(
    primaryNav.getByRole("link", { name: /Timeline/ }),
  ).toHaveAttribute("aria-current", "page");
  await page.keyboard.press("Escape");

  const chartScroll = await page
    .getByTestId("timeline-chart")
    .evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
  expect(chartScroll.scrollWidth).toBeGreaterThanOrEqual(720);
});
