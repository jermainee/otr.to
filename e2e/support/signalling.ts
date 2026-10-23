import {BrowserContext, WebSocketRoute} from "@playwright/test";

/**
 * Stands in for the PeerJS signalling server. It greets every peer with an
 * OPEN and relays offers, answers and ICE candidates between the peers of one
 * browser context, which is all the real server does for this app.
 *
 * The WebRTC connection the tests exercise is therefore the real thing; only
 * the broker that introduces the two peers to each other is local, so the
 * suite neither needs the internet nor the public PeerJS cloud to be up.
 */
export async function relaySignalling(context: BrowserContext): Promise<void> {
    const peers = new Map<string, WebSocketRoute>();

    await context.routeWebSocket(/\/peerjs\?/, socket => {
        const id = new URL(socket.url()).searchParams.get('id');

        if (id === null) {
            socket.close({code: 1008, reason: 'No peer id'});
            return;
        }

        peers.set(id, socket);
        socket.send(JSON.stringify({type: 'OPEN'}));

        socket.onMessage(raw => {
            const message = JSON.parse(String(raw));

            if (message.type === 'HEARTBEAT') {
                return;
            }

            const target = peers.get(message.dst);

            if (target === undefined) {
                // How the real server answers a message for a peer it does not know.
                socket.send(JSON.stringify({type: 'EXPIRE', src: message.dst, dst: id}));
                return;
            }

            target.send(JSON.stringify({...message, src: id}));
        });

        socket.onClose(() => {
            if (peers.get(id) === socket) {
                peers.delete(id);
            }
        });
    });
}
