import {BrowserContext, expect, Locator, Page} from "@playwright/test";
import {relaySignalling} from "./signalling";

interface Conversation {
    /** The person who created the link and waits for someone to join. */
    host: Page;
    /** The person who opened that link. */
    guest: Page;
    hostPeerId: string;
    /** The whole link the host shared, peer id and secret included. */
    link: string;
}

/** A connection over loopback is quick, but it is still ICE and a build server. */
const CONNECT_TIMEOUT = 20_000;

export const shareLinkInput = (page: Page): Locator => page.locator('input[readonly]');
export const messageInput = (page: Page): Locator => page.getByPlaceholder('Type your message');
export const ownMessages = (page: Page): Locator => page.locator('.chat-row.is-own .chat-text');
export const peerMessages = (page: Page): Locator => page.locator('.chat-row.is-peer .chat-text');
export const notices = (page: Page): Locator => page.locator('.chat-notice');
export const fileTransfers = (page: Page): Locator => page.locator('.chat-file');
export const authors = (page: Page): Locator => page.locator('.chat-author');
export const people = (page: Page): Locator => page.getByText(/people in this chat/);

/** What a chat link carries after the #: the peer to dial, then the chat's secret. */
export function partsOf(link: string): {peerId: string, secret: string} {
    const [peerId, secret] = link.split('#')[1].split('.');

    return {peerId, secret};
}

/**
 * Opens the app as the host and reads the link they are told to pass on.
 * What the signalling server gets to see goes into `signalling`.
 */
export async function openAsHost(context: BrowserContext, signalling: string[] = []): Promise<Page> {
    await relaySignalling(context, signalling);

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
export async function openConversation(context: BrowserContext, signalling: string[] = []): Promise<Conversation> {
    const host = await openAsHost(context, signalling);
    const link = await shareLinkInput(host).inputValue();
    const guest = await join(context, link);

    await expect(messageInput(host)).toBeVisible({timeout: CONNECT_TIMEOUT});

    return {host, guest, hostPeerId: partsOf(link).peerId, link};
}

/** Opens a chat link in a new page and waits until it is in the chat. */
export async function join(context: BrowserContext, link: string): Promise<Page> {
    const page = await context.newPage();
    await page.goto('/#' + link.split('#')[1]);
    await expect(messageInput(page)).toBeVisible({timeout: CONNECT_TIMEOUT});

    return page;
}

/** Types a message and submits the form, the way pressing enter does. */
export async function send(page: Page, text: string): Promise<void> {
    await messageInput(page).fill(text);
    await messageInput(page).press('Enter');
}
