import * as React from "react";
import ChatHelper from "./Service/ChatHelper";
import Peer from "peerjs";
import Message from "./Struct/Message";
import Messages from "./Messages";
import {CopyToClipboard} from 'react-copy-to-clipboard';

interface IChatState {
    messages: Message[];
    connection: Peer.DataConnection|null;
    showLink: boolean;
    wasCopied: boolean;
}

export default class Chat extends React.Component<{}, IChatState> {
    private readonly peerId = ChatHelper.generatePeerId();

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

        console.log(targetPeerId);

        if (targetPeerId !== '') {
            this.connect(new Peer(this.peerId), targetPeerId);
        } else {
            this.createPeer();
        }
    }

    public render() {
        const link = "https://otrnew.test/chat#" + this.peerId;
        const messageInput = this.state.connection ? (
            <div style={{ position: 'fixed', bottom: 0, width: '100%', padding: '.5rem' }}>
                <form onSubmit={this.sendMessage}>
                    <div className="columns is-mobile is-gapless">
                        <div className="column">
                            <input className="input is-fullwidth is-expanded"
                                   name="userInput"
                                   type="text"
                                   placeholder="Type your message"
                                   style={{
                                       border: 'none',
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
            <div>
                <div className="container" style={{ marginBottom: '4rem'}}>
                    <Messages messages={this.state.messages}/>
                </div>

                {messageInput}

                <div className={"modal" + (this.state.showLink ? ' is-active': '')}>
                    <div className="modal-content">
                        <div className="box">
                            <div style={{ marginBottom: "1rem", fontWeight: 'bold', fontSize: '1.2rem' }}>Start chatting</div>
                            <div style={{ marginBottom: "1rem" }}>To start a chat just send the following link to the desired person:</div>
                            <input className="input" value={link} readOnly={true} style={{ marginBottom: "1rem" }}/>

                            <CopyToClipboard text={link} onCopy={() => this.setState({ wasCopied: true })} style={{ marginBottom: "2rem" }}>
                                { this.state.wasCopied ? (
                                    <button className="button is-primary is-fullwidth has-text-weight-bold">
                                        <span>Done!</span>
                                    </button>
                                ) : (
                                    <button className="button is-primary is-fullwidth has-text-weight-bold">
                                        <span>Copy link</span>
                                        <span className="icon"><img src="/images/icons/copy.svg" alt="Copy link"/></span>
                                    </button>
                                )}
                            </CopyToClipboard>

                            <div style={{ marginBottom: "1rem", fontWeight: 'bold' }}>Share link</div>
                            <div className="columns">
                                <div className="column">
                                    <a id="shareTelegram"
                                       href={"https://telegram.me/share/url?url=" + link}
                                       className="button is-primary is-fullwidth has-text-weight-bold"
                                       target="_blank"
                                    >
                                        <span>Telegram</span>
                                        <span className="icon"><img src="/images/icons/telegram.svg" alt="Telegram"/></span>
                                    </a>
                                </div>

                                <div className="column">
                                    <a id="shareWhatsApp"
                                       href={"https://wa.me/?text=" + link}
                                       className="button is-primary is-fullwidth has-text-weight-bold"
                                       target="_blank"
                                    >
                                        <span>WhatsApp</span>
                                        <span className="icon"><img src="/images/icons/whatsapp.svg" alt="WhatsApp"/></span>
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    private createPeer(): Peer {
        const peer = new Peer(this.peerId);
        this.setState({ showLink: true });

        peer.on('open', id => this.saveMessage(new Message('Created Peer: ' + id, true, true)));
        peer.on('connection', connection => {
            console.log('open', peer.connections);

            this.setState({ showLink: false });

            this.saveMessage(new Message('Connected to Peer', true, true));
            this.setState({ connection });

            connection.on('data', data => {
                this.saveMessage(new Message(data, false));
            });

            connection.on('close', () => this.saveMessage(new Message('Peer has left the chat', true, true)));
        });

        peer.on('error', error => console.log('error', error));

        return peer;
    }

    private connect(peer: Peer, targetPeerId: string) {
        peer.on('open', id => {
            this.saveMessage(new Message('Created Peer: ' + id, true, true));

            const connection = peer.connect(targetPeerId);

            connection.on('open', () => {
                this.saveMessage(new Message('Connected to Peer: ' + targetPeerId, true, true));
                this.setState({ connection });

                connection.on('data', data => {
                    this.saveMessage(new Message(data, false));
                });
            });

            setTimeout(() => {
                if (this.state.connection === null) {
                    this.saveMessage(new Message('Peer not found', true, true));
                    window.location.href = '/chat';
                }
            }, 3000);

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
    }
}
