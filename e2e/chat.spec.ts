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

    await expect(notices(host)).toHaveText(['Someone opened your link. You’re connected.']);
    await expect(notices(guest)).toHaveText(['You’re connected.']);
    expect(hostPeerId).toHaveLength(22);
});

test('the host trades the share link for a message input once someone joins', async ({context}) => {
    const {host} = await openConversation(context);

    await expect(host.getByRole('heading', {name: 'Start a private chat'})).not.toBeVisible();
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
test('ends the chat on the other side when one side closes the page', async ({context}) => {
    const {host, guest} = await openConversation(context);

    await guest.close();

    await expect(notices(host).last()).toHaveText('The other person left the chat.');
    await expect(messageInput(host)).toHaveCount(0);
    await expect(host.getByRole('link', {name: 'Start a new chat'})).toBeVisible();
});

test('explains a stale link and offers a fresh start', async ({context}) => {
    const {host} = await openConversation(context);

    const stale = await host.context().newPage();
    await stale.goto('/#a-peer-that-is-long-gone');

    await expect(stale.getByRole('heading', {name: 'This chat is no longer open'})).toBeVisible({timeout: 30_000});
    await expect(messageInput(stale)).toHaveCount(0);

    await stale.getByRole('link', {name: 'Start a new chat'}).click();

    await expect(stale).toHaveURL('/');
    await expect(shareLinkInput(stale)).toBeVisible();
});
