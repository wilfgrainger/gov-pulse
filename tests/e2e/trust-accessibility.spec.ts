import { expect, test } from "@playwright/test";

test("editorial trust pages provide a keyboard path past the shared navigation", async ({ page }) => {
  for (const path of ["/about", "/editorial-policy", "/independence", "/contact", "/corrections"]) {
    await page.goto(`.${path}`);
    const skipLink = page.getByRole("link", { name: "Skip to page content" });
    await page.keyboard.press("Tab");
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toHaveAttribute("href", "#main-content");
    await expect(page.locator("main#main-content")).toBeVisible();
  }
});
