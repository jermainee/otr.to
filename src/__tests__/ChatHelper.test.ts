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
