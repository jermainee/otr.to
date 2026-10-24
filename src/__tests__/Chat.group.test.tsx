import {act, fireEvent, screen} from "@testing-library/react";
import ChatHelper from "../Service/ChatHelper";
import FakePeer from "../__mocks__/peerjs";
import {
    deliver,
    joinAs,
    renderChatAsGuest,
    renderChatAsHost,
    renderChatWaiting,
    textsSentOver,
} from "../testUtils/renderChat";

jest.mock('copy-to-clipboard');
const copy = require('copy-to-clipboard') as jest.Mock;

beforeEach(() => {
    FakePeer.reset();
    copy.mockClear();
});
afterEach(() => { window.location.hash = ''; });

const messageInput = () => screen.queryByPlaceholderText('Type your message') as HTMLInputElement;
const notices = () => Array.from(document.querySelectorAll('.chat-notice'), notice => notice.textContent);
const authors = () => Array.from(document.querySelectorAll('.chat-author'), author => author.textContent);

const type = (text: string) => {
    const input = messageInput();
    fireEvent.change(input, {target: {value: text}});
    fireEvent.submit(input.closest('form'));
};

const otter = ChatHelper.nickname('otter-peer-id');
const owl = ChatHelper.nickname('owl-peer-id');

/** The host with two people in the chat: the one who opened the link, and one more. */
async function renderGroup() {
    const {peer, connection: first} = await renderChatAsHost('otter-peer-id');
    const second = await joinAs(peer, 'owl-peer-id', ['otter-peer-id']);

    return {peer, first, second};
}

describe('A chat of two', () => {
    it('names nobody', async () => {
        const {connection} = await renderChatAsHost('otter-peer-id');

        await deliver(connection, {type: 'text', text: 'hi'});

        expect(authors()).toEqual([]);
    });

    it('counts the two of you', async () => {
        await renderChatAsHost();

        expect(screen.getByText('2 people in this chat')).toBeInTheDocument();
    });
});

describe('A group chat', () => {
    it('announces the third person by name, and tells you yours', async () => {
        const {peer} = await renderGroup();

        expect(notices()).toEqual([
            'Someone opened your link. You’re connected. Messages are end-to-end encrypted.',
            owl + ' joined the chat.',
            'Others see you as ' + ChatHelper.nickname(peer.id) + '.',
        ]);
        expect(screen.getByText('3 people in this chat')).toBeInTheDocument();
    });

    it('names who wrote what, under their messages', async () => {
        const {first, second} = await renderGroup();

        await deliver(first, {type: 'text', text: 'hi'});
        await deliver(second, {type: 'text', text: 'hello'});

        expect(screen.getByText('hi').closest('.chat-row')).toHaveTextContent(otter);
        expect(screen.getByText('hello').closest('.chat-row')).toHaveTextContent(owl);
        expect(authors()).toEqual([otter, owl]);
    });

    it('names the messages from before the third person came, too', async () => {
        const {peer, connection} = await renderChatAsHost('otter-peer-id');
        await deliver(connection, {type: 'text', text: 'just us'});

        expect(authors()).toEqual([]);

        await joinAs(peer, 'owl-peer-id', ['otter-peer-id']);

        expect(authors()).toEqual([otter]);
    });

    it('sends what you type to everyone', async () => {
        const {first, second} = await renderGroup();

        type('hello both');

        expect(await textsSentOver(first)).toEqual(['hello both']);
        expect(await textsSentOver(second)).toEqual(['hello both']);
    });

    it('tells files from different people apart, even with the same id', async () => {
        const {first, second} = await renderGroup();
        const start = {type: 'file-start', fileId: 'file-1', fileType: 'text/plain', totalChunks: 1} as const;

        await deliver(first, {...start, fileName: 'otter.txt', fileSize: 1024});
        await deliver(second, {...start, fileName: 'owl.txt', fileSize: 2048});

        expect(screen.getByText('otter.txt').closest('.chat-row')).toHaveTextContent(otter);
        expect(screen.getByText('owl.txt').closest('.chat-row')).toHaveTextContent('2 KB, 0% received');
    });

    it('goes on when one of three leaves, and says who', async () => {
        const {first} = await renderGroup();

        act(() => first.emit('close'));

        expect(notices().pop()).toBe(otter + ' left the chat.');
        expect(messageInput()).toBeInTheDocument();
        expect(screen.getByText('2 people in this chat')).toBeInTheDocument();
    });

    it('keeps the names on once it is down to two again', async () => {
        const {first, second} = await renderGroup();

        act(() => first.emit('close'));
        await deliver(second, {type: 'text', text: 'just us now'});

        expect(screen.getByText('just us now').closest('.chat-row')).toHaveTextContent(owl);
    });

    it('lets go of someone it lost the connection to, and goes on with the others', async () => {
        jest.useFakeTimers();

        try {
            const {first, second} = await renderGroup();

            // The owl keeps beating; the otter's tab froze.
            for (let beat = 0; beat < 7; beat++) {
                act(() => { jest.advanceTimersByTime(5000); });
                await deliver(second, {type: 'heartbeat'});
            }

            expect(notices().pop()).toBe('Lost the connection to ' + otter + '.');
            expect(first.closed).toBe(true);
            expect(second.closed).toBe(false);
            expect(messageInput()).toBeInTheDocument();
            expect(screen.getByText('2 people in this chat')).toBeInTheDocument();
        } finally {
            jest.useRealTimers();
        }
    });

    it('ends when the last other person leaves', async () => {
        const {peer, first, second} = await renderGroup();

        act(() => first.emit('close'));
        act(() => second.emit('close'));

        expect(notices().pop()).toBe(owl + ' left the chat.');
        expect(messageInput()).not.toBeInTheDocument();
        expect(screen.getByText('The chat has ended.')).toBeInTheDocument();
        expect(screen.queryByText(/people in this chat/)).not.toBeInTheDocument();
        expect(peer.destroyed).toBe(true);
    });

    it('hangs up on everyone when the page goes away', async () => {
        const {first, second} = await renderGroup();

        act(() => { window.dispatchEvent(new Event('pagehide')); });

        expect(first.closed).toBe(true);
        expect(second.closed).toBe(true);
    });
});

describe('Joining a group through a link', () => {
    it('only announces the connection, not the people who were there before', async () => {
        const {peer} = await renderChatAsGuest('otter-peer-id', ['owl-peer-id']);

        // The owl was there before; here it is the one who dials.
        await joinAs(peer, 'owl-peer-id', ['otter-peer-id']);

        expect(notices()).toEqual([
            'You’re connected. Messages are end-to-end encrypted.',
            'Others see you as ' + ChatHelper.nickname(peer.id) + '.',
        ]);
        expect(screen.getByText('3 people in this chat')).toBeInTheDocument();
    });

    it('announces whoever comes after', async () => {
        const {peer} = await renderChatAsGuest('otter-peer-id');

        await joinAs(peer, 'owl-peer-id', ['otter-peer-id']);

        expect(notices()).toContain(owl + ' joined the chat.');
    });
});

describe('The invite link in the chat', () => {
    it('points at this browser, with the chat’s secret', async () => {
        const {peer} = await renderChatAsGuest('otter-peer-id');

        fireEvent.click(screen.getByRole('button', {name: 'Copy invite link'}));

        expect(copy.mock.calls[0][0]).toBe(ChatHelper.chatLink(peer.id, 'TestSecretForTheLinks0'));
        expect(screen.getByRole('button', {name: 'Invite link copied'})).toBeInTheDocument();
    });

    it('is the host’s share link, too', async () => {
        const {peer} = renderChatWaiting();
        const shareLink = (screen.getByLabelText('Chat link') as HTMLInputElement).value;

        await joinAs(peer, 'otter-peer-id');
        fireEvent.click(screen.getByRole('button', {name: 'Copy invite link'}));

        expect(copy.mock.calls[0][0]).toBe(shareLink);
    });
});
