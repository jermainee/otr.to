import {readFile} from "node:fs/promises";
import {expect, Page, test} from "@playwright/test";
import {fileTransfers, notices, openConversation, send} from "./support/conversation";

const attach = (page: Page, name: string, body: string, mimeType = 'text/plain') =>
    page.locator('input[type="file"]').setInputFiles({name, mimeType, buffer: Buffer.from(body)});

test('a file picked on one side shows up on the other', async ({context}) => {
    const {host, guest} = await openConversation(context);

    await attach(guest, 'notes.txt', 'x'.repeat(2048));

    await expect(fileTransfers(host)).toHaveCount(1);
    await expect(fileTransfers(host)).toContainText('notes.txt');
    await expect(fileTransfers(host)).toContainText('2 KB, received');
    await expect(host.getByRole('button', {name: 'Download'})).toBeVisible();
});

test('the sender sees the file leave, and keeps chatting', async ({context}) => {
    const {host, guest} = await openConversation(context);

    await attach(guest, 'notes.txt', 'x'.repeat(2048));

    await expect(fileTransfers(guest)).toContainText('notes.txt');
    await expect(fileTransfers(guest)).toContainText('2 KB, sent');
    await expect(notices(guest)).toHaveText(['You’re connected. Messages are end-to-end encrypted.']);

    await send(guest, 'that is the one');
    await expect(host.getByText('that is the one')).toBeVisible();
});

test('a file bigger than one chunk arrives in order and in full', async ({context}) => {
    const {host, guest} = await openConversation(context);

    // 40 KB is three of the 16 KB chunks the app cuts a file into.
    const body = Array.from({length: 40960}, (_, index) => String.fromCharCode(33 + index % 90)).join('');
    await attach(guest, 'holiday.png', body, 'image/png');

    await expect(fileTransfers(host)).toContainText('holiday.png');
    await expect(fileTransfers(host)).toContainText('40 KB, received');
    await expect(host.locator('progress')).toHaveCount(0);

    const download = host.waitForEvent('download');
    await host.getByRole('button', {name: 'Download'}).click();
    const file = await download;

    expect(file.suggestedFilename()).toBe('holiday.png');
    expect(await readFile(await file.path(), 'utf8')).toBe(body);
});

test('a received file can be saved once, and stays in the conversation', async ({context}) => {
    const {host, guest} = await openConversation(context);

    await attach(guest, 'notes.txt', 'keep me');
    await expect(host.getByRole('button', {name: 'Download'})).toBeVisible();

    const download = host.waitForEvent('download');
    await host.getByRole('button', {name: 'Download'}).click();
    await download;

    await expect(fileTransfers(host)).toHaveCount(1);
    await expect(fileTransfers(host)).toContainText('7 Bytes, saved');
    await expect(host.getByRole('button', {name: 'Download'})).toHaveCount(0);
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

    await expect(fileTransfers(guest)).toContainText('route.gpx');
    await expect(fileTransfers(guest)).toContainText('6 Bytes, received');
});
