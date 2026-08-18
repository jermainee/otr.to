import * as React from "react";
import Peer, { DataConnection } from "peerjs";
import ChatHelper from "./Service/ChatHelper";
import Message from "./Struct/Message";
import Messages from "./Messages";

interface IShoutProps {
    room?: string;
}

interface IShoutState {
    messages: Message[];
    connected: boolean;
    memberCount: number;
}

interface IPresence {
    type: 'presence';
    room: string;
    action: 'join' | 'leave';
    peerId: string;
    members: number;
}

export default class Shout extends React.Component<IShoutProps, IShoutState> {
    private readonly peerId = ChatHelper.generatePeerId();
    private readonly secure = window.location.protocol === 'https:';
    private readonly config = {
        host: window.location.hostname,
        port: Number(window.location.port) || (this.secure ? 443 : 80),
        path: '/peerjs',
        secure: this.secure,
        iceServers: [
            {urls: 'stun:46.165.240.76:3478'},
            {urls: 'stun:108.61.211.199:3478'},
            {urls: 'turn:46.165.240.76:3478', credential: 'asperTinO1', username: 'otrto'},
            {urls: 'turn:108.61.211.199:3478', credential: 'asperTinO1', username: 'otrto'}
        ]
    };

    private readonly room: string;
    private readonly connections = new Map<string, DataConnection>();
    private readonly connecting = new Set<string>();
    private readonly messageAreaRef = React.createRef<HTMLDivElement>();

    private peer: Peer;
    private ws: WebSocket;
    private peerReady = false;
    private wsReady = false;
    private joined = false;

    public constructor(props: IShoutProps) {
        super(props);
        this.room = props.room || 'main';
        this.state = {
            messages: [],
            connected: false,
            memberCount: 0,
        };
    }

    public componentDidMount() {
        this.openPeer();
        this.openSocket();
    }

    public componentWillUnmount() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'leave' }));
        }
        this.ws?.close();
        this.peer?.destroy();
    }

    public render() {
        return (
            <div style={{ marginBottom: '4rem' }}>
                <div className="container">
                    <div className="has-text-centered" style={{ padding: '1rem' }}>
                        <h1 className="title is-4">Shout · {this.room}</h1>
                        <div className="subtitle is-6">
                            {this.state.connected ? this.state.memberCount + ' member(s) online' : 'Connecting…'}
                        </div>
                    </div>
                    <div ref={this.messageAreaRef}
                         style={{ height: '55vh', overflowY: 'auto' }}>
                        <Messages messages={this.state.messages}/>
                    </div>
                </div>

                <div className="container" style={{ position: 'fixed', bottom: 0, right: '50%', transform: 'translateX(50%)', width: '100%', padding: '.5rem' }}>
                    <form onSubmit={this.sendMessage}>
                        <div className="columns is-mobile is-gapless">
                            <div className="column">
                                <input className="input is-fullwidth is-expanded"
                                       name="userInput"
                                       type="text"
                                       placeholder="Shout into the room"
                                       autoComplete="off"
                                       autoCapitalize="off"
                                       autoCorrect="off"
                                       spellCheck="false"
                                       style={{
                                           outline: 'none',
                                           boxShadow: 'none',
                                           borderRadius: '4px 0 0 4px',
                                           borderRight: 'none'
                                       }}
                                       required={true}
                                       autoFocus={true}
                                       disabled={!this.state.connected}
                                />
                            </div>

                            <div className="column is-narrow has-text-right">
                                <button className="button is-primary"
                                        style={{
                                            fontWeight: 'bold',
                                            borderRadius: '0 4px 4px 0'
                                        }}
                                        disabled={!this.state.connected}
                                >↣</button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    private openPeer(): void {
        this.peer = new Peer(this.peerId, this.config);

        this.peer.on('open', () => {
            this.peerReady = true;
            this.maybeJoin();
        });

        this.peer.on('connection', connection => {
            if (connection.peer === this.peerId || this.connections.has(connection.peer)) {
                connection.close();
                return;
            }

            this.connections.set(connection.peer, connection);
            this.wireConnection(connection);
            this.saveMessage(new Message('Connected to peer ' + connection.peer.slice(0, 8), true, true));
        });

        this.peer.on('error', error => console.log('shout error', error));
    }

    private openSocket(): void {
        const protocol = this.secure ? 'wss' : 'ws';
        this.ws = new WebSocket(protocol + '://' + window.location.host + '/shout');

        this.ws.onopen = () => {
            this.wsReady = true;
            this.maybeJoin();
        };

        this.ws.onmessage = event => {
            let msg;
            try {
                msg = JSON.parse(event.data);
            } catch {
                return;
            }

            if (msg.type !== 'presence') return;
            this.handlePresence(msg);
        };

        this.ws.onclose = () => {
            this.setState({ connected: false });
        };
    }

    private maybeJoin(): void {
        if (!this.peerReady || !this.wsReady || this.joined) return;

        this.joined = true;
        this.ws.send(JSON.stringify({ type: 'join', room: this.room, peerId: this.peerId }));
        this.saveMessage(new Message('Joined room ' + this.room, true, true));
        this.fetchMembers();
    }

    private handlePresence(presence: IPresence): void {
        this.setState({ memberCount: presence.members });

        if (presence.action === 'join') {
            if (presence.peerId === this.peerId) {
                this.setState({ connected: true });
            } else {
                this.connectTo(presence.peerId);
            }
        } else if (presence.action === 'leave') {
            const connection = this.connections.get(presence.peerId);
            if (connection) {
                connection.close();
                this.connections.delete(presence.peerId);
            }
            this.saveMessage(new Message('Peer left the room', true, true));
        }
    }

    private fetchMembers(): void {
        fetch("/api/rooms/" + this.room + "/members")
            .then(response => response.json())
            .then(data => {
                (data.members || []).forEach((peerId: string) => this.connectTo(peerId));
            })
            .catch(() => undefined);
    }

    private connectTo(peerId: string): void {
        if (peerId === this.peerId || this.connections.has(peerId) || this.connecting.has(peerId)) return;

        this.connecting.add(peerId);
        const connection = this.peer.connect(peerId, { reliable: true });

        connection.on('open', () => {
            this.connecting.delete(peerId);

            if (this.connections.has(peerId)) {
                connection.close();
                return;
            }

            this.connections.set(peerId, connection);
            this.wireConnection(connection);
            this.saveMessage(new Message('Connected to peer ' + peerId.slice(0, 8), true, true));
        });

        connection.on('error', () => this.connecting.delete(peerId));

        connection.on('close', () => {
            this.connecting.delete(peerId);
            if (this.connections.get(peerId) === connection) {
                this.connections.delete(peerId);
            }
        });
    }

    private wireConnection(connection: DataConnection): void {
        connection.on('data', data => {
            if (typeof data === 'string') {
                this.saveMessage(new Message(data, false));
            }
        });

        connection.on('close', () => {
            this.connections.delete(connection.peer);
        });
    }

    private sendMessage = (event) => {
        event.preventDefault();
        const message = event.target.elements.userInput.value;
        event.target.reset();

        this.saveMessage(new Message(message, true));

        for (const connection of this.connections.values()) {
            connection.send(message);
        }
    }

    private saveMessage = (message: Message) => {
        this.setState({
            messages: [
                ...this.state.messages,
                message
            ]
        });

        setTimeout(() => {
            if (this.messageAreaRef.current) {
                this.messageAreaRef.current.scrollTop = this.messageAreaRef.current.scrollHeight;
            }
        }, 1);
    }
}