import {act, fireEvent, screen, waitFor} from "@testing-library/react";
import FakePeer from "../__mocks__/peerjs";
import {renderChatAsHost} from "../testUtils/renderChat";

const CHUNK_SIZE = 16384;

let objectUrls: { created: Blob[], revoked: string[] };
let downloads: string[];

beforeEach(() => {
    FakePeer.reset();

    objectUrls = {created: [], revoked: []};
    downloads = [];

    Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        value: (blob: Blob) => {
            objectUrls.created.push(blob);
            return 'blob:otr.to/' + objectUrls.created.length;
        },
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        value: (url: string) => objectUrls.revoked.push(url),
    });

    // jsdom cannot follow the download, so record the intent instead.
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
        downloads.push(this.download);
    });
});

afterEach(() => jest.restoreAllMocks());

/** The size and state line of the one file in the conversation. */
const meta = () => document.querySelector('.chat-file-meta');

const chunk = (byte: number, size: number = CHUNK_SIZE) => {
    const buffer = new Uint8Array(size);
    buffer.fill(byte);

    return buffer.buffer;
};

const receiveFile = (connection, {chunks = 2, size = CHUNK_SIZE + 100, name = 'holiday.png'} = {}) => {
    act(() => connection.emit('data', {
        type: 'file-start',
        fileId: 'file-1',
        fileName: name,
        fileSize: size,
        fileType: 'image/png',
        totalChunks: chunks,
    }));

    for (let index = 0; index < chunks; index++) {
        act(() => connection.emit('data', {
            type: 'file-chunk',
            fileId: 'file-1',
            chunkIndex: index,
            chunk: chunk(index + 1, index === chunks - 1 ? size - index * CHUNK_SIZE : CHUNK_SIZE),
        }));
    }

    act(() => connection.emit('data', {type: 'file-end', fileId: 'file-1'}));
};

describe('Receiving a file', () => {
    it('shows nothing until a transfer starts', () => {
        renderChatAsHost();

        expect(document.querySelector('progress')).toBeNull();
    });

    it('shows the file in the conversation, from the peer, with a readable size', () => {
        const {connection} = renderChatAsHost();

        act(() => connection.emit('data', {
            type: 'file-start',
            fileId: 'file-1',
            fileName: 'holiday.png',
            fileSize: 20480,
            fileType: 'image/png',
            totalChunks: 2,
        }));

        expect(screen.getByText('holiday.png').closest('.chat-row')).toHaveClass('is-peer');
        expect(meta()).toHaveTextContent('20 KB, 0% received');
    });

    it('tracks progress chunk by chunk', () => {
        const {connection} = renderChatAsHost();

        act(() => connection.emit('data', {
            type: 'file-start', fileId: 'file-1', fileName: 'holiday.png',
            fileSize: 4 * CHUNK_SIZE, fileType: 'image/png', totalChunks: 4,
        }));

        expect(meta()).toHaveTextContent('64 KB, 0% received');
        expect(document.querySelector('progress')).toHaveValue(0);

        act(() => connection.emit('data', {
            type: 'file-chunk', fileId: 'file-1', chunkIndex: 0, chunk: chunk(1),
        }));

        expect(meta()).toHaveTextContent('64 KB, 25% received');
        expect(document.querySelector('progress')).toHaveValue(25);
    });

    it('ignores chunks for a transfer it never saw start', () => {
        const {connection} = renderChatAsHost();

        act(() => connection.emit('data', {
            type: 'file-chunk', fileId: 'unknown-file', chunkIndex: 0, chunk: chunk(1),
        }));

        expect(document.querySelector('progress')).toBeNull();
        expect(document.querySelector('.chat-file')).toBeNull();
    });

    it('offers a download once the last chunk arrived', () => {
        const {connection} = renderChatAsHost();

        receiveFile(connection);

        expect(meta()).toHaveTextContent('16.1 KB, received');
        expect(document.querySelector('progress')).toBeNull();
        expect(screen.getByRole('button', {name: 'Download'})).toBeInTheDocument();
    });

    it('reassembles the chunks into one download and lets go of them', () => {
        const {connection} = renderChatAsHost();

        receiveFile(connection, {chunks: 2, size: CHUNK_SIZE + 100});

        fireEvent.click(screen.getByRole('button', {name: 'Download'}));

        expect(downloads).toEqual(['holiday.png']);
        expect(objectUrls.created).toHaveLength(1);
        expect(objectUrls.created[0].size).toBe(CHUNK_SIZE + 100);
        expect(objectUrls.created[0].type).toBe('image/png');
        expect(objectUrls.revoked).toEqual(['blob:otr.to/1']);
        expect(meta()).toHaveTextContent('16.1 KB, saved');
        expect(screen.queryByRole('button', {name: 'Download'})).not.toBeInTheDocument();
    });
});

describe('Sending a file', () => {
    const fileInput = () => document.querySelector('input[type="file"]') as HTMLInputElement;

    const send = async (file: File) => {
        await act(async () => {
            fireEvent.change(fileInput(), {target: {files: [file]}});
        });
    };

    it('splits the file into chunks between a start and an end message', async () => {
        const {connection} = renderChatAsHost();

        await send(new File(['x'.repeat(CHUNK_SIZE + 100)], 'notes.txt', {type: 'text/plain'}));

        await waitFor(() => expect(connection.sent).toHaveLength(4));

        const [start, first, second, end] = connection.sent;

        expect(start).toMatchObject({
            type: 'file-start',
            fileName: 'notes.txt',
            fileSize: CHUNK_SIZE + 100,
            fileType: 'text/plain',
            totalChunks: 2,
        });
        expect(first).toMatchObject({type: 'file-chunk', chunkIndex: 0});
        expect(first.chunk.byteLength).toBe(CHUNK_SIZE);
        expect(second).toMatchObject({type: 'file-chunk', chunkIndex: 1});
        expect(second.chunk.byteLength).toBe(100);
        expect(end).toMatchObject({type: 'file-end'});

        const ids = new Set(connection.sent.map(message => message.fileId));
        expect(ids.size).toBe(1);
    });

    it('shows the file as an own message until it is sent', async () => {
        const {connection} = renderChatAsHost();

        await send(new File(['x'.repeat(2048)], 'notes.txt', {type: 'text/plain'}));

        await waitFor(() => expect(meta()).toHaveTextContent('2 KB, sent'));
        expect(screen.getByText('notes.txt').closest('.chat-row')).toHaveClass('is-own');
        expect(screen.queryByRole('button', {name: 'Download'})).not.toBeInTheDocument();
        expect(connection.sent).toHaveLength(3);
    });

    it('clears the picker so the same file can be sent twice', async () => {
        renderChatAsHost();

        await send(new File(['x'], 'notes.txt', {type: 'text/plain'}));

        expect(fileInput().value).toBe('');

        // The chunks are read asynchronously; let them finish before unmounting.
        await waitFor(() => expect(meta()).toHaveTextContent('1 Bytes, sent'));
    });
});
