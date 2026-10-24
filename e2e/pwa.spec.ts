import {chromium, expect, Page, test} from "@playwright/test";
import {relaySignalling} from "./support/signalling";
import {messageInput, openAsHost, partsOf, shareLinkInput} from "./support/conversation";

test.use({serviceWorkers: 'allow'});

/** Waits until the service worker runs the page, which it takes over on the first visit. */
async function controlled(page: Page): Promise<void> {
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
}

test('can be installed as an app', async ({baseURL}) => {
    // Chrome only checks in the full browser, not the headless shell, and not
    // in the throwaway contexts the other tests get, which count as incognito.
    const context = await chromium.launchPersistentContext(test.info().outputPath('profile'), {channel: 'chromium', baseURL});

    try {
        await relaySignalling(context);
        const page = await context.newPage();
        await page.goto('/');

        // What Chrome checks before it offers to install a site.
        const devTools = await context.newCDPSession(page);
        const {installabilityErrors} = await devTools.send('Page.getInstallabilityErrors');

        expect(installabilityErrors).toEqual([]);
    } finally {
        await context.close();
    }
});

test('has its icons in the sizes the manifest gives', async ({request}) => {
    const manifest = await (await request.get('/manifest.json')).json();

    for (const icon of manifest.icons) {
        const png = await (await request.get('/' + icon.src)).body();

        // A PNG's width and height follow its signature and the IHDR header.
        expect(png.readUInt32BE(16) + 'x' + png.readUInt32BE(20)).toBe(icon.sizes);
    }
});

test('opens without a connection', async ({context, page}) => {
    await relaySignalling(context);
    await page.goto('/');
    await controlled(page);

    await context.setOffline(true);
    const response = await page.reload();

    expect(response.fromServiceWorker()).toBe(true);
    // The stand-in signalling server answers even offline, so this is the
    // script come out of the cache and running, not the real server's absence.
    await expect(page.getByRole('heading', {name: 'Start a private chat'})).toBeVisible();
    // Styled, so the stylesheet came out of the cache too.
    await expect(page.locator('.navbar')).toHaveCSS('background-color', 'rgb(0, 209, 178)');
});

test('keeps the chat’s key out of the cache', async ({context}) => {
    const host = await openAsHost(context);
    await controlled(host);

    const link = await shareLinkInput(host).inputValue();
    const guest = await context.newPage();
    const response = await guest.goto('/#' + link.split('#')[1]);

    // Otherwise the cache would never have seen the link.
    expect(response.fromServiceWorker()).toBe(true);
    // In the chat, so the page is long done and stored.
    await expect(messageInput(guest)).toBeVisible({timeout: 20_000});

    const cached = await guest.evaluate(async () => {
        const urls: string[] = [];

        for (const name of await caches.keys()) {
            for (const request of await (await caches.open(name)).keys()) {
                urls.push(request.url);
            }
        }

        return urls;
    });

    expect(cached.filter(url => url.includes(partsOf(link).secret))).toEqual([]);
    expect(cached).toContain(new URL('/', guest.url()).href);
});
