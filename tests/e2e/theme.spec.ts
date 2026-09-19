import { expect, test } from "@playwright/test";

/**
 * Theme jour / nuit : celui du systeme de l'appareil par defaut, suivi en
 * direct, et un ancien clic ne le fige plus pour toujours.
 */

test.beforeEach(async ({ context }) => {
  await context.route(
    (url) => url.hostname !== "127.0.0.1",
    (route) => route.abort()
  );
});

const html = (page: import("@playwright/test").Page) => page.locator("html");

test("suit le thème du système, et son changement sans recharger", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await expect(html(page)).not.toHaveClass(/\bdark\b/);

  await page.emulateMedia({ colorScheme: "dark" });
  await expect(html(page)).toHaveClass(/\bdark\b/);

  await page.emulateMedia({ colorScheme: "light" });
  await expect(html(page)).not.toHaveClass(/\bdark\b/);
});

test("un ancien choix « nuit » s'efface en revenant au thème du système", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("init")) {
      sessionStorage.setItem("init", "1");
      localStorage.setItem("bethel-theme", "dark");
    }
  });
  await page.goto("/");
  await expect(html(page)).toHaveClass(/\bdark\b/);

  await page.getByRole("button", { name: "Passer en mode jour" }).first().click();
  await expect(html(page)).not.toHaveClass(/\bdark\b/);
  expect(await page.evaluate(() => localStorage.getItem("bethel-theme"))).toBeNull();

  // De nouveau lie au systeme : il suit le passage en sombre.
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(html(page)).toHaveClass(/\bdark\b/);
});

test("un choix contraire au système est retenu d'une page à l'autre", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await page.getByRole("button", { name: "Passer en mode nuit" }).first().click();
  await expect(html(page)).toHaveClass(/\bdark\b/);

  await page.goto("/boutique");
  await expect(html(page)).toHaveClass(/\bdark\b/);
});
