/**
 * What the peers of a chat send each other, before it is encrypted:
 * - members: who the sender is connected to; the first one also says hello,
 * - text: a chat message,
 * - file-start, file-chunk, file-end: a file, cut into pieces,
 * - heartbeat: nothing but a sign that the sender is still there.
 */
type Packet =
    | {type: 'members', ids: string[]}
    | {type: 'heartbeat'}
    | {type: 'text', text: string}
    | {type: 'file-start', fileId: string, fileName: string, fileSize: number, fileType: string, totalChunks: number}
    | {type: 'file-chunk', fileId: string, chunkIndex: number, chunk: ArrayBuffer}
    | {type: 'file-end', fileId: string};

export default Packet;
