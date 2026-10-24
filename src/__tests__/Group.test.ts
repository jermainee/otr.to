import {waitFor} from "@testing-library/react";
import Group, {GroupListener} from "../Service/Group";
import RoomKey from "../Service/RoomKey";
import Packet from "../Struct/Packet";
import FakePeer, {FakeDataConnection} from "../__mocks__/peerjs";

const SECRET = 'TestSecretForTheLinks0';
const key = new RoomKey(SECRET);

let listener: jest.Mocked<GroupListener>;
let groups: Group[];

beforeEach(() => {
    FakePeer.reset();
    groups = [];
    listener = {
        onJoin: jest.fn(),
        onLeave: jest.fn(),
        onPacket: jest.fn(),
        onTurnedAway: jest.fn(),
        onError: jest.fn(),
    };
});

afterEach(() => groups.forEach(group => group.close()));

/** A group as the browser with the id `m` sees it; ids compare as strings, so `a` dials `z`. */
function makeGroup(entry: string | null = null, id: string = 'm'): {group: Group, peer: FakePeer} {
    const group = new Group(id, key, {}, listener, entry);
    groups.push(group);

    return {group, peer: FakePeer.instances[FakePeer.instances.length - 1]};
}

/** A connection someone else opened to the group. */
function incoming(peer: FakePeer, peerId: string): FakeDataConnection {
    const connection = new FakeDataConnection(peerId);
    peer.emit('connection', connection);
    connection.emit('open');

    return connection;
}

async function deliver(connection: FakeDataConnection, packet: Packet): Promise<void> {
    await connection.emitAndSettle('data', await key.seal(packet, connection.peer));
}

const hello = (connection: FakeDataConnection, ids: string[] = []) => deliver(connection, {type: 'members', ids});

/** What the group sent over a connection, once at least `count` packets left. */
async function sentOver(connection: FakeDataConnection, count: number = 1, from: string = 'm'): Promise<Packet[]> {
    await waitFor(() => expect(connection.sent.length).toBeGreaterThanOrEqual(count));

    return Promise.all(connection.sent.map(data => key.open(data, from)));
}

const dialled = (peer: FakePeer) => peer.outgoing.map(connection => connection.peer);

describe('Joining a chat through a link', () => {
    it('dials the link’s peer once its own peer is registered', () => {
        const {peer} = makeGroup('entry');

        expect(dialled(peer)).toEqual([]);

        peer.emit('open', 'm');

        expect(dialled(peer)).toEqual(['entry']);
    });

    it('counts the link’s peer and everyone it is with as there before', async () => {
        const {peer} = makeGroup('entry');
        peer.emit('open', 'm');
        const connection = peer.outgoing[0];
        connection.emit('open');

        await hello(connection, ['x', 'y']);

        expect(listener.onJoin).toHaveBeenCalledWith('entry', true);

        await hello(incoming(peer, 'x'));

        expect(listener.onJoin).toHaveBeenLastCalledWith('x', true);
    });

    it('dials those of them with a higher id, and waits for the others to dial', async () => {
        const {peer} = makeGroup('entry');
        peer.emit('open', 'm');
        peer.outgoing[0].emit('open');

        await hello(peer.outgoing[0], ['a', 'z', 'm']);

        expect(dialled(peer)).toEqual(['entry', 'z']);
    });

    it('is turned away when the link’s peer hangs up before saying hello', () => {
        const {peer} = makeGroup('entry');
        peer.emit('open', 'm');
        peer.outgoing[0].emit('open');

        peer.outgoing[0].emit('close');

        expect(listener.onTurnedAway).toHaveBeenCalledTimes(1);
        expect(listener.onJoin).not.toHaveBeenCalled();
    });

    it('gives up on the link’s peer when it does not say hello in time', () => {
        jest.useFakeTimers();

        try {
            const {peer} = makeGroup('entry');
            peer.emit('open', 'm');

            jest.advanceTimersByTime(5999);
            expect(listener.onTurnedAway).not.toHaveBeenCalled();

            jest.advanceTimersByTime(1);
            expect(listener.onTurnedAway).toHaveBeenCalledTimes(1);
            expect(peer.outgoing[0].closed).toBe(true);
        } finally {
            jest.useRealTimers();
        }
    });
});

describe('Letting people in', () => {
    it('greets a new connection with who is in the chat', async () => {
        const {peer} = makeGroup();
        await hello(incoming(peer, 'x'));

        const second = incoming(peer, 'y');

        expect((await sentOver(second))[0]).toEqual({type: 'members', ids: ['x']});
    });

    it('counts someone as in the chat once their hello opens with the key, as a newcomer', async () => {
        const {peer} = makeGroup();
        const connection = incoming(peer, 'x');

        expect(listener.onJoin).not.toHaveBeenCalled();

        await hello(connection);

        expect(listener.onJoin).toHaveBeenCalledWith('x', false);
    });

    it('closes a connection whose first words do not open with the key, without a word', async () => {
        const {peer} = makeGroup();
        const connection = incoming(peer, 'x');

        await connection.emitAndSettle('data', await new RoomKey().seal({type: 'members', ids: []}, 'x'));

        expect(connection.closed).toBe(true);
        expect(listener.onJoin).not.toHaveBeenCalled();
        expect(listener.onLeave).not.toHaveBeenCalled();
    });

    it('ignores anything a peer says before its hello', async () => {
        const {peer} = makeGroup();
        const connection = incoming(peer, 'x');

        await deliver(connection, {type: 'text', text: 'let me in'});

        expect(listener.onPacket).not.toHaveBeenCalled();
        expect(listener.onJoin).not.toHaveBeenCalled();
    });

    it('tells everyone, the newcomer included, who is in the chat now', async () => {
        const {peer} = makeGroup();
        const first = incoming(peer, 'x');
        await hello(first);

        const second = incoming(peer, 'y');
        await hello(second);

        expect((await sentOver(first, 3)).slice(-1)).toEqual([{type: 'members', ids: ['x', 'y']}]);
        expect((await sentOver(second, 2)).slice(-1)).toEqual([{type: 'members', ids: ['x', 'y']}]);
    });

    it('keeps one connection to a peer that dials in twice', async () => {
        const {peer} = makeGroup();
        const first = incoming(peer, 'x');
        await hello(first);

        const second = incoming(peer, 'x');
        await hello(second);

        expect(second.closed).toBe(true);
        expect(first.closed).toBe(false);
        expect(listener.onJoin).toHaveBeenCalledTimes(1);
        expect(listener.onLeave).not.toHaveBeenCalled();
    });

    it('does not dial itself, or anyone it is connected to', async () => {
        const {peer} = makeGroup();
        const connection = incoming(peer, 'x');
        await hello(connection);

        await deliver(connection, {type: 'members', ids: ['m', 'x', 'z', 'z']});

        expect(dialled(peer)).toEqual(['z']);
    });

    it('reports a peer that leaves, and only once', async () => {
        const {peer} = makeGroup();
        const connection = incoming(peer, 'x');
        await hello(connection);

        connection.emit('close');
        connection.emit('close');

        expect(listener.onLeave).toHaveBeenCalledTimes(1);
        expect(listener.onLeave).toHaveBeenCalledWith('x', false);
    });

    it('does not report a connection that closes before its hello', () => {
        const {peer} = makeGroup();

        incoming(peer, 'x').emit('close');

        expect(listener.onLeave).not.toHaveBeenCalled();
        expect(listener.onTurnedAway).not.toHaveBeenCalled();
    });
});

describe('Talking', () => {
    it('hands on what members say, with who said it', async () => {
        const {peer} = makeGroup();
        const connection = incoming(peer, 'x');
        await hello(connection);

        await deliver(connection, {type: 'text', text: 'hi all'});

        expect(listener.onPacket).toHaveBeenCalledWith({type: 'text', text: 'hi all'}, 'x');
    });

    it('sends a packet to every member, sealed and in order', async () => {
        const {group, peer} = makeGroup();
        const first = incoming(peer, 'x');
        const second = incoming(peer, 'y');
        await hello(first);
        await hello(second);

        group.broadcast({type: 'text', text: 'one'});
        await group.broadcast({type: 'text', text: 'two'});

        for (const connection of [first, second]) {
            const texts = (await sentOver(connection)).filter(packet => packet.type === 'text');

            expect(texts).toEqual([{type: 'text', text: 'one'}, {type: 'text', text: 'two'}]);
        }
    });

    it('sends nothing to connections that have not said hello', async () => {
        const {group, peer} = makeGroup();
        const stranger = incoming(peer, 'x');

        await group.broadcast({type: 'text', text: 'secret'});

        const packets = await sentOver(stranger);

        expect(packets.filter(packet => packet.type === 'text')).toEqual([]);
    });
});

describe('Telling who is still there', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    /** Lets the heartbeats run for a while; beats are five seconds apart. */
    const wait = (milliseconds: number) => jest.advanceTimersByTime(milliseconds);

    /** Everything the group sealed and sent so far, opened. */
    async function flushedSentOver(group: Group, connection: FakeDataConnection): Promise<Packet[]> {
        // Packets leave in order, so once this one left, so did everything before it.
        await group.broadcast({type: 'text', text: 'flush'});

        return Promise.all(connection.sent.map(data => key.open(data, 'm')));
    }

    it('tells the members every five seconds that it is still there', async () => {
        const {group, peer} = makeGroup();
        const member = incoming(peer, 'x');
        await hello(member);

        wait(5000);
        const afterOne = (await flushedSentOver(group, member)).filter(packet => packet.type === 'heartbeat');
        wait(5000);
        const afterTwo = (await flushedSentOver(group, member)).filter(packet => packet.type === 'heartbeat');

        expect(afterOne).toHaveLength(1);
        expect(afterTwo).toHaveLength(2);
    });

    it('does not beat for connections that have not said hello', async () => {
        const {group, peer} = makeGroup();
        const stranger = incoming(peer, 'x');

        wait(5000);

        expect((await flushedSentOver(group, stranger)).map(packet => packet.type)).toEqual(['members']);
    });

    it('lets go of a member that went silent for half a minute, as lost', async () => {
        const {peer} = makeGroup();
        const member = incoming(peer, 'x');
        await hello(member);

        wait(30000);

        expect(listener.onLeave).not.toHaveBeenCalled();

        wait(5000);

        expect(listener.onLeave).toHaveBeenCalledTimes(1);
        expect(listener.onLeave).toHaveBeenCalledWith('x', true);
        expect(member.closed).toBe(true);
    });

    it('keeps a member that keeps beating', async () => {
        const {peer} = makeGroup();
        const member = incoming(peer, 'x');
        await hello(member);

        for (let beat = 0; beat < 12; beat++) {
            wait(5000);
            await deliver(member, {type: 'heartbeat'});
        }

        expect(listener.onLeave).not.toHaveBeenCalled();
        expect(member.closed).toBe(false);
    });

    it('counts anything that arrives as a sign of life, before it is even opened', async () => {
        const {peer} = makeGroup();
        const member = incoming(peer, 'x');
        await hello(member);

        wait(25000);
        member.emit('data', await key.seal({type: 'file-chunk', fileId: 'f', chunkIndex: 0, chunk: new ArrayBuffer(8)}, 'x'));
        wait(25000);

        expect(listener.onLeave).not.toHaveBeenCalled();
    });

    it('does not hand on heartbeats', async () => {
        const {peer} = makeGroup();
        const member = incoming(peer, 'x');
        await hello(member);

        await deliver(member, {type: 'heartbeat'});

        expect(listener.onPacket).not.toHaveBeenCalled();
    });

    it('gives everyone a fresh start after this browser was asleep itself', async () => {
        const {peer} = makeGroup();
        const member = incoming(peer, 'x');
        await hello(member);

        // A frozen tab runs no timers; the clock goes on all the same.
        jest.setSystemTime(Date.now() + 120000);
        wait(5000);

        expect(listener.onLeave).not.toHaveBeenCalled();

        wait(35000);

        expect(listener.onLeave).toHaveBeenCalledWith('x', true);
    });

    it('stops beating once it left', async () => {
        const {group, peer} = makeGroup();
        const member = incoming(peer, 'x');
        await hello(member);
        const sent = member.sent.length;

        group.close();
        wait(60000);

        expect(member.sent).toHaveLength(sent);
        expect(listener.onLeave).not.toHaveBeenCalled();
    });
});

describe('Leaving', () => {
    it('closes every connection and lets go of the peer id', async () => {
        const {group, peer} = makeGroup();
        const member = incoming(peer, 'x');
        await hello(member);
        const stranger = incoming(peer, 'y');

        group.close();

        expect(member.closed).toBe(true);
        expect(stranger.closed).toBe(true);
        expect(peer.destroyed).toBe(true);
    });

    it('reports nothing once it left', async () => {
        const {group, peer} = makeGroup();
        const member = incoming(peer, 'x');
        await hello(member);

        group.close();

        expect(listener.onLeave).not.toHaveBeenCalled();
    });

    it('passes on what peerjs reports', () => {
        const {peer} = makeGroup();

        peer.emit('error', {type: 'network'});

        expect(listener.onError).toHaveBeenCalledWith({type: 'network'});
    });
});
