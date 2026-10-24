import {act, fireEvent, screen, waitFor} from "@testing-library/react";
import * as React from "react";
import {render} from "@testing-library/react";
import Chat from "../Chat";
import FakePeer, {FakeDataConnection} from "../__mocks__/peerjs";
import {
    deliver,
    deliverRaw,
    renderChatAsGuest,
    renderChatAsHost,
    renderChatDialling,
    renderChatWaiting,
    sentOver,
    textsSentOver,
} from "../testUtils/renderChat";

beforeEach(() => FakePeer.reset());
afterEach(() => { window.location.hash = ''; });

const messageInput = () => screen.getByPlaceholderText('Type your message') as HTMLInputElement;
const heading = (name: string) => screen.queryByRole('heading', {name});

const type = (text: string) => {
    const input = messageInput();
    fireEvent.change(input, {target: {value: text}});
    fireEvent.submit(input.closest('form'));
};

describe('Waiting for a peer', () => {
    it('shows the share link and no message input yet', () => {
        renderChatWaiting();

        expect(heading('Start a private chat')).toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('Waiting for someone to open the link');
        expect(screen.queryByPlaceholderText('Type your message')).not.toBeInTheDocument();
    });

    it('says so when the connection server cannot be reached', () => {
        const {peer} = renderChatWaiting();

        act(() => peer.emit('error', {type: 'network'}));

        expect(heading('Can’t reach the connection server')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Try again'})).toBeInTheDocument();
        expect(heading('Start a private chat')).not.toBeInTheDocument();
    });
});

describe('Chat as the host of the link', () => {
    it('registers the peer under the generated id', async () => {
        await renderChatAsHost();

        expect(FakePeer.instances[0].id).toHaveLength(22);
    });

    it('trades the share link for the conversation once someone connects', async () => {
        await renderChatAsHost();

        expect(heading('Start a private chat')).not.toBeInTheDocument();
        expect(screen.getByText('Someone opened your link. You’re connected. Messages are end-to-end encrypted.'))
            .toHaveClass('chat-notice');
        expect(messageInput()).toBeInTheDocument();
    });

    it('waits for the hello before it counts anyone as connected', () => {
        const {peer} = renderChatWaiting();
        const connection = new FakeDataConnection('visiting-peer-id');

        act(() => peer.emit('connection', connection));
        act(() => connection.emit('open'));

        expect(heading('Start a private chat')).toBeInTheDocument();
    });

    it('greets a new connection with who is in the chat, which is nobody yet', async () => {
        const {connection} = await renderChatAsHost();

        await waitFor(() => expect(connection.sent.length).toBeGreaterThanOrEqual(1));

        expect((await sentOver(connection))[0]).toEqual({type: 'members', ids: []});
    });

    it('turns away someone who does not hold the key, without a word', async () => {
        const {peer} = renderChatWaiting();
        const connection = new FakeDataConnection('a-stranger');

        act(() => peer.emit('connection', connection));
        act(() => connection.emit('open'));
        await deliverRaw(connection, 'hello?');

        expect(connection.closed).toBe(true);
        expect(heading('Start a private chat')).toBeInTheDocument();
    });

    it('sends what was typed and echoes it as an own message', async () => {
        const {connection} = await renderChatAsHost();

        type('are you there?');

        expect(await textsSentOver(connection)).toEqual(['are you there?']);
        expect(screen.getByText('are you there?').closest('.chat-row')).toHaveClass('is-own');
    });

    it('encrypts what it sends', async () => {
        const {connection} = await renderChatAsHost();

        type('are you there?');
        await textsSentOver(connection);

        connection.sent.forEach(data => {
            expect(data).toBeInstanceOf(ArrayBuffer);
            expect(new TextDecoder().decode(data)).not.toContain('are you there?');
        });
    });

    it('clears the input after sending', async () => {
        await renderChatAsHost();

        type('sent and forgotten');

        expect(messageInput().value).toBe('');
    });

    it('does not send a message of nothing but spaces', async () => {
        const {connection} = await renderChatAsHost();

        type('   ');
        type('the next one');

        expect(await textsSentOver(connection)).toEqual(['the next one']);
        expect(document.querySelectorAll('.chat-row')).toHaveLength(1);
    });

    it('shows incoming text as a message from the peer', async () => {
        const {connection} = await renderChatAsHost();

        await deliver(connection, {type: 'text', text: 'yes, right here'});

        expect(screen.getByText('yes, right here').closest('.chat-row')).toHaveClass('is-peer');
    });

    it('ignores what does not open with the key, once someone is in', async () => {
        const {connection} = await renderChatAsHost();

        await deliverRaw(connection, 'yes, right here');
        await deliver(connection, {type: 'text', text: 'this one is sealed'});

        expect(screen.queryByText('yes, right here')).not.toBeInTheDocument();
        expect(screen.getByText('this one is sealed')).toBeInTheDocument();
        expect(connection.closed).toBe(false);
    });

    it('opens the file picker from the attach button', async () => {
        await renderChatAsHost();

        const picker = document.querySelector('input[type="file"]') as HTMLInputElement;
        const click = jest.spyOn(picker, 'click').mockImplementation(() => undefined);

        fireEvent.click(screen.getByRole('button', {name: 'Attach files'}));

        expect(click).toHaveBeenCalledTimes(1);
        expect(picker.multiple).toBe(true);

        click.mockRestore();
    });

    it('ends the chat when the peer leaves', async () => {
        const {connection, peer} = await renderChatAsHost();

        act(() => connection.emit('close'));

        expect(screen.getByText('The other person left the chat.')).toBeInTheDocument();
        expect(screen.queryByPlaceholderText('Type your message')).not.toBeInTheDocument();
        expect(screen.getByRole('link', {name: 'Start a new chat'})).toHaveAttribute('href', '/');
        // Its link stops working, too.
        expect(peer.destroyed).toBe(true);
    });

    it('ends the chat when the connection to the peer is lost, saying so', async () => {
        jest.useFakeTimers();

        try {
            await renderChatAsHost();

            // Nothing more arrives from the peer, not even a heartbeat.
            act(() => { jest.advanceTimersByTime(35000); });

            expect(screen.getByText('Lost the connection to the other person.')).toHaveClass('chat-notice');
            expect(screen.queryByPlaceholderText('Type your message')).not.toBeInTheDocument();
            expect(screen.getByText('The chat has ended.')).toBeInTheDocument();
        } finally {
            jest.useRealTimers();
        }
    });

    it('stays connected to a peer that keeps beating', async () => {
        jest.useFakeTimers();

        try {
            const {connection} = await renderChatAsHost();

            for (let beat = 0; beat < 12; beat++) {
                act(() => { jest.advanceTimersByTime(5000); });
                await deliver(connection, {type: 'heartbeat'});
            }

            expect(messageInput()).toBeInTheDocument();
            expect(document.querySelectorAll('.chat-row')).toHaveLength(0);
        } finally {
            jest.useRealTimers();
        }
    });

    it('hangs up when the page goes away, so the peer learns about it', async () => {
        const {connection, peer} = await renderChatAsHost();

        act(() => { window.dispatchEvent(new Event('pagehide')); });

        expect(connection.closed).toBe(true);
        expect(peer.destroyed).toBe(true);
    });

    it('keeps chatting when the connection server goes away later', async () => {
        const {peer} = await renderChatAsHost();

        act(() => peer.emit('error', {type: 'network'}));

        expect(messageInput()).toBeInTheDocument();
    });
});

describe('Chat as the guest who opened a link', () => {
    it('says it is connecting while it dials the host', () => {
        const {peer} = renderChatDialling('the-hosts-peer-id');

        expect(peer.outgoing.map(connection => connection.peer)).toEqual(['the-hosts-peer-id']);
        expect(heading('Connecting to the chat')).toBeInTheDocument();
        expect(heading('Start a private chat')).not.toBeInTheDocument();
    });

    it('announces the connection', async () => {
        await renderChatAsGuest('the-hosts-peer-id');

        expect(screen.getByText('You’re connected. Messages are end-to-end encrypted.')).toHaveClass('chat-notice');
        expect(heading('Connecting to the chat')).not.toBeInTheDocument();
    });

    it('can talk to the host', async () => {
        const {connection} = await renderChatAsGuest();

        type('hi from the link');
        await deliver(connection, {type: 'text', text: 'welcome'});

        expect(await textsSentOver(connection)).toEqual(['hi from the link']);
        expect(screen.getByText('welcome')).toBeInTheDocument();
    });

    it('receives files from the host, too', async () => {
        const {connection} = await renderChatAsGuest();

        await deliver(connection, {
            type: 'file-start', fileId: 'file-1', fileName: 'route.gpx',
            fileSize: 1024, fileType: 'application/gpx+xml', totalChunks: 1,
        });

        expect(document.querySelector('.chat-file')).toHaveTextContent('route.gpx');
        expect(document.querySelector('.chat-file')).toHaveTextContent('1 KB, 0% received');
    });

    it('gives up when the host never answers', () => {
        jest.useFakeTimers();

        try {
            const {peer} = renderChatDialling('a-peer-that-is-gone');

            act(() => { jest.advanceTimersByTime(5999); });

            expect(heading('This chat is no longer open')).not.toBeInTheDocument();

            act(() => { jest.advanceTimersByTime(1); });

            expect(heading('This chat is no longer open')).toBeInTheDocument();
            expect(screen.getByRole('link', {name: 'Start a new chat'})).toHaveAttribute('href', '/');
            expect(peer.outgoing).toHaveLength(1);
        } finally {
            jest.useRealTimers();
        }
    });

    it('gives up at once when peerjs knows the host is gone', () => {
        const {peer} = renderChatDialling('a-peer-that-is-gone');

        act(() => peer.emit('error', {type: 'peer-unavailable'}));

        expect(heading('This chat is no longer open')).toBeInTheDocument();
    });

    it('says so when the connection server cannot be reached', () => {
        const {peer} = renderChatDialling();

        act(() => peer.emit('error', {type: 'server-error'}));

        expect(heading('Can’t reach the connection server')).toBeInTheDocument();
    });

    it('gives up when the host turns it away, for a key that does not fit', async () => {
        const {peer} = renderChatDialling();
        const connection = peer.outgoing[0];

        act(() => connection.emit('open'));
        await deliverRaw(connection, new ArrayBuffer(64));

        expect(connection.closed).toBe(true);
        expect(heading('This chat is no longer open')).toBeInTheDocument();
    });

    it('gives up when the host hangs up before saying hello', () => {
        const {peer} = renderChatDialling();
        const connection = peer.outgoing[0];

        act(() => connection.emit('open'));
        act(() => connection.emit('close'));

        expect(heading('This chat is no longer open')).toBeInTheDocument();
    });
});

describe('A link that is no chat link', () => {
    it.each([
        ['only a peer id, like the links before encryption', '#a-peer-id'],
        ['a secret that was cut short', '#a-peer-id.TestSecret'],
        ['a secret with letters a link would not have', '#a-peer-id.TestSecret_ForTheLinks0'],
    ])('explains itself for %s, and dials nobody', (_, hash) => {
        window.location.hash = hash;

        render(<Chat/>);

        expect(heading('This link doesn’t work')).toBeInTheDocument();
        expect(screen.getByRole('link', {name: 'Start a new chat'})).toHaveAttribute('href', '/');
        expect(FakePeer.instances).toHaveLength(0);
    });
});
