import {expect, test} from "@playwright/test";
import {
    messageInput,
    notices,
    openConversation,
    ownMessages,
    peerMessages,
    send,
    shareLinkInput,
} from "./support/conversation";

test('a link turns two browsers into one conversation', async ({context}) => {
    const {host, guest, hostPeerId} = await openConversation(context);

    await expect(notices(host)).toHaveText(['Connected to Peer']);
    await expect(notices(guest)).toHaveText([/^Created Peer: /, 'Connected to Peer: ' + hostPeerId]);
});

test('the host trades the share link for a message input once someone joins', async ({context}) => {
    const {host} = await openConversation(context);

    await expect(host.getByRole('heading', {name: 'Start chatting'})).not.toBeVisible();
    await expect(messageInput(host)).toBeVisible();
});

test('messages travel both ways', async ({context}) => {
    const {host, guest} = await openConversation(context);

    await send(host, 'are you there?');
    await expect(peerMessages(guest)).toHaveText(['are you there?']);

    await send(guest, 'yes, right here');
    await expect(peerMessages(host)).toHaveText(['yes, right here']);
    await expect(ownMessages(host)).toHaveText(['are you there?']);
    await expect(ownMessages(guest)).toHaveText(['yes, right here']);
});

test('keeps the conversation in order and empties the input', async ({context}) => {
    const {host, guest} = await openConversation(context);

    await send(host, 'first');
    await expect(peerMessages(guest)).toHaveText(['first']);
    await send(host, 'second');

    await expect(peerMessages(guest)).toHaveText(['first', 'second']);
    await expect(messageInput(host)).toHaveValue('');
});

test('refuses to send an empty message', async ({context}) => {
    const {host, guest} = await openConversation(context);

    await messageInput(host).press('Enter');

    await expect(ownMessages(host)).toHaveCount(0);
    await expect(peerMessages(guest)).toHaveCount(0);
});


test('sends a visitor back to the start when the host is gone', async ({context}) => {
    const {host} = await openConversation(context);

    const stale = await host.context().newPage();
    await stale.goto('/#a-peer-that-is-long-gone');

    await expect(shareLinkInput(stale)).toBeVisible({timeout: 30_000});
    await expect(stale).toHaveURL('/');
    await expect(messageInput(stale)).toHaveCount(0);
});
