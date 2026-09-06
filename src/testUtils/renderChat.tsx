import * as React from "react";
import {act, render, RenderResult} from "@testing-library/react";
import Chat from "../Chat";
import FakePeer, {FakeDataConnection} from "../__mocks__/peerjs";

interface RenderedChat {
    view: RenderResult;
    peer: FakePeer;
    connection: FakeDataConnection;
}

/** Renders the chat as the person who created the link, before anyone joins. */
export function renderChatWaiting(): {view: RenderResult, peer: FakePeer} {
    const view = render(<Chat/>);

    return {view, peer: FakePeer.instances[0]};
}

/**
 * Renders the chat as the person who opened a share link and lets the peer
 * open, but leaves the outgoing connection unanswered.
 */
export function renderChatDialling(targetPeerId: string = 'invited-peer-id'): {view: RenderResult, peer: FakePeer} {
    window.location.hash = '#' + targetPeerId;

    const view = render(<Chat/>);
    const peer = FakePeer.instances[0];

    act(() => peer.emit('open', peer.id));

    return {view, peer};
}

/**
 * Renders the chat as the person who created the link and drives the peer
 * through an incoming connection, the way peerjs would once the invitee joins.
 */
export function renderChatAsHost(visitorPeerId: string = 'visiting-peer-id'): RenderedChat {
    const view = render(<Chat/>);
    const peer = FakePeer.instances[0];
    const connection = new FakeDataConnection(visitorPeerId);

    act(() => peer.emit('connection', connection));

    return {view, peer, connection};
}

/**
 * Renders the chat as the person who opened a share link, i.e. with the target
 * peer id in the URL hash, and completes the outgoing connection.
 */
export function renderChatAsGuest(targetPeerId: string = 'invited-peer-id'): RenderedChat {
    const {view, peer} = renderChatDialling(targetPeerId);
    const connection = peer.outgoing[0];
    act(() => connection.emit('open'));

    return {view, peer, connection};
}

/** The section holding the share link, whether it is currently shown or not. */
export function shareSection(): HTMLElement {
    return document.querySelector('div.container.content, div.is-hidden');
}
