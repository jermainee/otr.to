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

    public constructor(props: {}) {
        super(props);
        this.state = {
            messages: [],
            connection: null,
            showLink: false,
            wasCopied: false,
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
                                       borderRadius: '4px 0 0 4px'
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

    private createPeer(): Peer {
        const peer = new Peer(this.peerId, {config: this.config});
        this.setState({showLink: true });

        peer.on('connection', connection => {
            console.log('open', peer.connections);

            this.setState({ showLink: false });

            this.saveMessage(new Message('Connected to Peer', true, true));
            this.setState({ connection });

            connection.on('data', (data: string) => {
                this.saveMessage(new Message(data, false));
            });

            connection.on('close', () => this.saveMessage(new Message('Peer has left the chat', true, true)));
        });

        peer.on('error', error => console.log('error', error));

        return peer;
    }

    /**
     *
     *
     */
    private connect(peer: Peer, targetPeerId: string): void {
        peer.on('open', id => {
            this.saveMessage(new Message('Created Peer: ' + id, true, true));

            const connection = peer.connect(targetPeerId);
            connection.on('open', () => {
                this.saveMessage(new Message('Connected to Peer: ' + targetPeerId, true, true));
                this.setState({ connection });

                connection.on('data', (data: string) => {
                    this.saveMessage(new Message(data, false));
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
