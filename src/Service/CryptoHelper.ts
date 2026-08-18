export default class CryptoHelper
{
    private static readonly textEncoder = new TextEncoder();
    private static readonly textDecoder = new TextDecoder();

    public static async deriveKey(code: string): Promise<CryptoKey>
    {
        const baseKey = await crypto.subtle.importKey(
            'raw',
            this.textEncoder.encode(code),
            'PBKDF2',
            false,
            ['deriveKey']
        );

        const salt = this.textEncoder.encode('otr.to');

        return crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
            baseKey,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }

    public static async encrypt(key: CryptoKey, plaintext: string): Promise<string>
    {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ciphertext = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            this.textEncoder.encode(plaintext)
        );

        return JSON.stringify({
            iv: this.toBase64(iv),
            ct: this.toBase64(new Uint8Array(ciphertext)),
        });
    }

    public static async decrypt(key: CryptoKey, payload: string): Promise<string>
    {
        const { iv, ct } = JSON.parse(payload);
        const plaintext = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: this.fromBase64(iv) },
            key,
            this.fromBase64(ct)
        );

        return this.textDecoder.decode(plaintext);
    }

    private static toBase64(bytes: Uint8Array): string
    {
        let binary = '';
        bytes.forEach(byte => binary += String.fromCharCode(byte));
        return btoa(binary);
    }

    private static fromBase64(base64: string): Uint8Array
    {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }
}