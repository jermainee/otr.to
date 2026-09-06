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

    it('announces the file and its human readable size', () => {
        const {connection} = renderChatAsHost();

        act(() => connection.emit('data', {
            type: 'file-start',
            fileId: 'file-1',
            fileName: 'holiday.png',
            fileSize: 20480,
            fileType: 'image/png',
            totalChunks: 2,
        }));

        expect(document.querySelector('.box')).toHaveTextContent('holiday.png (20 KB)');
        expect(screen.getByText('📎 Receiving file: holiday.png (20 KB)')).toBeInTheDocument();
    });

    it.each([
        [0, '0 Bytes'],
        [512, '512 Bytes'],
        [2048, '2 KB'],
        [1536, '1.5 KB'],
        [5 * 1024 * 1024, '5 MB'],
        [3 * 1024 * 1024 * 1024, '3 GB'],
    ])('renders %i bytes as %s', (size, formatted) => {
        const {connection} = renderChatAsHost();

        act(() => connection.emit('data', {
            type: 'file-start', fileId: 'file-1', fileName: 'holiday.png',
            fileSize: size, fileType: 'image/png', totalChunks: 1,
        }));

        expect(document.querySelector('.box')).toHaveTextContent('holiday.png (' + formatted + ')');
    });

    it('tracks progress chunk by chunk', () => {
        const {connection} = renderChatAsHost();

        act(() => connection.emit('data', {
            type: 'file-start', fileId: 'file-1', fileName: 'holiday.png',
            fileSize: 4 * CHUNK_SIZE, fileType: 'image/png', totalChunks: 4,
        }));

        expect(screen.getByText('0/4 chunks received')).toBeInTheDocument();
        expect(document.querySelector('progress')).toHaveValue(0);

        act(() => connection.emit('data', {
            type: 'file-chunk', fileId: 'file-1', chunkIndex: 0, chunk: chunk(1),
        }));

        expect(screen.getByText('1/4 chunks received')).toBeInTheDocument();
        expect(document.querySelector('progress')).toHaveValue(25);
    });

    it('ignores chunks for a transfer it never saw start', () => {
        const {connection} = renderChatAsHost();

        act(() => connection.emit('data', {
            type: 'file-chunk', fileId: 'unknown-file', chunkIndex: 0, chunk: chunk(1),
        }));

        expect(document.querySelector('progress')).toBeNull();
    });

    it('offers a download once the last chunk arrived', () => {
        const {connection} = renderChatAsHost();

        receiveFile(connection);

        expect(screen.getByText('Transfer completed')).toBeInTheDocument();
        expect(screen.getByText('✅ File received: holiday.png')).toBeInTheDocument();
        expect(document.querySelector('progress')).toHaveValue(100);
        expect(screen.getByRole('button', {name: 'Download'})).toBeInTheDocument();
    });

    it('reassembles the chunks into one download and drops the transfer', () => {
        const {connection} = renderChatAsHost();

        receiveFile(connection, {chunks: 2, size: CHUNK_SIZE + 100});

        fireEvent.click(screen.getByRole('button', {name: 'Download'}));

        expect(downloads).toEqual(['holiday.png']);
        expect(objectUrls.created).toHaveLength(1);
        expect(objectUrls.created[0].size).toBe(CHUNK_SIZE + 100);
        expect(objectUrls.created[0].type).toBe('image/png');
        expect(objectUrls.revoked).toEqual(['blob:otr.to/1']);
        expect(screen.queryByText('holiday.png')).not.toBeInTheDocument();
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

    it('reports the send in the conversation', async () => {
        const {connection} = renderChatAsHost();

        await send(new File(['x'.repeat(2048)], 'notes.txt', {type: 'text/plain'}));

        await waitFor(() => expect(screen.getByText('✅ File sent: notes.txt')).toBeInTheDocument());
        expect(screen.getByText('📎 Sending file: notes.txt (2 KB)')).toBeInTheDocument();
        expect(connection.sent).toHaveLength(3);
    });

    it('clears the picker so the same file can be sent twice', async () => {
        renderChatAsHost();

        await send(new File(['x'], 'notes.txt', {type: 'text/plain'}));

        expect(fileInput().value).toBe('');

        // The chunks are read asynchronously; let them finish before unmounting.
        await waitFor(() => expect(screen.getByText('✅ File sent: notes.txt')).toBeInTheDocument());
    });
});
