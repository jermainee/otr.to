import {readFile} from "node:fs/promises";
import {expect, Page, test} from "@playwright/test";
import {fileTransfers, notices, openConversation, send} from "./support/conversation";

const attach = (page: Page, name: string, body: string, mimeType = 'text/plain') =>
    page.locator('input[type="file"]').setInputFiles({name, mimeType, buffer: Buffer.from(body)});

test('a file picked on one side shows up on the other', async ({context}) => {
    const {host, guest} = await openConversation(context);

    await attach(guest, 'notes.txt', 'x'.repeat(2048));

    await expect(fileTransfers(host)).toHaveCount(1);
    await expect(fileTransfers(host)).toContainText('notes.txt (2 KB)');
    await expect(host.getByText('Transfer completed')).toBeVisible();
    await expect(host.getByText('📎 Receiving file: notes.txt (2 KB)')).toBeVisible();
    await expect(host.getByRole('button', {name: 'Download'})).toBeVisible();
});

test('the sender sees the file leave, and keeps chatting', async ({context}) => {
    const {host, guest} = await openConversation(context);

    await attach(guest, 'notes.txt', 'x'.repeat(2048));

    await expect(notices(guest)).toContainText([
        /^Created Peer: /,
        /^Connected to Peer: /,
        '📎 Sending file: notes.txt (2 KB)',
        '✅ File sent: notes.txt',
    ]);

    await send(guest, 'that is the one');
    await expect(host.getByText('that is the one')).toBeVisible();
});

test('a file bigger than one chunk arrives in order and in full', async ({context}) => {
    const {host, guest} = await openConversation(context);

    // 40 KB is three of the 16 KB chunks the app cuts a file into.
    const body = Array.from({length: 40960}, (_, index) => String.fromCharCode(33 + index % 90)).join('');
    await attach(guest, 'holiday.png', body, 'image/png');

    await expect(fileTransfers(host)).toContainText('holiday.png (40 KB)');
    await expect(host.getByText('Transfer completed')).toBeVisible();
    await expect(host.locator('progress')).toHaveJSProperty('value', 100);

    const download = host.waitForEvent('download');
    await host.getByRole('button', {name: 'Download'}).click();
    const file = await download;

    expect(file.suggestedFilename()).toBe('holiday.png');
    expect(await readFile(await file.path(), 'utf8')).toBe(body);
});

test('the transfer disappears once it has been saved', async ({context}) => {
    const {host, guest} = await openConversation(context);

    await attach(guest, 'notes.txt', 'keep me');
    await expect(host.getByRole('button', {name: 'Download'})).toBeVisible();

    const download = host.waitForEvent('download');
    await host.getByRole('button', {name: 'Download'}).click();
    await download;

    await expect(fileTransfers(host)).toHaveCount(0);
    await expect(host.getByText('✅ File received: notes.txt')).toBeVisible();
});

test('several files can be picked at once', async ({context}) => {
    const {host, guest} = await openConversation(context);

    await guest.locator('input[type="file"]').setInputFiles([
        {name: 'first.txt', mimeType: 'text/plain', buffer: Buffer.from('one')},
        {name: 'second.txt', mimeType: 'text/plain', buffer: Buffer.from('two')},
    ]);

    await expect(fileTransfers(host)).toHaveCount(2);
    await expect(fileTransfers(host).first()).toContainText('first.txt');
    await expect(fileTransfers(host).last()).toContainText('second.txt');
    await expect(host.getByRole('button', {name: 'Download'})).toHaveCount(2);
});

test('files travel from the host to the guest, too', async ({context}) => {
    const {host, guest} = await openConversation(context);

    await attach(host, 'route.gpx', '<gpx/>', 'application/gpx+xml');

    await expect(fileTransfers(guest)).toContainText('route.gpx (6 Bytes)');
    await expect(guest.getByText('✅ File received: route.gpx')).toBeVisible();
});
