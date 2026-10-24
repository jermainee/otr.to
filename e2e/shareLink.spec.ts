import {expect, test} from "@playwright/test";
import {messageInput, openAsHost, partsOf, shareLinkInput} from "./support/conversation";

test.describe('Waiting for someone to join', () => {
    test('offers a link built from the peer the browser just registered and the chat’s secret', async ({context}) => {
        const host = await openAsHost(context);

        const link = await shareLinkInput(host).inputValue();
        const {peerId, secret} = partsOf(link);

        expect(peerId).toHaveLength(22);
        expect(secret).toMatch(/^[0-9A-Za-z]{22}$/);
        await expect(host.getByRole('heading', {name: 'Start a private chat'})).toBeVisible();
        await expect(host.getByRole('status')).toHaveText('Waiting for someone to open the link');
        await expect(messageInput(host)).toHaveCount(0);
    });

    test('hands that link to the share buttons, peer id included', async ({context}) => {
        const host = await openAsHost(context);

        const link = await shareLinkInput(host).inputValue();
        const shared = encodeURIComponent(link);

        await expect(host.getByRole('link', {name: 'Telegram'}))
            .toHaveAttribute('href', 'https://telegram.me/share/url?url=' + shared);
        await expect(host.getByRole('link', {name: 'WhatsApp'}))
            .toHaveAttribute('href', 'https://wa.me/?text=' + shared);
        await expect(host.getByRole('link', {name: 'Email'}))
            .toHaveAttribute('href', 'mailto:?subject=&body=' + shared);

        // What a share target reads back out of its query string.
        const telegram = await host.getByRole('link', {name: 'Telegram'}).getAttribute('href');
        expect(new URL(telegram).searchParams.get('url')).toBe(link);
    });

    test('copies that link to the clipboard', async ({context}) => {
        const host = await openAsHost(context);

        const link = await shareLinkInput(host).inputValue();
        await host.getByRole('button', {name: 'Copy link'}).click();

        await expect(host.getByRole('button', {name: 'Link copied'})).toBeVisible();
        await expect(host.getByRole('status')).toHaveText('Link copied. Waiting for someone to open it');
        expect(await host.evaluate(() => navigator.clipboard.readText())).toBe(link);
    });

    test('explains itself while there is nothing else to do', async ({context}) => {
        const host = await openAsHost(context);

        await expect(host.getByRole('heading', {name: 'Features'})).toBeVisible();
        await expect(host.getByRole('heading', {name: 'End-to-end encrypted'})).toBeVisible();
        await expect(host.getByRole('heading', {name: 'Group chats'})).toBeVisible();
        await expect(host.getByRole('link', {name: 'View on GitHub'}))
            .toHaveAttribute('href', 'https://github.com/jermainee/otr.to');
    });
});
