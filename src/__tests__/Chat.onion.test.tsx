/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "http://xady4v2muvyix5f4k3pu3tdkkti7a7qanqpoyxbgyflfp6jk7aocgqqd.onion/"}
 */

import * as React from "react";
import {act, render, screen} from "@testing-library/react";
import Chat from "../Chat";
import FakePeer from "../__mocks__/peerjs";

const ONION_ORIGIN = "http://xady4v2muvyix5f4k3pu3tdkkti7a7qanqpoyxbgyflfp6jk7aocgqqd.onion";

const shareLink = () => (screen.getAllByDisplayValue(/otr\.to|\.onion/)[0] as HTMLInputElement).value;

beforeEach(() => FakePeer.reset());
afterEach(() => { window.location.hash = ''; });

describe('Chat served from the onion service', () => {
    it('shares an onion link instead of the clearnet one', () => {
        render(<Chat/>);

        expect(shareLink()).toBe(ONION_ORIGIN + "/#" + FakePeer.instances[0].id);
    });

    it('points the share buttons at the onion link', () => {
        render(<Chat/>);

        const link = ONION_ORIGIN + "/#" + FakePeer.instances[0].id;

        expect(screen.getByText('Telegram').closest('a')).toHaveAttribute(
            'href', "https://telegram.me/share/url?url=" + link);
        expect(screen.getByText('WhatsApp').closest('a')).toHaveAttribute(
            'href', "https://wa.me/?text=" + link);
        expect(screen.getByText('E-Mail').closest('a')).toHaveAttribute(
            'href', "mailto:?subject=&body=" + link);
    });

    it('does not advertise the onion service to visitors already on it', () => {
        const {container} = render(<Chat/>);

        expect(screen.queryByText('Also available via Tor')).not.toBeInTheDocument();
        expect(screen.queryByRole('link', {name: ONION_ORIGIN})).not.toBeInTheDocument();
        // Only the rule that already sat above the GitHub button.
        expect(container.querySelectorAll('hr')).toHaveLength(1);
    });

    it('connects to the peer id from an onion link that was opened', () => {
        window.location.hash = '#invitedpeerid';

        render(<Chat/>);

        const peer = FakePeer.instances[0];
        act(() => peer.emit('open', peer.id));

        expect(peer.outgoing.map(connection => connection.peer)).toEqual(['invitedpeerid']);
    });
});
