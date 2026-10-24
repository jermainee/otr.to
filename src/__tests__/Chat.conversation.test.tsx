import {act, fireEvent, screen} from "@testing-library/react";
import FakePeer from "../__mocks__/peerjs";
import {renderChatAsGuest, renderChatAsHost, renderChatDialling, renderChatWaiting} from "../testUtils/renderChat";

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
    it('registers the peer under the generated id', () => {
        renderChatAsHost();

        expect(FakePeer.instances[0].id).toHaveLength(22);
    });

    it('trades the share link for the conversation once someone connects', () => {
        renderChatAsHost();

        expect(heading('Start a private chat')).not.toBeInTheDocument();
        expect(screen.getByText('Someone opened your link. You’re connected.')).toHaveClass('chat-notice');
        expect(messageInput()).toBeInTheDocument();
    });

    it('sends what was typed and echoes it as an own message', () => {
        const {connection} = renderChatAsHost();

        type('are you there?');

        expect(connection.sent).toEqual(['are you there?']);
        expect(screen.getByText('are you there?').closest('.chat-row')).toHaveClass('is-own');
    });

    it('clears the input after sending', () => {
        renderChatAsHost();

        type('sent and forgotten');

        expect(messageInput().value).toBe('');
    });

    it('does not send a message of nothing but spaces', () => {
        const {connection} = renderChatAsHost();

        type('   ');

        expect(connection.sent).toEqual([]);
        expect(document.querySelectorAll('.chat-row')).toHaveLength(0);
    });

    it('shows incoming text as a message from the peer', () => {
        const {connection} = renderChatAsHost();

        act(() => connection.emit('data', 'yes, right here'));

        expect(screen.getByText('yes, right here').closest('.chat-row')).toHaveClass('is-peer');
    });

    it('opens the file picker from the attach button', () => {
        renderChatAsHost();

        const picker = document.querySelector('input[type="file"]') as HTMLInputElement;
        const click = jest.spyOn(picker, 'click').mockImplementation(() => undefined);

        fireEvent.click(screen.getByRole('button', {name: 'Attach files'}));

        expect(click).toHaveBeenCalledTimes(1);
        expect(picker.multiple).toBe(true);

        click.mockRestore();
    });

    it('ends the chat when the peer leaves', () => {
        const {connection} = renderChatAsHost();

        act(() => connection.emit('close'));

        expect(screen.getByText('The other person left the chat.')).toBeInTheDocument();
        expect(screen.queryByPlaceholderText('Type your message')).not.toBeInTheDocument();
        expect(screen.getByRole('link', {name: 'Start a new chat'})).toHaveAttribute('href', '/');
    });

    it('hangs up when the page goes away, so the peer learns about it', () => {
        const {connection} = renderChatAsHost();

        act(() => { window.dispatchEvent(new Event('pagehide')); });

        expect(connection.closed).toBe(true);
    });

    it('keeps chatting when the connection server goes away later', () => {
        const {peer} = renderChatAsHost();

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

    it('announces the connection', () => {
        renderChatAsGuest('the-hosts-peer-id');

        expect(screen.getByText('You’re connected.')).toHaveClass('chat-notice');
        expect(heading('Connecting to the chat')).not.toBeInTheDocument();
    });

    it('can talk to the host', () => {
        const {connection} = renderChatAsGuest();

        type('hi from the link');
        act(() => connection.emit('data', 'welcome'));

        expect(connection.sent).toEqual(['hi from the link']);
        expect(screen.getByText('welcome')).toBeInTheDocument();
    });

    it('receives files from the host, too', () => {
        const {connection} = renderChatAsGuest();

        act(() => connection.emit('data', {
            type: 'file-start', fileId: 'file-1', fileName: 'route.gpx',
            fileSize: 1024, fileType: 'application/gpx+xml', totalChunks: 1,
        }));

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
});
