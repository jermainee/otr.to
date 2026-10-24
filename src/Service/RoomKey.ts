import Packet from "../Struct/Packet";

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/** 22 letters and digits carry about 131 bits, more than the 128 AES needs. */
const SECRET_LENGTH = 22;

/** What AES-GCM expects for a nonce. */
const IV_LENGTH = 12;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * The key a chat is encrypted with. Its secret travels in the link, after the
 * #, which browsers never send to a server: neither the signalling server nor
 * a TURN relay learns it, so neither can read or forge what the peers say,
 * even if one of them sat in the middle of the WebRTC connection.
 *
 * Everyone in a chat holds the same key, because they all opened a link to it.
 */
export default class RoomKey {
    /** What goes into the link. */
    public readonly secret: string;
    private readonly key: Promise<CryptoKey>;

    public constructor(secret: string = RoomKey.generateSecret()) {
        this.secret = secret;
        this.key = RoomKey.derive(secret);
    }

    /** Whether a secret read from a link is one this class could have made. */
    public static isValid(secret: string): boolean {
        return secret.length === SECRET_LENGTH && Array.from(secret).every(letter => ALPHABET.includes(letter));
    }

    /**
     * Encrypts a packet for the rest of the chat. The sender's peer id is
     * authenticated along with it, so it cannot be passed off as someone
     * else's.
     */
    public async seal(packet: Packet, sender: string): Promise<ArrayBuffer> {
        const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
        const sealed = await window.crypto.subtle.encrypt(
            {name: 'AES-GCM', iv, additionalData: encoder.encode(sender)},
            await this.key,
            encode(packet),
        );

        const data = new Uint8Array(IV_LENGTH + sealed.byteLength);
        data.set(iv);
        data.set(new Uint8Array(sealed), IV_LENGTH);

        return data.buffer;
    }

    /** Decrypts what a peer sent, and rejects anything that was not sealed with this key by that peer. */
    public async open(data: unknown, sender: string): Promise<Packet> {
        const bytes = data instanceof ArrayBuffer
            ? new Uint8Array(data)
            : ArrayBuffer.isView(data) ? new Uint8Array(data.buffer as ArrayBuffer, data.byteOffset, data.byteLength) : null;

        if (bytes === null || bytes.byteLength <= IV_LENGTH) {
            throw new Error('Not an encrypted packet');
        }

        const plain = await window.crypto.subtle.decrypt(
            {name: 'AES-GCM', iv: bytes.subarray(0, IV_LENGTH), additionalData: encoder.encode(sender)},
            await this.key,
            bytes.subarray(IV_LENGTH),
        );

        return decode(new Uint8Array(plain));
    }

    private static generateSecret(): string {
        let secret = '';

        while (secret.length < SECRET_LENGTH) {
            window.crypto.getRandomValues(new Uint8Array(SECRET_LENGTH)).forEach(byte => {
                // 248 is the last multiple of 62 below 256. Taking the bytes
                // above it as well would make the first letters likelier.
                if (byte < 248 && secret.length < SECRET_LENGTH) {
                    secret += ALPHABET[byte % ALPHABET.length];
                }
            });
        }

        return secret;
    }

    private static async derive(secret: string): Promise<CryptoKey> {
        const material = await window.crypto.subtle.importKey('raw', encoder.encode(secret), 'HKDF', false, ['deriveKey']);

        return window.crypto.subtle.deriveKey(
            {name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: encoder.encode('otr.to chat')},
            material,
            {name: 'AES-GCM', length: 256},
            false,
            ['encrypt', 'decrypt'],
        );
    }
}

/**
 * Lays a packet out as the length of a JSON header, the header and, for a
 * file chunk, the raw bytes of the chunk, which JSON would bloat.
 */
function encode(packet: Packet): Uint8Array<ArrayBuffer> {
    const {chunk, ...header} = packet as Packet & {chunk?: ArrayBuffer};
    const json = encoder.encode(JSON.stringify(header));
    const body = chunk === undefined ? new Uint8Array(0) : new Uint8Array(chunk);

    const bytes = new Uint8Array(4 + json.byteLength + body.byteLength);
    new DataView(bytes.buffer).setUint32(0, json.byteLength);
    bytes.set(json, 4);
    bytes.set(body, 4 + json.byteLength);

    return bytes;
}

function decode(bytes: Uint8Array): Packet {
    const length = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
    const packet = JSON.parse(decoder.decode(bytes.subarray(4, 4 + length)));

    if (packet.type === 'file-chunk') {
        packet.chunk = bytes.slice(4 + length).buffer;
    }

    return packet;
}
