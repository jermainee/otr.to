import * as React from "react";
import ChatHelper from "./Service/ChatHelper";
import Peer, {DataConnection} from "peerjs";
import Message from "./Struct/Message";
import FileTransfer from "./Struct/FileTransfer";
import Messages from "./Messages";
import {AttachIcon, CheckIcon, CopyIcon, GitHubIcon, SendIcon, TelegramIcon, WhatsAppIcon} from "./Icons";
import {CopyToClipboard} from 'react-copy-to-clipboard';

/**
 * Where the conversation stands:
 * - waiting: the host shows the link and waits for someone to open it,
 * - connecting: the guest opened a link and is dialling the host,
 * - connected: both sides can talk,
 * - ended: the other side left,
 * - unavailable: nobody answered the link the guest opened,
 * - offline: the connection server that introduces the peers is out of reach.
 */
type Status = 'waiting' | 'connecting' | 'connected' | 'ended' | 'unavailable' | 'offline';

interface IChatState {
    status: Status;
    messages: Message[];
    connection: DataConnection|null;
    wasCopied: boolean;
    fileTransfers: Map<string, FileTransfer>;
}

interface FileMessage {
    type: 'file-start' | 'file-chunk' | 'file-end';
    fileId: string;
    fileName?: string;
    fileSize?: number;
    fileType?: string;
    totalChunks?: number;
    chunkIndex?: number;
    chunk?: ArrayBuffer;
}

/** How long a guest waits for the host to answer before giving up. */
const DIAL_TIMEOUT = 6000;

/** How long the copy button confirms the copy. */
const COPIED_FOR = 2500;

export default class Chat extends React.Component<{}, IChatState> {
    private readonly peerId = ChatHelper.generatePeerId();
    private readonly config = {
        iceServers: [
            {urls: 'stun:46.165.240.76:3478'},
            {urls: 'stun:108.61.211.199:3478'},
            {urls: 'turn:46.165.240.76:3478', credential: 'asperTinO1', username: 'otrto'},
            {urls: 'turn:108.61.211.199:3478', credential: 'asperTinO1', username: 'otrto'}
        ]
    };

    private fileInputRef = React.createRef<HTMLInputElement>();
    private readonly CHUNK_SIZE = 16384; // 16KB chunks
    private dialTimer: number | undefined;
    private copiedTimer: number | undefined;

    public constructor(props: {}) {
        super(props);
        this.state = {
            status: this.targetPeerId() === '' ? 'waiting' : 'connecting',
            messages: [],
            connection: null,
            wasCopied: false,
            fileTransfers: new Map(),
        };
    }

    public componentDidMount() {
        const targetPeerId = this.targetPeerId();

        if (targetPeerId !== '') {
            this.connect(new Peer(this.peerId, { config: this.config }), targetPeerId);
        } else {
            this.createPeer();
        }

        window.addEventListener('pagehide', this.hangUp);
    }

    public componentWillUnmount() {
        window.clearTimeout(this.dialTimer);
        window.clearTimeout(this.copiedTimer);
        window.removeEventListener('pagehide', this.hangUp);
    }

    public render() {
        switch (this.state.status) {
            case 'waiting':
                return this.renderInvitation();
            case 'connecting':
                return this.renderNotice(
                    'Connecting to the chat',
                    'This takes a few seconds.',
                );
            case 'unavailable':
                return this.renderNotice(
                    'This chat is no longer open',
                    'The person who sent you the link may have closed the page. Ask them for a new link, or start a chat of your own.',
                    <a className="button is-primary" href="/">Start a new chat</a>,
                );
            case 'offline':
                return this.renderNotice(
                    'Can’t reach the connection server',
                    'otr.to needs it to bring the two of you together. Check your internet connection and try again.',
                    <button type="button" className="button is-primary" onClick={() => window.location.reload()}>
                        Try again
                    </button>,
                );
            default:
                return this.renderConversation();
        }
    }

    private renderInvitation() {
        const link = "https://otr.to/#" + this.peerId;
        const shared = encodeURIComponent(link);

        return (
            <main className="container start">
                <section className="start-invite" aria-labelledby="start-title">
                    <h1 id="start-title" className="title is-3">Start a private chat</h1>
                    <p className="start-lead">
                        Send this link to the person you want to chat with. The chat starts as soon as they open it.
                    </p>

                    <div className="field has-addons start-link">
                        <div className="control is-expanded">
                            <input className="input is-medium" value={link} readOnly={true} aria-label="Chat link"
                                   onFocus={event => event.target.select()}/>
                        </div>
                        <div className="control">
                            <CopyToClipboard text={link} onCopy={this.confirmCopy}>
                                <button type="button" className="button is-primary is-medium">
                                    <span className="icon">{this.state.wasCopied ? <CheckIcon/> : <CopyIcon/>}</span>
                                    <span className="is-sr-only">{this.state.wasCopied ? 'Link copied' : 'Copy link'}</span>
                                </button>
                            </CopyToClipboard>
                        </div>
                    </div>

                    <p className="status-line" role="status">
                        <span className="status-dot" aria-hidden="true"/>
                        {this.state.wasCopied
                            ? 'Link copied. Waiting for someone to open it'
                            : 'Waiting for someone to open the link'}
                    </p>

                    <h2 className="start-share-title">Or share it with</h2>
                    <div className="columns start-share">
                        <div className="column">
                            <a href={"https://telegram.me/share/url?url=" + shared}
                               className="button is-primary is-fullwidth has-text-weight-bold"
                               target="_blank" rel="noopener noreferrer"
                            >
                                <span className="icon"><TelegramIcon/></span>
                                <span>Telegram</span>
                            </a>
                        </div>

                        <div className="column">
                            <a href={"https://wa.me/?text=" + shared}
                               className="button is-primary is-fullwidth has-text-weight-bold"
                               target="_blank" rel="noopener noreferrer"
                            >
                                <span className="icon"><WhatsAppIcon/></span>
                                <span>WhatsApp</span>
                            </a>
                        </div>

                        <div className="column">
                            <a href={"mailto:?subject=&body=" + shared}
                               className="button is-primary is-fullwidth has-text-weight-bold"
                            >
                                <span>Email</span>
                            </a>
                        </div>
                    </div>
                </section>

                <section className="start-about" aria-labelledby="about-title">
                    <h2 id="about-title" className="title is-5">How it works</h2>
                    <p className="start-about-intro">We believe that everyone has the right to communicate privately. That’s why we provide
                        otr.to, a tool that allows you to chat P2P. That is, with a direct connection between you
                        and your conversation partner.</p>

                    <div className="start-features">
                        <p>
                            <strong>Peer to peer communication</strong> You communicate directly, no logs saved on
                            any servers
                        </p>
                        <p>
                            <strong>Absolutely anonymous</strong> and registration free
                        </p>
                        <p>
                            <strong>Browser based</strong> You don’t need to install any software and neither ask
                            somebody else to do it, too
                        </p>
                        <p>
                            <strong>No chat history</strong> It’s all deleted with closing your browser tab
                        </p>
                    </div>

                    <hr/>

                    <a href="https://github.com/jermainee/otr.to" className="button" target="_blank" rel="noopener noreferrer">
                        <span className="icon mr-2"><GitHubIcon/></span>
                        <span>View on GitHub</span>
                    </a>
                </section>
            </main>
        );
    }

    /** A screen of its own for a state the chat cannot go on from. */
    private renderNotice(title: string, text: string, action?: React.ReactNode) {
        return (
            <main className="container state-screen" aria-busy={this.state.status === 'connecting'}>
                <h1 className="title is-4">
                    {this.state.status === 'connecting' && <span className="status-dot" aria-hidden="true"/>}
                    {title}
                </h1>
                <p>{text}</p>
                {action}
            </main>
        );
    }

    private renderConversation() {
        return (
            <>
                <main className="container chat">
                    <h1 className="is-sr-only">Chat</h1>
                    <Messages messages={this.state.messages}
                              transfers={this.state.fileTransfers}
                              onDownload={this.downloadFile}/>
                </main>

                <footer className="chat-composer">
                    {this.state.status === 'connected' ? (
                        <form className="container" onSubmit={this.sendMessage}>
                            <div className="field has-addons">
                                <div className="control">
                                    <input ref={this.fileInputRef} type="file" hidden={true} multiple={true}
                                           onChange={this.handleFileSelect}/>
                                    <button type="button" className="button" aria-label="Attach files" title="Attach files"
                                            onClick={() => this.fileInputRef.current?.click()}>
                                        <span className="icon"><AttachIcon/></span>
                                    </button>
                                </div>
                                <div className="control is-expanded">
                                    <input className="input"
                                           name="userInput"
                                           type="text"
                                           placeholder="Type your message"
                                           aria-label="Message"
                                           autoComplete="off"
                                           autoCapitalize="off"
                                           autoCorrect="off"
                                           spellCheck="false"
                                           required={true}
                                           autoFocus={true}
                                    />
                                </div>
                                <div className="control">
                                    <button type="submit" className="button is-primary" aria-label="Send">
                                        <span className="icon"><SendIcon/></span>
                                    </button>
                                </div>
                            </div>
                        </form>
                    ) : (
                        <div className="container chat-ended">
                            <p>The chat has ended.</p>
                            <a className="button is-primary" href="/">Start a new chat</a>
                        </div>
                    )}
                </footer>
            </>
        );
    }

    private createPeer(): Peer {
        const peer = new Peer(this.peerId, {config: this.config});

        peer.on('connection', connection => {
            this.saveMessage(new Message('Someone opened your link. You’re connected.', true, true));
            this.setState({status: 'connected', connection});

            connection.on('data', this.receive);
            connection.on('close', this.leave);
        });

        peer.on('error', error => {
            console.log('error', error);

            // Once two peers talk, they no longer need the connection server.
            if (this.state.status === 'waiting') {
                this.setState({status: 'offline'});
            }
        });

        return peer;
    }

    private connect(peer: Peer, targetPeerId: string): void {
        peer.on('error', error => {
            console.log('error', error);

            if (this.state.status === 'connecting') {
                this.setState({status: error.type === 'peer-unavailable' ? 'unavailable' : 'offline'});
            }
        });

        peer.on('open', () => {
            const connection = peer.connect(targetPeerId);
            connection.on('open', () => {
                this.saveMessage(new Message('You’re connected.', true, true));
                this.setState({status: 'connected', connection});

                connection.on('data', this.receive);
            });

            // peerjs reports a link that nobody answers, but not always
            // quickly, so give up after a while either way.
            this.dialTimer = window.setTimeout(() => {
                if (this.state.status === 'connecting') {
                    this.setState({status: 'unavailable'});
                }
            }, DIAL_TIMEOUT);

            connection.on('close', this.leave);
        });
    }

    private receive = (data: string | FileMessage) => {
        if (typeof data === 'string') {
            this.saveMessage(new Message(data, false));
        } else {
            this.handleFileMessage(data);
        }
    }

    /**
     * A closed tab just disappears, and the other side would keep waiting for
     * it. Closing the connection on the way out tells it that the chat ended.
     */
    private hangUp = () => {
        this.state.connection?.close();
    }

    private leave = () => {
        if (this.state.status === 'connecting') {
            this.setState({status: 'unavailable'});
            return;
        }

        this.saveMessage(new Message('The other person left the chat.', true, true));
        this.setState({status: 'ended'});
    }

    private confirmCopy = () => {
        window.clearTimeout(this.copiedTimer);
        this.setState({wasCopied: true});
        this.copiedTimer = window.setTimeout(() => this.setState({wasCopied: false}), COPIED_FOR);
    }

    private sendMessage = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const input = event.currentTarget.elements.namedItem('userInput') as HTMLInputElement;
        const message = input.value;
        event.currentTarget.reset();

        if (message.trim() === '') {
            return;
        }

        this.saveMessage(new Message(message, true));
        this.state.connection.send(message);
    }

    private handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || !this.state.connection) return;

        Array.from(files).forEach(file => {
            this.sendFile(file);
        });

        // Reset file input
        event.target.value = '';
    }

    private sendFile = async (file: File) => {
        const fileId = this.generateFileId();
        const totalChunks = Math.ceil(file.size / this.CHUNK_SIZE);

        // Send file start message
        const startMessage: FileMessage = {
            type: 'file-start',
            fileId,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            totalChunks
        };

        this.state.connection.send(startMessage);
        this.trackTransfer({
            id: fileId,
            name: file.name,
            size: file.size,
            type: file.type,
            direction: 'outgoing',
            chunks: [],
            totalChunks,
            receivedChunks: 0,
            isComplete: false,
            isSaved: false,
            progress: 0,
        });
        this.saveMessage(new Message(file.name, true, false, fileId));

        // Send file in chunks
        const arrayBuffer = await file.arrayBuffer();
        for (let i = 0; i < totalChunks; i++) {
            const start = i * this.CHUNK_SIZE;
            const end = Math.min(start + this.CHUNK_SIZE, file.size);
            const chunk = arrayBuffer.slice(start, end);

            const chunkMessage: FileMessage = {
                type: 'file-chunk',
                fileId,
                chunkIndex: i,
                chunk
            };

            this.state.connection.send(chunkMessage);
        }

        // Send file end message
        const endMessage: FileMessage = {
            type: 'file-end',
            fileId
        };

        this.state.connection.send(endMessage);
        this.updateTransfer(fileId, transfer => ({...transfer, isComplete: true, progress: 100}));
    }

    private handleFileMessage = (message: FileMessage) => {
        switch (message.type) {
            case 'file-start':
                this.trackTransfer({
                    id: message.fileId,
                    name: message.fileName!,
                    size: message.fileSize!,
                    type: message.fileType!,
                    direction: 'incoming',
                    chunks: new Array(message.totalChunks!),
                    totalChunks: message.totalChunks!,
                    receivedChunks: 0,
                    isComplete: false,
                    isSaved: false,
                    progress: 0
                });
                this.saveMessage(new Message(message.fileName!, false, false, message.fileId));
                break;

            case 'file-chunk':
                if (message.chunk) {
                    this.updateTransfer(message.fileId, transfer => {
                        // The chunks array is only ever written to, so filling
                        // it in place spares a copy per chunk.
                        transfer.chunks[message.chunkIndex!] = message.chunk;
                        const receivedChunks = transfer.receivedChunks + 1;

                        return {
                            ...transfer,
                            receivedChunks,
                            progress: Math.round((receivedChunks / transfer.totalChunks) * 100),
                        };
                    });
                }
                break;

            case 'file-end':
                this.updateTransfer(message.fileId, transfer => ({...transfer, isComplete: true, progress: 100}));
                break;
        }
    }

    private trackTransfer(transfer: FileTransfer) {
        this.setState(state => ({fileTransfers: new Map(state.fileTransfers).set(transfer.id, transfer)}));
    }

    /** Applies a change to a known transfer; transfers it never saw start are ignored. */
    private updateTransfer(id: string, change: (transfer: FileTransfer) => FileTransfer) {
        this.setState(state => {
            const transfer = state.fileTransfers.get(id);

            return transfer === undefined
                ? null
                : {fileTransfers: new Map(state.fileTransfers).set(id, change(transfer))};
        });
    }

    private downloadFile = (transfer: FileTransfer) => {
        // Combine all chunks
        const totalSize = transfer.chunks.reduce((size, chunk) => size + chunk.byteLength, 0);
        const combined = new Uint8Array(totalSize);
        let offset = 0;

        transfer.chunks.forEach(chunk => {
            combined.set(new Uint8Array(chunk), offset);
            offset += chunk.byteLength;
        });

        // Create blob and download
        const blob = new Blob([combined], { type: transfer.type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = transfer.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Keep the file in the conversation, but let go of its bytes.
        this.updateTransfer(transfer.id, saved => ({...saved, chunks: [], isSaved: true}));
    }

    private generateFileId = (): string => {
        return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    }

    private targetPeerId(): string {
        return window.top.location.hash.substr(1);
    }

    private saveMessage = (message: Message) => {
        // Follow the conversation, unless someone scrolled up to reread it.
        const page = document.documentElement;
        const follow = message.isSender || page.scrollHeight - page.scrollTop - window.innerHeight < 160;

        this.setState(state => ({messages: [...state.messages, message]}), () => {
            if (follow) {
                this.scrollToEnd();
            }
        });
    }

    private scrollToEnd() {
        const page = document.documentElement;
        const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

        // jsdom has no scrollTo on elements; every browser does.
        if (typeof page.scrollTo === 'function') {
            page.scrollTo({top: page.scrollHeight, behavior: calm ? 'auto' : 'smooth'});
        } else {
            page.scrollTop = page.scrollHeight;
        }
    }
}
