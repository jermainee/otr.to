import * as fs from "fs";
import * as path from "path";
import FakePeer from "../__mocks__/peerjs";
import {renderChatWaiting} from "../testUtils/renderChat";

beforeEach(() => FakePeer.reset());

/** A setting of the relay, as deploy-turn.yml installs it. */
const relaySetting = (name: string): string => {
    const config = fs.readFileSync(path.join(__dirname, '../../turn/turnserver.conf'), 'utf8');

    return config.match(new RegExp('^' + name + '=(.*)$', 'm'))?.[1];
};

/** The ICE server entry for the relay, as the chat hands it to peerjs. */
const relay = (): RTCIceServer => renderChatWaiting().peer.options.config.iceServers
    .find((server: RTCIceServer) => String(server.urls).startsWith('turn:'));

describe('The TURN relay', () => {
    it('is asked with the credentials it accepts', () => {
        const {username, credential} = relay();

        expect(username + ':' + credential).toBe(relaySetting('user'));
    });

    it('is asked on its port, over UDP and TCP', () => {
        const port = relaySetting('listening-port');

        expect(relay().urls).toEqual([
            'turn:turn.otr.to:' + port + '?transport=udp',
            'turn:turn.otr.to:' + port + '?transport=tcp',
        ]);
    });
});
