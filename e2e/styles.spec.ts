import {expect, test} from "@playwright/test";

test('the page is styled before the script arrives', async ({page}) => {
    // Hold the bundle back, the way a slow connection would.
    await page.route('**/dist/bundle.js*', route => route.abort());
    await page.goto('/');

    // Bulma's turquoise from the stylesheet, not a blue link on a white page.
    await expect(page.locator('.navbar')).toHaveCSS('background-color', 'rgb(0, 209, 178)');
    await expect(page.locator('#root')).toBeEmpty();
});
