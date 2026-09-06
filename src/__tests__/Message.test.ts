import Message from "../Struct/Message";

describe('Message', () => {
    it('is a regular chat message by default', () => {
        const message = new Message('hello', true);

        expect(message.text).toBe('hello');
        expect(message.isSender).toBe(true);
        expect(message.isSystem).toBe(false);
    });

    it('can be marked as a system message', () => {
        expect(new Message('Peer has left the chat', true, true).isSystem).toBe(true);
    });
});
