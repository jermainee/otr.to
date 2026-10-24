import Message from "../Struct/Message";

describe('Message', () => {
    it('is a regular chat message by default', () => {
        const message = new Message('hello', true);

        expect(message.text).toBe('hello');
        expect(message.isSender).toBe(true);
        expect(message.isSystem).toBe(false);
        expect(message.fileId).toBeNull();
    });

    it('can be marked as a system message', () => {
        expect(new Message('The other person left the chat.', true, true).isSystem).toBe(true);
    });

    it('can stand for a file', () => {
        expect(new Message('notes.txt', true, false, 'file-1').fileId).toBe('file-1');
    });
});
