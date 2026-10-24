import {expect, test} from "@playwright/test";
import {
    authors,
    join,
    messageInput,
    notices,
    openConversation,
    peerMessages,
    people,
    send,
} from "./support/conversation";

/** The name a page tells its owner the others see them as. */
async function ownName(page): Promise<string> {
    const notice = notices(page).filter({hasText: 'Others see you as'});
    await expect(notice).toHaveCount(1);

    return (await notice.textContent()).replace('Others see you as ', '').replace(/\.$/, '');
}

test('a third person joins through the same link, and everyone hears everyone', async ({context}) => {
    const {host, guest, link} = await openConversation(context);
    const third = await join(context, link);

    await expect(people(host)).toHaveText('3 people in this chat');
    await expect(people(guest)).toHaveText('3 people in this chat');
    await expect(people(third)).toHaveText('3 people in this chat');

    await send(third, 'hello, both of you');
    await expect(peerMessages(host)).toHaveText(['hello, both of you']);
    await expect(peerMessages(guest)).toHaveText(['hello, both of you']);

    await send(guest, 'hi');
    await expect(peerMessages(host)).toHaveText(['hello, both of you', 'hi']);
    await expect(peerMessages(third)).toHaveText(['hi']);
});

test('names who wrote what as soon as there are three, the same for everyone', async ({context}) => {
    const {host, guest, link} = await openConversation(context);

    await send(guest, 'just the two of us');
    await expect(peerMessages(host)).toHaveText(['just the two of us']);
    await expect(authors(host)).toHaveCount(0);

    const third = await join(context, link);
    const thirdName = await ownName(third);
    const guestName = await ownName(guest);

    await expect(notices(host)).toContainText([thirdName + ' joined the chat.']);
    await expect(authors(host)).toHaveText([guestName]);

    await send(third, 'me too');
    await expect(authors(host)).toHaveText([guestName, thirdName]);
    await expect(authors(guest)).toHaveText([thirdName]);
    expect(thirdName).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
});

test('the chat goes on without the host, as long as two are left', async ({context}) => {
    const {host, guest, link} = await openConversation(context);
    const third = await join(context, link);
    await expect(people(guest)).toHaveText('3 people in this chat');
    const hostName = await ownName(host);

    await host.close();

    await expect(notices(guest).last()).toHaveText(hostName + ' left the chat.');
    await expect(notices(third).last()).toHaveText(hostName + ' left the chat.');
    await expect(people(guest)).toHaveText('2 people in this chat');

    await send(guest, 'still here?');
    await expect(peerMessages(third)).toHaveText(['still here?']);
});

test('the chat ends for the last one left', async ({context}) => {
    const {host, guest, link} = await openConversation(context);
    const third = await join(context, link);
    await expect(people(host)).toHaveText('3 people in this chat');

    await guest.close();
    await expect(people(host)).toHaveText('2 people in this chat');
    await expect(messageInput(host)).toBeVisible();

    await third.close();

    await expect(messageInput(host)).toHaveCount(0);
    await expect(host.getByText('The chat has ended.')).toBeVisible();
});

test('anyone in the chat can invite more people with their own link', async ({context}) => {
    const {host, guest} = await openConversation(context);

    await guest.getByRole('button', {name: 'Copy invite link'}).click();
    await expect(guest.getByRole('button', {name: 'Invite link copied'})).toBeVisible();
    const invite = await guest.evaluate(() => navigator.clipboard.readText());

    const third = await join(context, invite);

    await expect(people(host)).toHaveText('3 people in this chat');
    await send(third, 'thanks for the invite');
    await expect(peerMessages(host)).toHaveText(['thanks for the invite']);
    await expect(peerMessages(guest)).toHaveText(['thanks for the invite']);
});

test('two people joining at once through different members still find each other', async ({context}) => {
    const {host, guest, link} = await openConversation(context);

    await guest.getByRole('button', {name: 'Copy invite link'}).click();
    const invite = await guest.evaluate(() => navigator.clipboard.readText());

    const [third, fourth] = await Promise.all([join(context, link), join(context, invite)]);

    for (const page of [host, guest, third, fourth]) {
        await expect(people(page)).toHaveText('4 people in this chat');
    }

    await send(third, 'can you hear me?');
    await expect(peerMessages(fourth)).toHaveText(['can you hear me?']);
    await send(fourth, 'loud and clear');
    await expect(peerMessages(third)).toHaveText(['loud and clear']);
});

test('someone whose tab stops responding is let go after half a minute', async ({context}) => {
    test.setTimeout(90_000);

    const {host, guest, link} = await openConversation(context);
    const third = await join(context, link);
    await expect(people(host)).toHaveText('3 people in this chat');
    const thirdName = await ownName(third);

    // Hang the tab: its connections stay open, but it runs no code of its
    // own any more, so like a crashed one it never says goodbye, it only
    // goes silent. Freezing it over CDP did not stop this page, which uses
    // WebRTC, so keep its main thread busy instead. Closing the context
    // ends it.
    third.evaluate(() => {
        const until = Date.now() + 60_000;
        while (Date.now() < until) { /* hung */ }
    }).catch(() => undefined);

    const lost = 'Lost the connection to ' + thirdName + '.';
    await expect(notices(host).last()).toHaveText(lost, {timeout: 45_000});
    await expect(notices(guest).last()).toHaveText(lost, {timeout: 10_000});
    await expect(people(host)).toHaveText('2 people in this chat');

    await send(host, 'just the two of us again');
    await expect(peerMessages(guest)).toHaveText(['just the two of us again']);
});
