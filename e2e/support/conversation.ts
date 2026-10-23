import {BrowserContext, expect, Locator, Page} from "@playwright/test";
import {relaySignalling} from "./signalling";

interface Conversation {
    /** The person who created the link and waits for someone to join. */
    host: Page;
    /** The person who opened that link. */
    guest: Page;
    hostPeerId: string;
}

/** A connection over loopback is quick, but it is still ICE and a build server. */
const CONNECT_TIMEOUT = 20_000;

export const shareLinkInput = (page: Page): Locator => page.locator('input[readonly]');
export const messageInput = (page: Page): Locator => page.getByPlaceholder('Type your message');
export const ownMessages = (page: Page): Locator => page.locator('.messages .has-text-right');
export const peerMessages = (page: Page): Locator => page.locator('.messages .has-text-left');
export const notices = (page: Page): Locator => page.locator('.messages .has-text-centered');
export const fileTransfers = (page: Page): Locator => page.locator('.box');

/** Opens the app as the host and reads the link they are told to pass on. */
export async function openAsHost(context: BrowserContext): Promise<Page> {
    await relaySignalling(context);

    const host = await context.newPage();
    await host.goto('/');
    await expect(shareLinkInput(host)).toHaveValue(/^https:\/\/otr\.to\/#.+/);

    return host;
}

/**
 * Opens both ends of a chat: one page creates the link, a second one opens it,
 * and both wait until the data channel is up, which is when the app offers a
 * message input.
 */
export async function openConversation(context: BrowserContext): Promise<Conversation> {
    const host = await openAsHost(context);
    const hostPeerId = (await shareLinkInput(host).inputValue()).split('#')[1];

    const guest = await context.newPage();
    await guest.goto('/#' + hostPeerId);

    await expect(messageInput(host)).toBeVisible({timeout: CONNECT_TIMEOUT});
    await expect(messageInput(guest)).toBeVisible({timeout: CONNECT_TIMEOUT});

    return {host, guest, hostPeerId};
}

/** Types a message and submits the form, the way pressing enter does. */
export async function send(page: Page, text: string): Promise<void> {
    await messageInput(page).fill(text);
    await messageInput(page).press('Enter');
}
