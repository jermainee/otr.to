import ChatHelper from "../Service/ChatHelper";

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
