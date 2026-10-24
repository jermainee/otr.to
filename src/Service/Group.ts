import Peer, {DataConnection} from "peerjs";
import RoomKey from "./RoomKey";
import Packet from "../Struct/Packet";

/**
 * How long a connection gets to show that it holds the chat's key. Between
 * two devices on different networks, finding a route and opening the channel
 * alone can take several seconds, more so over mobile data.
 */
const HELLO_TIMEOUT = 15000;

/** How often members tell each other they are still there. */
const HEARTBEAT_INTERVAL = 5000;

/**
 * How long a member may stay silent before it counts as gone. A tab that
 * crashed or froze, or one whose network dropped, does not close its
 * connections, so silence is the only sign of it.
 */
const SILENCE_TIMEOUT = 30000;

export interface GroupListener {
    /**
     * Someone showed they hold the chat's key and is in the chat now.
     * `wasThere` is set for the people who were in it before this browser.
     */
    onJoin(peerId: string, wasThere: boolean): void;
    /**
     * Someone is no longer in the chat. `wasLost` is set when they went
     * silent rather than hanging up, which may as well be this browser's fault.
     */
    onLeave(peerId: string, wasLost: boolean): void;
    onPacket(packet: Packet, from: string): void;
    /** The peer the link points at never let this browser in. */
    onTurnedAway(): void;
    /** What peerjs reports, such as a connection server out of reach. */
    onError(error: {type: string}): void;
}

/**
 * A chat between any number of peers, each connected to each other one, so
 * that it goes on whoever leaves.
 *
 * Someone joins by dialling the peer their link points at. Peers greet every
 * connection with a list of everyone they are connected to, and send that
 * list round again whenever someone joins, which is how a newcomer and the
 * others learn about each other. Of two peers that do, the one with the lower
 * id dials, so that they do not end up connected twice.
 *
 * Everything that crosses a connection is sealed with the chat's key, and a
 * peer only counts as in the chat once something it sent opens with that key.
 *
 * Members beat every few seconds, and a member nobody heard from for a while
 * is let go, since a crashed tab or a dropped network never says goodbye.
 */
export default class Group {
    private readonly peer: Peer;
    /** Everyone in the chat, by peer id. */
    private readonly members = new Map<string, DataConnection>();
    /** Every connection, in the chat or not yet, so that closing reaches them all. */
    private readonly connections = new Set<DataConnection>();
    /** The peers this browser dialled and still waits for. */
    private readonly dialling = new Set<string>();
    /** Who was in the chat before this browser joined it. */
    private readonly earlier = new Set<string>();
    private readonly timers = new Map<DataConnection, number>();
    /** When something last arrived over each connection. */
    private readonly lastHeard = new Map<DataConnection, number>();
    private readonly heartbeat: number;
    private lastBeat = Date.now();
    /** Seals and sends one packet after another, so they leave in order. */
    private outbox: Promise<void> = Promise.resolve();
    private hasJoined = false;
    private isClosed = false;

    /**
     * @param entry the peer the link points at, or null when this browser
     *              made the link and waits for others to dial it
     */
    public constructor(
        private readonly id: string,
        private readonly key: RoomKey,
        config: RTCConfiguration,
        private readonly listener: GroupListener,
        private readonly entry: string | null = null,
    ) {
        this.peer = new Peer(id, {config});

        this.peer.on('connection', connection => this.attach(connection));
        this.peer.on('error', error => this.listener.onError(error));

        if (entry !== null) {
            this.peer.on('open', () => this.dial(entry));
        }

        this.heartbeat = window.setInterval(this.beat, HEARTBEAT_INTERVAL);
    }

    /** Sends a packet to everyone in the chat. The promise settles once it left. */
    public broadcast(packet: Packet): Promise<void> {
        return this.send(packet, () => Array.from(this.members.values()));
    }

    /**
     * Leaves the chat: closes every connection, which tells the others, and
     * lets go of the peer id, so that links to it stop working.
     */
    public close(): void {
        this.isClosed = true;
        window.clearInterval(this.heartbeat);
        Array.from(this.connections).forEach(connection => this.disconnect(connection));
        this.peer.destroy();
    }

    private dial(peerId: string): void {
        if (peerId === this.id || this.members.has(peerId) || this.dialling.has(peerId) || this.isClosed) {
            return;
        }

        this.dialling.add(peerId);
        this.attach(this.peer.connect(peerId, {reliable: true}));
    }

    private attach(connection: DataConnection): void {
        let inbox = Promise.resolve();

        this.connections.add(connection);
        this.timers.set(connection, window.setTimeout(() => this.disconnect(connection), HELLO_TIMEOUT));

        connection.on('open', () => {
            this.send({type: 'members', ids: Array.from(this.members.keys())}, () => [connection]);
        });

        // Opening a packet takes a moment, so queue them to handle them in the
        // order they came. Returns the queue for whoever wants to wait for it;
        // peerjs does not.
        connection.on('data', data => {
            this.lastHeard.set(connection, Date.now());

            return inbox = inbox
                .then(() => this.receive(connection, data))
                .catch(error => console.log('error', error));
        });

        connection.on('close', () => this.drop(connection));
        connection.on('error', error => console.log('error', error));
    }

    private async receive(connection: DataConnection, data: unknown): Promise<void> {
        let packet: Packet;

        try {
            packet = await this.key.open(data, connection.peer);
        } catch {
            // Someone without the key, or someone talking another language.
            if (this.members.get(connection.peer) !== connection) {
                this.disconnect(connection);
            }

            return;
        }

        if (this.isClosed) {
            return;
        }

        if (this.members.get(connection.peer) !== connection) {
            // Nothing counts before the hello, which is a list of members.
            if (packet.type !== 'members' || !this.admit(connection, packet.ids)) {
                return;
            }
        }

        if (packet.type === 'members') {
            // The lower id dials, the higher one waits to be dialled.
            packet.ids.filter(id => this.id < id).forEach(id => this.dial(id));
        } else if (packet.type !== 'heartbeat') {
            this.listener.onPacket(packet, connection.peer);
        }
    }

    /** Tells everyone this browser is still here, and lets go of whoever went silent. */
    private beat = () => {
        const now = Date.now();

        // A beat long overdue means this browser was asleep, say in a frozen
        // background tab, and it cannot tell who else was. Start afresh.
        if (now - this.lastBeat > SILENCE_TIMEOUT) {
            this.members.forEach(connection => this.lastHeard.set(connection, now));
        }

        this.lastBeat = now;

        this.members.forEach(connection => {
            if (now - this.lastHeard.get(connection) > SILENCE_TIMEOUT) {
                this.disconnect(connection, true);
            }
        });

        if (this.members.size > 0) {
            this.broadcast({type: 'heartbeat'});
        }
    }

    /** Lets a peer into the chat, unless it already is, over another connection. */
    private admit(connection: DataConnection, ids: string[]): boolean {
        const peerId = connection.peer;

        if (this.members.has(peerId)) {
            this.disconnect(connection);
            return false;
        }

        window.clearTimeout(this.timers.get(connection));
        this.timers.delete(connection);
        this.dialling.delete(peerId);

        if (!this.hasJoined && peerId === this.entry) {
            // Whoever the link's peer is with was in the chat before us.
            [peerId, ...ids].forEach(id => this.earlier.add(id));
        }

        this.hasJoined = true;
        this.members.set(peerId, connection);
        this.lastHeard.set(connection, Date.now());
        this.listener.onJoin(peerId, this.earlier.has(peerId));

        // Tell everyone, the newcomer included, who is in the chat now.
        this.broadcast({type: 'members', ids: Array.from(this.members.keys())});

        return true;
    }

    /**
     * Closes a connection. peerjs only reports that for open ones, and then
     * as a plain close, so take care of it here first.
     */
    private disconnect(connection: DataConnection, wasLost: boolean = false): void {
        this.drop(connection, wasLost);
        connection.close();
    }

    private drop(connection: DataConnection, wasLost: boolean = false): void {
        if (!this.connections.delete(connection)) {
            return;
        }

        window.clearTimeout(this.timers.get(connection));
        this.timers.delete(connection);
        this.lastHeard.delete(connection);
        this.dialling.delete(connection.peer);

        if (this.isClosed) {
            return;
        }

        if (this.members.get(connection.peer) === connection) {
            this.members.delete(connection.peer);
            this.listener.onLeave(connection.peer, wasLost);
        } else if (!this.hasJoined && connection.peer === this.entry) {
            this.listener.onTurnedAway();
        }
    }

    private send(packet: Packet, recipients: () => DataConnection[]): Promise<void> {
        this.outbox = this.outbox
            .then(async () => {
                const sealed = await this.key.seal(packet, this.id);

                recipients()
                    .filter(connection => this.connections.has(connection))
                    .forEach(connection => connection.send(sealed));
            })
            .catch(error => console.log('error', error));

        return this.outbox;
    }
}
