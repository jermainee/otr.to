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

    /**
     * Short, human-friendly alias for the connection handshake.
     * Ambiguous characters (0/O/1/I/l) are excluded for easy typing.
     */
    public static generateAlias(length: number = 6): string
    {
        const charset = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

        if (!window.crypto || !window.crypto.getRandomValues) {
            let code = '';
            for (let i = 0; i < length; i++) {
                code += charset.charAt(Math.floor(Math.random() * charset.length));
            }
            return code;
        }

        const array = new Uint8Array(length);
        window.crypto.getRandomValues(array);

        return Array.from(array, byte => charset.charAt(byte % charset.length)).join('');
    }
}
