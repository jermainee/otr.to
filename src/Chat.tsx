import * as React from "react";
import ChatHelper from "./Service/ChatHelper";
import Group from "./Service/Group";
import RoomKey from "./Service/RoomKey";
import Message from "./Struct/Message";
import FileTransfer from "./Struct/FileTransfer";
import Packet from "./Struct/Packet";
import Messages from "./Messages";
import {AttachIcon, CheckIcon, CopyIcon, GitHubIcon, MailIcon, SendIcon, TelegramIcon, WhatsAppIcon} from "./Icons";
import {CopyToClipboard} from 'react-copy-to-clipboard';

/**
 * Where the conversation stands:
 * - waiting: the host shows the link and waits for someone to open it,
 * - connecting: the guest opened a link and is dialling the host,
 * - connected: there is someone to talk to,
 * - ended: everyone else left,
 * - unavailable: nobody answered the link the guest opened,
 * - offline: the connection server that introduces the peers is out of reach,
 * - invalid: the guest opened something that is no chat link, or only part of one.
 */
type Status = 'waiting' | 'connecting' | 'connected' | 'ended' | 'unavailable' | 'offline' | 'invalid';

interface IChatState {
    status: Status;
    messages: Message[];
    /** How many people are in the chat, this browser included. */
    people: number;
    /** Whether more than two people have been in the chat, from when on messages carry names. */
    isGroup: boolean;
    wasCopied: boolean;
    fileTransfers: Map<string, FileTransfer>;
}

/** How long the copy button confirms the copy. */
const COPIED_FOR = 2500;

/** What the start page says otr.to does, each in a title and a sentence or two. */
const FEATURES = [
    {
        title: 'Direct connection',
        text: 'Messages and files go straight from one browser to the others. No server keeps a copy of the conversation.',
    },
    {
        title: 'End-to-end encrypted',
        text: 'The key travels inside the link and never reaches a server. Only people who have the link can read along.',
    },
    {
        title: 'Group chats',
        text: 'Send the link to several people and talk all together. Short names like “Calm Otter” show who wrote what, and anyone in the chat can invite more.',
    },
    {
        title: 'File sharing',
        text: 'Send photos, documents and anything else to everyone in the chat, encrypted like your messages.',
    },
    {
        title: 'No sign-up',
        text: 'No account, no name, no phone number, and nothing to install. It works in any modern browser, on phones too.',
    },
    {
        title: 'No history',
        text: 'The conversation lives only in your open tab. Close it, and it’s gone.',
    },
];

export default class Chat extends React.Component<{}, IChatState> {
    private readonly peerId = ChatHelper.generatePeerId();
    private readonly config = {
        iceServers: [
            // Tell each browser its address on the internet, without which two
            // devices on different networks cannot find a way to each other.
            // Public, free and run by two providers, so one being down is not
            // enough to cut every chat off. They see who asks, not the chat.
            {urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302']},
        ]
    };

    /** The link this browser was opened with; null without one, or when it is no chat link. */
    private readonly invitation = ChatHelper.parseLink(this.fragment());
    /** The link's key, or a new one when this browser makes the link. */
    private readonly key = new RoomKey(this.invitation?.secret);
    private group: Group | null = null;
    /**
     * Everyone else in the chat. Kept here and not only in the state, since
     * people can join and leave faster than React renders.
     */
    private readonly others = new Set<string>();
    private isGroup = false;

    private fileInputRef = React.createRef<HTMLInputElement>();
    private readonly CHUNK_SIZE = 16384; // 16KB chunks
    private copiedTimer: number | undefined;

    public constructor(props: {}) {
        super(props);
        this.state = {
            status: this.fragment() === '' ? 'waiting' : this.invitation === null ? 'invalid' : 'connecting',
            messages: [],
            people: 1,
            isGroup: false,
            wasCopied: false,
            fileTransfers: new Map(),
        };
    }

    public componentDidMount() {
        if (this.state.status !== 'invalid') {
            this.group = new Group(this.peerId, this.key, this.config, {
                onJoin: this.welcome,
                onLeave: this.farewell,
                onPacket: this.receive,
                onTurnedAway: this.turnedAway,
                onError: this.fail,
            }, this.invitation?.peerId ?? null);
        }

        window.addEventListener('pagehide', this.hangUp);
    }

    public componentWillUnmount() {
        window.clearTimeout(this.copiedTimer);
        window.removeEventListener('pagehide', this.hangUp);
        this.group?.close();
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
                    'otr.to needs it to bring you and the others together. Check your internet connection and try again.',
                    <button type="button" className="button is-primary" onClick={() => window.location.reload()}>
                        Try again
                    </button>,
                );
            case 'invalid':
                return this.renderNotice(
                    'This link doesn’t work',
                    'Part of it may have got lost when it was shared. Ask for the link again, or start a chat of your own.',
                    <a className="button is-primary" href="/">Start a new chat</a>,
                );
            default:
                return this.renderConversation();
        }
    }

    private renderInvitation() {
        const link = this.link();
        const shared = encodeURIComponent(link);

        return (
            <main className="container start">
                <section className="start-invite" aria-labelledby="start-title">
                    <h1 id="start-title" className="title is-3">Start a private chat</h1>
                    <p className="start-lead">
                        Send this link to the people you want to chat with. The chat starts as soon as someone
                        opens it, and anyone who has the link can join.
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
                                <span className="icon"><MailIcon/></span>
                                <span>Email</span>
                            </a>
                        </div>
                    </div>
                </section>

                <section className="start-about" aria-labelledby="about-title">
                    <h2 id="about-title" className="title is-5">Features</h2>
                    <p className="start-about-intro">
                        We believe that everyone has the right to communicate privately. otr.to connects your
                        browser straight to the browsers of the people you invite, and nothing in between can
                        read along.
                    </p>

                    <ul className="start-features">
                        {FEATURES.map(feature => (
                            <li key={feature.title}>
                                <h3 className="start-feature-title">{feature.title}</h3>
                                <p>{feature.text}</p>
                            </li>
                        ))}
                    </ul>

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
                {this.state.status === 'connected' && (
                    <header className="chat-bar">
                        <div className="container">
                            <p>{this.state.people} people in this chat</p>
                            <CopyToClipboard text={this.link()} onCopy={this.confirmCopy}>
                                <button type="button" className="button is-small">
                                    <span className="icon">{this.state.wasCopied ? <CheckIcon/> : <CopyIcon/>}</span>
                                    <span>{this.state.wasCopied ? 'Invite link copied' : 'Copy invite link'}</span>
                                </button>
                            </CopyToClipboard>
                        </div>
                    </header>
                )}

                <main className="container chat">
                    <h1 className="is-sr-only">Chat</h1>
                    <Messages messages={this.state.messages}
                              transfers={this.state.fileTransfers}
                              showAuthors={this.state.isGroup}
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

    /**
     * The link that brings someone into this chat. It points at this browser,
     * so it works for as long as this browser is in the chat.
     */
    private link(): string {
        return ChatHelper.chatLink(this.peerId, this.key.secret);
    }

    private welcome = (peerId: string, wasThere: boolean) => {
        const isFirst = this.others.size === 0;
        this.others.add(peerId);

        if (isFirst) {
            window.clearTimeout(this.copiedTimer);
            this.saveMessage(new Message(
                (this.invitation === null ? 'Someone opened your link. You’re connected.' : 'You’re connected.')
                + ' Messages are end-to-end encrypted.',
                true,
                true,
            ));
        } else if (!wasThere) {
            this.saveMessage(new Message(ChatHelper.nickname(peerId) + ' joined the chat.', true, true));
        }

        // From the third person on, messages need a name to tell who wrote them.
        if (!this.isGroup && this.others.size > 1) {
            this.isGroup = true;
            this.saveMessage(new Message('Others see you as ' + ChatHelper.nickname(this.peerId) + '.', true, true));
        }

        this.setState(state => ({
            status: 'connected',
            people: this.others.size + 1,
            isGroup: this.isGroup,
            wasCopied: isFirst ? false : state.wasCopied,
        }));
    }

    private farewell = (peerId: string, wasLost: boolean) => {
        const who = this.isGroup ? ChatHelper.nickname(peerId) : null;

        this.others.delete(peerId);
        this.saveMessage(new Message(
            wasLost
                ? 'Lost the connection to ' + (who ?? 'the other person') + '.'
                : (who ?? 'The other person') + ' left the chat.',
            true,
            true,
        ));

        if (this.others.size === 0) {
            // Alone, the chat is over. Let go of the peer, so that links to it stop working.
            this.group.close();
            this.setState({status: 'ended', people: 1});
        } else {
            this.setState({people: this.others.size + 1});
        }
    }

    private turnedAway = () => {
        if (this.state.status === 'connecting') {
            this.setState({status: 'unavailable'});
        }
    }

    private fail = (error: {type: string}) => {
        console.log('error', error);

        // Once people talk, they no longer need the connection server, and a
        // peer that cannot be dialled any more has merely left.
        if (this.others.size > 0) {
            return;
        }

        if (this.state.status === 'waiting') {
            this.setState({status: 'offline'});
        } else if (this.state.status === 'connecting') {
            this.setState({status: error.type === 'peer-unavailable' ? 'unavailable' : 'offline'});
        }
    }

    private receive = (packet: Packet, from: string) => {
        if (packet.type === 'text') {
            this.saveMessage(new Message(packet.text, false, false, null, from));
        } else {
            this.handleFilePacket(packet, from);
        }
    }

    /**
     * A closed tab just disappears, and the others would keep waiting for it.
     * Closing the connections on the way out tells them it left.
     */
    private hangUp = () => {
        this.group?.close();
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
        this.group.broadcast({type: 'text', text: message});
    }

    private handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || this.others.size === 0) return;

        Array.from(files).forEach(file => {
            this.sendFile(file);
        });

        // Reset file input
        event.target.value = '';
    }

    private sendFile = async (file: File) => {
        const fileId = this.generateFileId();
        const totalChunks = Math.ceil(file.size / this.CHUNK_SIZE);

        this.group.broadcast({
            type: 'file-start',
            fileId,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            totalChunks,
        });
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

            this.group.broadcast({type: 'file-chunk', fileId, chunkIndex: i, chunk: arrayBuffer.slice(start, end)});
        }

        // The packets leave in order, so once the end left, everything did.
        await this.group.broadcast({type: 'file-end', fileId});
        this.updateTransfer(fileId, transfer => ({...transfer, isComplete: true, progress: 100}));
    }

    private handleFilePacket = (packet: Packet, from: string) => {
        // File ids are only unique per sender.
        const id = from + '/' + ('fileId' in packet ? packet.fileId : '');

        switch (packet.type) {
            case 'file-start':
                this.trackTransfer({
                    id,
                    name: packet.fileName,
                    size: packet.fileSize,
                    type: packet.fileType,
                    direction: 'incoming',
                    chunks: new Array(packet.totalChunks),
                    totalChunks: packet.totalChunks,
                    receivedChunks: 0,
                    isComplete: false,
                    isSaved: false,
                    progress: 0
                });
                this.saveMessage(new Message(packet.fileName, false, false, id, from));
                break;

            case 'file-chunk':
                if (packet.chunk) {
                    this.updateTransfer(id, transfer => {
                        // The chunks array is only ever written to, so filling
                        // it in place spares a copy per chunk.
                        transfer.chunks[packet.chunkIndex] = packet.chunk;
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
                this.updateTransfer(id, transfer => ({...transfer, isComplete: true, progress: 100}));
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

    /** The part of the address after the #, where a chat link keeps the peer to dial and the key. */
    private fragment(): string {
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
