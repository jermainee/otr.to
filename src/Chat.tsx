import * as React from "react";
import ChatHelper from "./Service/ChatHelper";
import Peer from "peerjs";

export default class Chat extends React.Component {
    private readonly peerId = ChatHelper.generatePeerId();

    public render() {
        const peer = this.createPeer();
        const urlParams = new URLSearchParams(window.location.search);
        const targetPeerId = urlParams.get('id');

        console.log('targetPeerId', targetPeerId);

        if (targetPeerId) {
            console.log('trying');
            this.connect(peer, targetPeerId);
        }

        return <div>chat</div>;
    }

    private connect(peer: Peer, targetPeerId: string) {
        peer.on('open', id => {
            console.log('id', id)

            const connection = peer.connect(targetPeerId);

            connection.on('open', () => {
                console.log('open', targetPeerId);
                connection.send('sdf');


                connection.on('data', data => console.log('Incoming data', data));

                connection.send('sdf');
            });
        });
    }

    private createPeer(): Peer {
        const peer = new Peer(this.peerId);

        peer.on('open', id => console.log('id', id));

        peer.on('connection', connection => {
            connection.on('data', data => {
                console.log('Incoming data', data);
                connection.send('REPLY');
            });
        });

        peer.on('error', error => console.log('error', error));

        return peer;
    }
}
