import * as React from "react";
import ChatHelper from "./Service/ChatHelper";
import Peer from "peerjs";
import Message from "./Struct/Message";
import Messages from "./Messages";
import {CopyToClipboard} from 'react-copy-to-clipboard';

interface IChatState {
    messages: Message[];
    // @ts-ignore
    connection: Peer.DataConnection|null;
    showLink: boolean;
    wasCopied: boolean;
    fileTransfers: Map<string, FileTransfer>;
}

interface FileTransfer {
    id: string;
    name: string;
    size: number;
    type: string;
    chunks: ArrayBuffer[];
    totalChunks: number;
    receivedChunks: number;
    isComplete: boolean;
    progress: number;
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

    public constructor(props: {}) {
        super(props);
        this.state = {
            messages: [],
            connection: null,
            showLink: false,
            wasCopied: false,
            fileTransfers: new Map(),
        };
    }

    public componentDidMount() {
        const targetPeerId = window.top.location.hash.substr(1);

        if (targetPeerId !== '') {
            this.connect(new Peer(this.peerId, { config: this.config }), targetPeerId);
        } else {
            this.createPeer();
        }
    }

    public render() {
        const link = "https://otr.to/#" + this.peerId;
        const messageInput = this.state.connection ? (
            <div className="container" style={{ position: 'fixed', bottom: 0, right: '50%', transform: 'translateX(50%)', width: '100%', padding: '.5rem' }}>
                <form onSubmit={this.sendMessage}>
                    <div className="columns is-mobile is-gapless">
                        <div className="column is-narrow">
                            <input
                                ref={this.fileInputRef}
                                type="file"
                                style={{ display: 'none' }}
                                onChange={this.handleFileSelect}
                                multiple
                            />
                            <button
                                type="button"
                                className="button is-light"
                                onClick={() => this.fileInputRef.current?.click()}
                                style={{
                                    borderRadius: '4px 0 0 4px',
                                    border: '1px solid #dbdbdb',
                                    borderRight: 'none'
                                }}
                                title="Attach file"
                            >
                                📎
                            </button>
                        </div>
                        <div className="column">
                            <input className="input is-fullwidth is-expanded"
                                   name="userInput"
                                   type="text"
                                   placeholder="Type your message"
                                   autoComplete="off"
                                   autoCapitalize="off"
                                   autoCorrect="off"
                                   spellCheck="false"
                                   style={{
                                       outline: 'none',
                                       boxShadow: 'none',
                                       borderRadius: '0',
                                       borderLeft: 'none'
                                   }}
                                   required={true}
                                   autoFocus={true}
                            />
                        </div>

                        <div className="column is-narrow has-text-right">
                            <button className="button is-primary"
                                    style={{
                                        fontWeight: 'bold',
                                        borderRadius: '0 4px 4px 0'
                                    }}
                            >↣</button>
                        </div>
                    </div>
                </form>
            </div>
        ) : '';

        return (
            <div style={{ marginBottom: '4rem'}}>
                <div className="container">
                    <Messages messages={this.state.messages}/>
                    {this.renderFileTransfers()}
                </div>

                {messageInput}

                <div className={(this.state.showLink ? 'container content' : 'is-hidden')}>
                    <div style={{padding: '1rem'}}>
                        <h1 className="title is-4">Start chatting</h1>
                        <div style={{marginBottom: "1rem"}}>To start a chat just send the following link to the desired
                            person:
                        </div>

                        <div className="columns is-gapless is-mobile">
                            <div className="column">
                                <input className="input" value={link} readOnly={true}
                                       style={{marginBottom: "1rem", borderRadius: '4px 0 0 4px'}}/>
                            </div>
                            <div className="column is-narrow">
                                <CopyToClipboard text={link} onCopy={() => this.setState({wasCopied: true})}>
                                    {this.state.wasCopied ? (
                                        <button className="button is-primary has-text-weight-bold"
                                                style={{borderRadius: '0 4px 4px 0'}}>
                                            <span>Copied!</span>
                                        </button>
                                    ) : (
                                        <button className="button is-primary" style={{borderRadius: '0 4px 4px 0'}}>
                                            <span className="icon is-marginless"><img src="/images/icons/copy.svg"
                                                                                      alt="Copy link"/></span>
                                            <span className="is-hidden">Copy link</span>
                                        </button>
                                    )}
                                </CopyToClipboard>
                            </div>
                        </div>

                        <h2 className="subtitle is-5">Share link</h2>
                        <div className="columns">
                            <div className="column">
                                <a href={"https://telegram.me/share/url?url=" + link}
                                   className="button is-primary is-fullwidth has-text-weight-bold"
                                   target="_blank"
                                >
                                    <span className="icon"><img src="/images/icons/telegram.svg" alt="Telegram"/></span>
                                    <span>Telegram</span>
                                </a>
                            </div>

                            <div className="column">
                                <a href={"https://wa.me/?text=" + link}
                                   className="button is-primary is-fullwidth has-text-weight-bold"
                                   target="_blank"
                                >
                                    <span className="icon"><img src="/images/icons/whatsapp.svg" alt="WhatsApp"/></span>
                                    <span>WhatsApp</span>
                                </a>
                            </div>

                            <div className="column">
                                <a href={"mailto:?subject=&body=" + link}
                                   className="button is-primary is-fullwidth has-text-weight-bold"
                                   target="_blank"
                                >
                                    <span>E-Mail</span>
                                </a>
                            </div>
                        </div>

                        <h2 className="subtitle is-4">How it works</h2>
                        <p>We believe that everyone has the right to communicate privately. That's why we provide
                            otr.to, a tool that allows you to chat P2P. That is, with a direct connection between you
                            and your conversation partner.</p>

                        <div className="columns">
                            <div className="column">
                                <strong>Peer to peer communication</strong> You communicate directly, no logs saved on
                                any servers
                            </div>
                            <div className="column">
                                <strong>Absolutely anonymous</strong> and registration free
                            </div>
                        </div>

                        <div className="columns">
                            <div className="column">
                                <strong>Browser based</strong> You don't need to install any software and neither ask
                                somebody else to do it, too
                            </div>
                            <div className="column">
                                <strong>No chat history</strong> It's all deleted with closing your browser tab
                            </div>
                        </div>

                        <hr/>

                        <a className="github-button" href="https://github.com/jermainee/otr.to" data-size="large"
                           data-show-count="true" aria-label="Star jermainee/nachricht.co on GitHub">Star</a>
                    </div>
                </div>
            </div>
        );
    }

    private renderFileTransfers() {
        const transfers = Array.from(this.state.fileTransfers.values());
        if (transfers.length === 0) return null;

        return (
            <div className="container" style={{ marginTop: '1rem' }}>
                {transfers.map(transfer => (
                    <div key={transfer.id} className="box" style={{ marginBottom: '0.5rem' }}>
                        <div className="columns is-mobile is-vcentered">
                            <div className="column">
                                <strong>{transfer.name}</strong> ({this.formatFileSize(transfer.size)})
                                <br />
                                <small>
                                    {transfer.isComplete ? 'Transfer completed' :
                                        `${transfer.receivedChunks}/${transfer.totalChunks} chunks received`}
                                </small>
                            </div>
                            <div className="column is-narrow">
                                {transfer.isComplete && (
                                    <button
                                        className="button is-small is-primary"
                                        onClick={() => this.downloadFile(transfer)}
                                    >
                                        Download
                                    </button>
                                )}
                            </div>
                        </div>
                        <progress
                            className="progress is-primary"
                            value={transfer.progress}
                            max="100"
                        >
                            {transfer.progress}%
                        </progress>
                    </div>
                ))}
            </div>
        );
    }

    private createPeer(): Peer {
        const peer = new Peer(this.peerId, {config: this.config});
        this.setState({showLink: true});

        peer.on('connection', connection => {
            console.log('open', peer.connections);

            this.setState({showLink: false});

            this.saveMessage(new Message('Connected to Peer', true, true));
            this.setState({connection});

            connection.on('data', (data: string | FileMessage) => {
                if (typeof data === 'string') {
                    this.saveMessage(new Message(data, false));
                } else {
                    this.handleFileMessage(data);
                }
            });

            connection.on('close', () => this.saveMessage(new Message('Peer has left the chat', true, true)));
        });

        peer.on('error', error => console.log('error', error));

        return peer;
    }

    private connect(peer: Peer, targetPeerId: string): void {
        peer.on('open', id => {
            this.saveMessage(new Message('Created Peer: ' + id, true, true));

            const connection = peer.connect(targetPeerId);
            connection.on('open', () => {
                this.saveMessage(new Message('Connected to Peer: ' + targetPeerId, true, true));
                this.setState({ connection });

                connection.on('data', (data: string | FileMessage) => {
                    if (typeof data === 'string') {
                        this.saveMessage(new Message(data, false));
                    } else {
                        this.handleFileMessage(data);
                    }
                });
            });

            setTimeout(() => {
                if (this.state.connection === null) {
                    this.saveMessage(new Message('Peer not found', true, true));
                    window.location.href = '/';
                }
            }, 6000);

            connection.on('close', () => this.saveMessage(new Message('Peer has left the chat', true, true)));
        });
    }

    private sendMessage = (event) => {
        event.preventDefault();
        const message = event.target.elements.userInput.value;
        event.target.reset();

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
        this.saveMessage(new Message(`📎 Sending file: ${file.name} (${this.formatFileSize(file.size)})`, true, true));

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
        this.saveMessage(new Message(`✅ File sent: ${file.name}`, true, true));
    }

    private handleFileMessage = (message: FileMessage) => {
        const { fileTransfers } = this.state;

        switch (message.type) {
            case 'file-start':
                const newTransfer: FileTransfer = {
                    id: message.fileId,
                    name: message.fileName!,
                    size: message.fileSize!,
                    type: message.fileType!,
                    chunks: new Array(message.totalChunks!),
                    totalChunks: message.totalChunks!,
                    receivedChunks: 0,
                    isComplete: false,
                    progress: 0
                };

                fileTransfers.set(message.fileId, newTransfer);
                this.setState({ fileTransfers: new Map(fileTransfers) });
                this.saveMessage(new Message(`📎 Receiving file: ${message.fileName} (${this.formatFileSize(message.fileSize!)})`, false, true));
                break;

            case 'file-chunk':
                const transfer = fileTransfers.get(message.fileId);
                if (transfer && message.chunk) {
                    transfer.chunks[message.chunkIndex!] = message.chunk;
                    transfer.receivedChunks++;
                    transfer.progress = Math.round((transfer.receivedChunks / transfer.totalChunks) * 100);

                    fileTransfers.set(message.fileId, transfer);
                    this.setState({ fileTransfers: new Map(fileTransfers) });
                }
                break;

            case 'file-end':
                const completedTransfer = fileTransfers.get(message.fileId);
                if (completedTransfer) {
                    completedTransfer.isComplete = true;
                    completedTransfer.progress = 100;

                    fileTransfers.set(message.fileId, completedTransfer);
                    this.setState({ fileTransfers: new Map(fileTransfers) });
                    this.saveMessage(new Message(`✅ File received: ${completedTransfer.name}`, false, true));
                }
                break;
        }
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

        // Remove transfer from state
        const { fileTransfers } = this.state;
        fileTransfers.delete(transfer.id);
        this.setState({ fileTransfers: new Map(fileTransfers) });
    }

    private generateFileId = (): string => {
        return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    }

    private formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    private saveMessage = (message: Message) => {
        this.setState({
            messages: [
                ...this.state.messages,
                message
            ]
        });

        setTimeout(() => {
            document.querySelector('html').scrollTop = 999999999;
        }, 1);
    }
}