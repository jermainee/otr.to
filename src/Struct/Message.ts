export default class Message {
    public text: string;
    public isSender: boolean;
    public isSystem: boolean;
    /** Set when the message stands for a file rather than for text. */
    public fileId: string | null;
    /** The peer id of whoever sent it; null for own messages and notices. */
    public author: string | null;

    public constructor(
        text: string,
        isSender: boolean,
        isSystem: boolean = false,
        fileId: string | null = null,
        author: string | null = null
    ) {
        this.text = text;
        this.isSender = isSender;
        this.isSystem = isSystem;
        this.fileId = fileId;
        this.author = author;
    }
}
