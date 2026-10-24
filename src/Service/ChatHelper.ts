import RoomKey from "./RoomKey";

/** Where a chat link points: the peer to dial and the secret of the chat's key. */
export interface ChatLink {
    peerId: string;
    secret: string;
}

/*
 * Nicknames are an adjective and an animal, both short, and both lists have
 * 48 entries, which makes 2,304 names. Two people in one chat getting the
 * same one is rare, and harmless: the names only help tell people apart.
 */
const ADJECTIVES = [
    'Amber', 'Bold', 'Brave', 'Bright', 'Brisk', 'Calm', 'Clever', 'Cosy',
    'Crisp', 'Curious', 'Daring', 'Eager', 'Fair', 'Fancy', 'Gentle', 'Glad',
    'Golden', 'Grand', 'Happy', 'Humble', 'Jolly', 'Keen', 'Kind', 'Lively',
    'Lucky', 'Merry', 'Mighty', 'Misty', 'Noble', 'Polite', 'Proud', 'Quick',
    'Quiet', 'Rapid', 'Rosy', 'Royal', 'Rusty', 'Shy', 'Silent', 'Silver',
    'Sleepy', 'Snowy', 'Sunny', 'Swift', 'Tiny', 'Wild', 'Wise', 'Witty',
];

const ANIMALS = [
    'Badger', 'Bear', 'Beaver', 'Bison', 'Crane', 'Crow', 'Deer', 'Dolphin',
    'Dove', 'Eagle', 'Falcon', 'Ferret', 'Finch', 'Fox', 'Gecko', 'Goose',
    'Hare', 'Hawk', 'Heron', 'Ibex', 'Koala', 'Lark', 'Lemur', 'Lion',
    'Llama', 'Lynx', 'Marten', 'Mole', 'Moose', 'Moth', 'Newt', 'Otter',
    'Owl', 'Panda', 'Puffin', 'Quail', 'Rabbit', 'Raven', 'Robin', 'Seal',
    'Sparrow', 'Stork', 'Swan', 'Tiger', 'Toad', 'Wolf', 'Wren', 'Yak',
];

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

    /** The link that brings someone into the chat: the peer to dial, then the chat's secret. */
    public static chatLink(peerId: string, secret: string): string
    {
        return 'https://otr.to/#' + peerId + '.' + secret;
    }

    /** Reads a link's part after the #, or says it is no chat link, for example because it was cut off. */
    public static parseLink(fragment: string): ChatLink | null
    {
        const [peerId, secret, ...rest] = fragment.split('.');

        if (!peerId || secret === undefined || rest.length > 0 || !RoomKey.isValid(secret)) {
            return null;
        }

        return {peerId, secret};
    }

    /**
     * A short name for a peer. It only depends on the peer id, so everyone in
     * a chat comes up with the same name for the same person without asking.
     */
    public static nickname(peerId: string): string
    {
        // FNV-1a, which spreads even similar ids over the whole range.
        let hash = 0x811c9dc5;

        for (let index = 0; index < peerId.length; index++) {
            hash ^= peerId.charCodeAt(index);
            hash = Math.imul(hash, 0x01000193) >>> 0;
        }

        return ADJECTIVES[hash % ADJECTIVES.length] + ' ' + ANIMALS[Math.floor(hash / ADJECTIVES.length) % ANIMALS.length];
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
