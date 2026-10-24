import ChatHelper from "../Service/ChatHelper";

describe('ChatHelper.formatFileSize', () => {
    it.each([
        [0, '0 Bytes'],
        [512, '512 Bytes'],
        [2048, '2 KB'],
        [1536, '1.5 KB'],
        [5 * 1024 * 1024, '5 MB'],
        [3 * 1024 * 1024 * 1024, '3 GB'],
    ])('renders %i bytes as %s', (size, formatted) => {
        expect(ChatHelper.formatFileSize(size)).toBe(formatted);
    });
});

describe('ChatHelper.generatePeerId', () => {
    it('generates an id of the length the share link expects', () => {
        expect(ChatHelper.generatePeerId()).toHaveLength(22);
    });

    it('does not hand out the same id twice', () => {
        const ids = new Set(Array.from({length: 50}, () => ChatHelper.generatePeerId()));

        expect(ids.size).toBe(50);
    });

    it('falls back to Math.random when the browser has no crypto', () => {
        const crypto = window.crypto;
        Object.defineProperty(window, 'crypto', {value: undefined, configurable: true});

        try {
            expect(ChatHelper.generatePeerId()).toMatch(/^[a-z0-9]+$/);
        } finally {
            Object.defineProperty(window, 'crypto', {value: crypto, configurable: true});
        }
    });
});

describe('ChatHelper.chatLink and parseLink', () => {
    const secret = 'TestSecretForTheLinks0';

    it('puts the peer id and the secret after the #', () => {
        expect(ChatHelper.chatLink('a1b2c3', secret)).toBe('https://otr.to/#a1b2c3.' + secret);
    });

    it('reads back what it put there', () => {
        const link = ChatHelper.chatLink(ChatHelper.generatePeerId(), secret);

        expect(ChatHelper.parseLink(link.split('#')[1])).toEqual({peerId: link.split('#')[1].split('.')[0], secret});
    });

    it.each([
        ['nothing', ''],
        ['a peer id alone', 'a1b2c3'],
        ['a secret alone', '.' + secret],
        ['a peer id with an empty secret', 'a1b2c3.'],
        ['a secret cut short', 'a1b2c3.' + secret.substring(0, 10)],
        ['one part too many', 'a1b2c3.' + secret + '.more'],
    ])('rejects %s', (_, fragment) => {
        expect(ChatHelper.parseLink(fragment)).toBeNull();
    });
});

describe('ChatHelper.nickname', () => {
    it('gives the same peer the same name, wherever it is asked', () => {
        expect(ChatHelper.nickname('a-peer-id')).toBe(ChatHelper.nickname('a-peer-id'));
    });

    it('is short: an adjective and an animal', () => {
        expect(ChatHelper.nickname(ChatHelper.generatePeerId())).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
    });

    it('tells most peers apart', () => {
        const names = new Set(Array.from({length: 20}, () => ChatHelper.nickname(ChatHelper.generatePeerId())));

        expect(names.size).toBeGreaterThanOrEqual(18);
    });

    it('gives similar ids different names', () => {
        expect(ChatHelper.nickname('peer-a')).not.toBe(ChatHelper.nickname('peer-b'));
    });
});
