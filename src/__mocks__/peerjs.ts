/**
 * Minimal stand-in for peerjs. The real library opens a signalling connection as
 * soon as it is constructed, which is neither available nor desirable in tests.
 *
 * Wired up through `moduleNameMapper` in jest.config.js, so every test gets it
 * without an explicit `jest.mock('peerjs')`.
 */

type Handler = (...args: any[]) => void;

class FakeEmitter {
    private handlers = new Map<string, Handler[]>();

    public on(event: string, handler: Handler): this {
        const handlers = this.handlers.get(event) || [];
        handlers.push(handler);
        this.handlers.set(event, handlers);

        return this;
    }

    /** Test helper: fire an event the real peerjs would have fired. */
    public emit(event: string, ...args: any[]): void {
        (this.handlers.get(event) || []).forEach(handler => handler(...args));
    }
}

export class FakeDataConnection extends FakeEmitter {
    /** Everything passed to send(), so tests can assert on the wire format. */
    public readonly sent: any[] = [];

    public constructor(public readonly peer: string) {
        super();
    }

    public send(data: any): void {
        this.sent.push(data);
    }
}

export default class FakePeer extends FakeEmitter {
    /** Every peer constructed since the last reset(), in order. */
    public static instances: FakePeer[] = [];

    public readonly connections = {};
    public readonly outgoing: FakeDataConnection[] = [];

    public constructor(public readonly id: string, public readonly options: any) {
        super();
        FakePeer.instances.push(this);
    }

    public connect(targetPeerId: string): FakeDataConnection {
        const connection = new FakeDataConnection(targetPeerId);
        this.outgoing.push(connection);

        return connection;
    }

    public static reset(): void {
        FakePeer.instances = [];
    }
}
