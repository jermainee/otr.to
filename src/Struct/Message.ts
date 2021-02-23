export default class Message {
    public text: string;
    public isSender: boolean;
    public isSystem: boolean;

    public constructor(
        text: string,
        isSender: boolean,
        isSystem: boolean = false
    ) {
        this.text = text;
        this.isSender = isSender;
        this.isSystem = isSystem;
    }
}
