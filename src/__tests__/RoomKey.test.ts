import RoomKey from "../Service/RoomKey";

const SECRET = 'TestSecretForTheLinks0';

describe('RoomKey', () => {
    it('makes a secret of 22 letters and digits, which a link carries as it is', () => {
        expect(new RoomKey().secret).toMatch(/^[0-9A-Za-z]{22}$/);
    });

    it('makes a new secret every time', () => {
        const secrets = new Set(Array.from({length: 50}, () => new RoomKey().secret));

        expect(secrets.size).toBe(50);
    });

    it.each([
        [SECRET, true],
        ['TestSecretForTheLinks', false],
        ['TestSecretForTheLinks00', false],
        ['TestSecretForTheLink_0', false],
        ['', false],
    ])('tells that %p is a valid secret: %p', (secret, isValid) => {
        expect(RoomKey.isValid(secret)).toBe(isValid);
    });

    it('opens what it sealed', async () => {
        const key = new RoomKey(SECRET);

        const sealed = await key.seal({type: 'text', text: 'hello'}, 'alice');

        expect(await key.open(sealed, 'alice')).toEqual({type: 'text', text: 'hello'});
    });

    it('opens it with another key made from the same secret, which is what the others hold', async () => {
        const sealed = await new RoomKey(SECRET).seal({type: 'members', ids: ['bob']}, 'alice');

        expect(await new RoomKey(SECRET).open(sealed, 'alice')).toEqual({type: 'members', ids: ['bob']});
    });

    it('keeps the bytes of a file chunk as they are', async () => {
        const key = new RoomKey(SECRET);
        const chunk = Uint8Array.from([0, 1, 2, 250, 255]).buffer;

        const sealed = await key.seal({type: 'file-chunk', fileId: 'file-1', chunkIndex: 3, chunk}, 'alice');
        const opened = await key.open(sealed, 'alice');

        expect(opened).toMatchObject({type: 'file-chunk', fileId: 'file-1', chunkIndex: 3});
        expect(Array.from(new Uint8Array((opened as {chunk: ArrayBuffer}).chunk))).toEqual([0, 1, 2, 250, 255]);
    });

    it('opens what arrives as a view of a buffer, too', async () => {
        const key = new RoomKey(SECRET);
        const sealed = new Uint8Array(await key.seal({type: 'text', text: 'hello'}, 'alice'));

        expect(await key.open(sealed, 'alice')).toEqual({type: 'text', text: 'hello'});
    });

    it('hides what it seals', async () => {
        const sealed = await new RoomKey(SECRET).seal({type: 'text', text: 'the meeting is at noon'}, 'alice');

        expect(new TextDecoder().decode(sealed)).not.toContain('noon');
    });

    it('seals the same packet differently every time', async () => {
        const key = new RoomKey(SECRET);

        const first = new Uint8Array(await key.seal({type: 'text', text: 'hello'}, 'alice'));
        const second = new Uint8Array(await key.seal({type: 'text', text: 'hello'}, 'alice'));

        expect(Array.from(first)).not.toEqual(Array.from(second));
    });

    it('does not open what another key sealed', async () => {
        const sealed = await new RoomKey().seal({type: 'text', text: 'hello'}, 'alice');

        await expect(new RoomKey(SECRET).open(sealed, 'alice')).rejects.toThrow();
    });

    it('does not open what claims to come from someone other than who sealed it', async () => {
        const key = new RoomKey(SECRET);
        const sealed = await key.seal({type: 'text', text: 'hello'}, 'alice');

        await expect(key.open(sealed, 'mallory')).rejects.toThrow();
    });

    it('does not open what was changed on the way', async () => {
        const key = new RoomKey(SECRET);
        const sealed = new Uint8Array(await key.seal({type: 'text', text: 'hello'}, 'alice'));
        sealed[sealed.length - 1] ^= 1;

        await expect(key.open(sealed.buffer, 'alice')).rejects.toThrow();
    });

    it.each([
        ['plain text', 'hello'],
        ['an object', {type: 'text', text: 'hello'}],
        ['too few bytes', new ArrayBuffer(8)],
        ['nothing', undefined],
    ])('does not open %s', async (_, data) => {
        await expect(new RoomKey(SECRET).open(data, 'alice')).rejects.toThrow();
    });
});
