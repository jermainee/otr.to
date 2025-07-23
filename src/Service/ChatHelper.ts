export default class ChatHelper
{
    public static generatePeerId(): string
    {
        if (!window.crypto || !window.crypto.getRandomValues) {
            return Math.random().toString(36).substring(2, 24);
        }

        const array = new Uint8Array(16);
        window.crypto.getRandomValues(array);

        return Array.from(array, byte => byte.toString(36)).join('').substring(0, 22);
    }
}
