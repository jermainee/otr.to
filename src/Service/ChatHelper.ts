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

    public static formatFileSize(bytes: number): string
    {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}
