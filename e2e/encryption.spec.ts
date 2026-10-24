import {expect, test} from "@playwright/test";
import {join, openAsHost, openConversation, partsOf, peerMessages, send, shareLinkInput} from "./support/conversation";

/**
 * Records everything the page hands its WebRTC data channels, as text, so a
 * test can look for what should not be there. Binary data is read byte by
 * byte, so any readable text in it shows.
 */
const recordDataChannels = () => {
    const sent: string[] = [];
    const send = RTCDataChannel.prototype.send;

    RTCDataChannel.prototype.send = function (this: RTCDataChannel, data: any) {
        const bytes = typeof data === 'string' ? null
            : data instanceof ArrayBuffer ? new Uint8Array(data)
                : ArrayBuffer.isView(data) ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : null;

        sent.push(bytes === null ? String(data) : Array.from(bytes, byte => String.fromCharCode(byte)).join(''));

        return send.call(this, data);
    };

    (window as any).sentOverDataChannels = sent;
};

test('messages and files cross the data channel encrypted', async ({context}) => {
    await context.addInitScript(recordDataChannels);
    const {host, guest} = await openConversation(context);

    await send(host, 'the meeting is at noon');
    await host.locator('input[type="file"]').setInputFiles({
        name: 'plans.txt', mimeType: 'text/plain', buffer: Buffer.from('the plans are in the drawer'),
    });
    await expect(peerMessages(guest)).toHaveText(['the meeting is at noon']);
    await expect(guest.locator('.chat-file')).toContainText('received');

    const sent: string[] = await host.evaluate(() => (window as any).sentOverDataChannels);

    expect(sent.length).toBeGreaterThan(0);
    expect(sent.join('\n')).not.toContain('the meeting is at noon');
    expect(sent.join('\n')).not.toContain('plans.txt');
    expect(sent.join('\n')).not.toContain('in the drawer');
});

test('the signalling server never sees the chat’s secret', async ({context}) => {
    const signalling: string[] = [];
    const {host, guest, link} = await openConversation(context, signalling);
    await join(context, link);

    await send(guest, 'hello');
    await expect(peerMessages(host)).toHaveText(['hello']);

    expect(signalling.length).toBeGreaterThan(0);
    expect(signalling.join('\n')).not.toContain(partsOf(link).secret);
});

test('a link with the wrong secret does not get into the chat', async ({context}) => {
    const host = await openAsHost(context);
    const {peerId} = partsOf(await shareLinkInput(host).inputValue());

    const intruder = await context.newPage();
    await intruder.goto('/#' + peerId + '.WrongSecretForTheLink0');

    await expect(intruder.getByRole('heading', {name: 'This chat is no longer open'})).toBeVisible({timeout: 30_000});
    await expect(host.getByRole('heading', {name: 'Start a private chat'})).toBeVisible();
    await expect(host.getByRole('status')).toHaveText('Waiting for someone to open the link');
});
