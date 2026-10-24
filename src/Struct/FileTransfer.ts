/** A file on its way between the two peers, in either direction. */
export default interface FileTransfer {
    id: string;
    name: string;
    size: number;
    type: string;
    direction: 'outgoing' | 'incoming';
    /** The chunks received so far; empty for outgoing files and once saved. */
    chunks: ArrayBuffer[];
    totalChunks: number;
    receivedChunks: number;
    isComplete: boolean;
    /** Whether the receiver downloaded it, which frees the chunks. */
    isSaved: boolean;
    progress: number;
}
