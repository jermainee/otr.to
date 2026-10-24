import * as React from "react";
import {act, render, RenderResult, screen, waitFor} from "@testing-library/react";
import Chat from "../Chat";
import ChatHelper from "../Service/ChatHelper";
import RoomKey from "../Service/RoomKey";
import Packet from "../Struct/Packet";
import FakePeer, {FakeDataConnection} from "../__mocks__/peerjs";

interface RenderedChat {
    view: RenderResult;
    peer: FakePeer;
    connection: FakeDataConnection;
}

/** The secret of the links the tests open. */
export const TEST_SECRET = 'TestSecretForTheLinks0';

/** The key of the chat rendered last, which is what the peers in a test hold. */
let key: RoomKey;

/** The share link the chat offers while it waits. */
export const shareLink = (): string => (screen.getByLabelText('Chat link') as HTMLInputElement).value;

/** Renders the chat as the person who created the link, before anyone joins. */
export function renderChatWaiting(): {view: RenderResult, peer: FakePeer} {
    const view = render(<Chat/>);
    key = new RoomKey(ChatHelper.parseLink(shareLink().split('#')[1]).secret);

    return {view, peer: FakePeer.instances[0]};
}

/**
 * Renders the chat as the person who opened a share link and lets the peer
 * open, but leaves the outgoing connection unanswered.
 */
export function renderChatDialling(targetPeerId: string = 'invited-peer-id'): {view: RenderResult, peer: FakePeer} {
    window.location.hash = '#' + targetPeerId + '.' + TEST_SECRET;
    key = new RoomKey(TEST_SECRET);

    const view = render(<Chat/>);
    const peer = FakePeer.instances[0];

    act(() => peer.emit('open', peer.id));

    return {view, peer};
}

/**
 * Brings a peer into the chat over an incoming connection, the way peerjs
 * would once someone opens the link: the connection opens and the peer says
 * hello with the list of those it is connected to.
 */
export async function joinAs(peer: FakePeer, peerId: string, members: string[] = []): Promise<FakeDataConnection> {
    const connection = new FakeDataConnection(peerId);

    act(() => peer.emit('connection', connection));
    act(() => connection.emit('open'));
    await deliver(connection, {type: 'members', ids: members});

    return connection;
}

/**
 * Renders the chat as the person who created the link and drives the peer
 * through an incoming connection, the way peerjs would once the invitee joins.
 */
export async function renderChatAsHost(visitorPeerId: string = 'visiting-peer-id'): Promise<RenderedChat> {
    const {view, peer} = renderChatWaiting();
    const connection = await joinAs(peer, visitorPeerId);

    return {view, peer, connection};
}

/**
 * Renders the chat as the person who opened a share link, i.e. with the target
 * peer id in the URL hash, and completes the outgoing connection.
 */
export async function renderChatAsGuest(targetPeerId: string = 'invited-peer-id', members: string[] = []): Promise<RenderedChat> {
    const {view, peer} = renderChatDialling(targetPeerId);
    const connection = peer.outgoing[0];

    act(() => connection.emit('open'));
    await deliver(connection, {type: 'members', ids: members});

    return {view, peer, connection};
}

/** Delivers a packet over a connection as the peer at its other end would send it. */
export async function deliver(connection: FakeDataConnection, packet: Packet): Promise<void> {
    await deliverRaw(connection, await key.seal(packet, connection.peer));
}

/** Delivers whatever arrives over a connection, sealed or not, and waits until the chat dealt with it. */
export async function deliverRaw(connection: FakeDataConnection, data: unknown): Promise<void> {
    await act(() => connection.emitAndSettle('data', data));
}

/** Everything the chat sent over a connection, opened the way its other end would. */
export function sentOver(connection: FakeDataConnection): Promise<Packet[]> {
    return Promise.all(connection.sent.map(data => key.open(data, FakePeer.instances[0].id)));
}

/** The texts the chat sent over a connection, once as many as expected left. */
export async function textsSentOver(connection: FakeDataConnection, count: number = 1): Promise<string[]> {
    let texts: string[] = [];

    await waitFor(async () => {
        texts = (await sentOver(connection)).filter(packet => packet.type === 'text').map(packet => (packet as {text: string}).text);
        expect(texts.length).toBeGreaterThanOrEqual(count);
    });

    return texts;
}
