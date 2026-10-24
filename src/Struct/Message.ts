export default class Message {
    public text: string;
    public isSender: boolean;
    public isSystem: boolean;
    /** Set when the message stands for a file rather than for text. */
    public fileId: string | null;

    public constructor(
        text: string,
        isSender: boolean,
        isSystem: boolean = false,
        fileId: string | null = null
    ) {
        this.text = text;
        this.isSender = isSender;
        this.isSystem = isSystem;
        this.fileId = fileId;
    }
}
