import {act, fireEvent, screen} from "@testing-library/react";
import FakePeer from "../__mocks__/peerjs";
import {renderChatAsGuest, renderChatAsHost, renderChatDialling, renderChatWaiting, shareSection} from "../testUtils/renderChat";

beforeEach(() => FakePeer.reset());
afterEach(() => { window.location.hash = ''; });

const messageInput = () => screen.getByPlaceholderText('Type your message') as HTMLInputElement;

const type = (text: string) => {
    const input = messageInput();
    fireEvent.change(input, {target: {value: text}});
    fireEvent.submit(input.closest('form'));
};

describe('Waiting for a peer', () => {
    it('shows the share link and no message input yet', () => {
        renderChatWaiting();

        expect(shareSection()).toHaveClass('content');
        expect(screen.queryByPlaceholderText('Type your message')).not.toBeInTheDocument();
    });
});

describe('Chat as the host of the link', () => {
    it('registers the peer under the generated id', () => {
        renderChatAsHost();

        expect(FakePeer.instances[0].id).toHaveLength(22);
    });

    it('hides the share link and greets the peer once someone connects', () => {
        renderChatAsHost();

        expect(shareSection()).toHaveClass('is-hidden');
        expect(screen.getByText('Connected to Peer')).toBeInTheDocument();
        expect(messageInput()).toBeInTheDocument();
    });

    it('sends what was typed and echoes it as an own message', () => {
        const {connection} = renderChatAsHost();

        type('are you there?');

        expect(connection.sent).toEqual(['are you there?']);
        expect(screen.getByText('are you there?').closest('div')).toHaveClass('has-text-right');
    });

    it('clears the input after sending', () => {
        renderChatAsHost();

        type('sent and forgotten');

        expect(messageInput().value).toBe('');
    });

    it('shows incoming text as a message from the peer', () => {
        const {connection} = renderChatAsHost();

        act(() => connection.emit('data', 'yes, right here'));

        expect(screen.getByText('yes, right here').closest('div')).toHaveClass('has-text-left');
    });

    it('opens the file picker from the attach button', () => {
        renderChatAsHost();

        const picker = document.querySelector('input[type="file"]') as HTMLInputElement;
        const click = jest.spyOn(picker, 'click').mockImplementation(() => undefined);

        fireEvent.click(screen.getByTitle('Attach file'));

        expect(click).toHaveBeenCalledTimes(1);
        expect(picker.multiple).toBe(true);

        click.mockRestore();
    });

    it('reports when the peer leaves', () => {
        const {connection} = renderChatAsHost();

        act(() => connection.emit('close'));

        expect(screen.getByText('Peer has left the chat')).toBeInTheDocument();
    });
});

describe('Chat as the guest who opened a link', () => {
    it('never shows the share link, it connects straight to the host', () => {
        const {peer} = renderChatAsGuest('the-hosts-peer-id');

        expect(peer.outgoing.map(connection => connection.peer)).toEqual(['the-hosts-peer-id']);
        expect(shareSection()).toHaveClass('is-hidden');
    });

    it('announces both peers', () => {
        const {peer} = renderChatAsGuest('the-hosts-peer-id');

        expect(screen.getByText('Created Peer: ' + peer.id)).toBeInTheDocument();
        expect(screen.getByText('Connected to Peer: the-hosts-peer-id')).toBeInTheDocument();
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

        expect(document.querySelector('.box')).toHaveTextContent('route.gpx (1 KB)');
    });

    it('gives up when the host never answers', () => {
        jest.useFakeTimers();

        try {
            const {peer} = renderChatDialling('a-peer-that-is-gone');

            expect(screen.queryByText('Peer not found')).not.toBeInTheDocument();

            act(() => { jest.advanceTimersByTime(6000); });

            expect(screen.getByText('Peer not found')).toBeInTheDocument();
            expect(peer.outgoing).toHaveLength(1);
        } finally {
            jest.useRealTimers();
        }
    });
});
