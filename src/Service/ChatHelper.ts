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

    public static generateCode(length: number = 8): string
    {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

        if (!window.crypto || !window.crypto.getRandomValues) {
            let result = '';
            for (let i = 0; i < length; i++) {
                result += chars[Math.floor(Math.random() * chars.length)];
            }
            return result;
        }

        const array = new Uint32Array(length);
        window.crypto.getRandomValues(array);

        return Array.from(array, n => chars[n % chars.length]).join('');
    }

    public static generateId(): string
    {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return window.crypto.randomUUID();
        }

        return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    }
}
