import * as React from "react";
import ChatHelper from "./Service/ChatHelper";
import Peer from "peerjs";
import Message from "./Struct/Message";
import Messages from "./Messages";

interface IChatState {
    messages: Message[];
}

export default class Chat extends React.PureComponent<{}, IChatState> {
    private readonly peerId = ChatHelper.generatePeerId();
    private connection: Peer.DataConnection;

    public constructor(props: {}) {
        super(props);
        this.state = { messages: [] };
    }

    public componentDidMount() {
        const urlParams = new URLSearchParams(window.location.search);
        const targetPeerId = urlParams.get('id');

        if (targetPeerId) {
            this.connect(new Peer(this.peerId), targetPeerId);
        } else {
            this.createPeer();
        }
    }

    public render() {
        return (
            <div className="container">
                <Messages messages={this.state.messages}/>

                <div>
                    <form onSubmit={this.sendMessage}>
                        <div className="field has-addons">
                            <div className="control">
                                <input className="input" name="userInput" type="text" placeholder="Type your message"/>
                            </div>
                            <div className="control">
                                <button className="button is-success">Send</button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    private createPeer(): Peer {
        const peer = new Peer(this.peerId);

        peer.on('open', id => {
            console.log('id', id);
            this.saveMessage(new Message('Created Peer: ' + id, true, true));
        });
        peer.on('connection', connection => {
            console.log('open', peer.connections);
            this.saveMessage(new Message('Connected to Peer', true, true));
            this.connection = connection;

            connection.on('data', data => {
                console.log('Incoming data', data);
                this.saveMessage(new Message(data, false));
            });
        });
        peer.on('error', error => console.log('error', error));

        return peer;
    }

    private connect(peer: Peer, targetPeerId: string) {
        peer.on('open', id => {
            console.log('id', id)
            this.saveMessage(new Message('Created Peer: ' + id, true, true));

            const connection = peer.connect(targetPeerId);

            connection.on('open', () => {
                console.log('open', targetPeerId);
                this.saveMessage(new Message('Connected to Peer: ' + targetPeerId, true, true));
                this.connection = connection;

                connection.on('data', data => {
                    console.log('Incoming data', data);
                    this.saveMessage(new Message(data, false));
                });
            });
        });
    }

    private sendMessage = (event) => {
        event.preventDefault();
        const message = event.target.elements.userInput.value;
        event.target.reset();

        console.log('sending', message);

        this.saveMessage(new Message(message, true));
        this.connection.send(message);
    }

    private saveMessage = (message: Message) => {
        console.log('saving', message.text);

        this.setState({
            messages: [
                ...this.state.messages,
                message
            ]
        });
    }
}
