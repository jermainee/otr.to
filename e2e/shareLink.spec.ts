import {expect, test} from "@playwright/test";
import {messageInput, openAsHost, shareLinkInput} from "./support/conversation";

test.describe('Waiting for someone to join', () => {
    test('offers a link built from the peer the browser just registered', async ({context}) => {
        const host = await openAsHost(context);

        const link = await shareLinkInput(host).inputValue();
        const peerId = link.split('#')[1];

        expect(peerId).toHaveLength(22);
        await expect(host.getByRole('heading', {name: 'Start chatting'})).toBeVisible();
        await expect(messageInput(host)).toHaveCount(0);
    });

    test('hands that link to the share buttons', async ({context}) => {
        const host = await openAsHost(context);

        const link = await shareLinkInput(host).inputValue();

        await expect(host.getByRole('link', {name: 'Telegram'}))
            .toHaveAttribute('href', 'https://telegram.me/share/url?url=' + link);
        await expect(host.getByRole('link', {name: 'WhatsApp'}))
            .toHaveAttribute('href', 'https://wa.me/?text=' + link);
        await expect(host.getByRole('link', {name: 'E-Mail'}))
            .toHaveAttribute('href', 'mailto:?subject=&body=' + link);
    });

    test('copies that link to the clipboard', async ({context}) => {
        const host = await openAsHost(context);

        const link = await shareLinkInput(host).inputValue();
        await host.getByRole('button', {name: 'Copy link'}).click();

        await expect(host.getByText('Copied!')).toBeVisible();
        expect(await host.evaluate(() => navigator.clipboard.readText())).toBe(link);
    });

    test('explains itself while there is nothing else to do', async ({context}) => {
        const host = await openAsHost(context);

        await expect(host.getByRole('heading', {name: 'How it works'})).toBeVisible();
        await expect(host.getByText('Peer to peer communication')).toBeVisible();
        await expect(host.getByText('No chat history')).toBeVisible();
        await expect(host.getByRole('link', {name: 'View on GitHub'}))
            .toHaveAttribute('href', 'https://github.com/jermainee/otr.to');
    });
});
