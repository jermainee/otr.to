/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "https://otr.to/"}
 */

import * as React from "react";
import {fireEvent, render, screen} from "@testing-library/react";
import Chat from "../Chat";
import FakePeer from "../__mocks__/peerjs";

jest.mock('copy-to-clipboard');
const copy = require('copy-to-clipboard') as jest.Mock;

const ONION_ADDRESS = "http://xady4v2muvyix5f4k3pu3tdkkti7a7qanqpoyxbgyflfp6jk7aocgqqd.onion";

/** The share link input is the first one on the page. */
const shareLink = () => (screen.getAllByDisplayValue(/otr\.to|\.onion/)[0] as HTMLInputElement).value;

beforeEach(() => {
    FakePeer.reset();
    copy.mockClear();
});

describe('Chat on the clearnet domain', () => {
    it('shares a clearnet link built from the generated peer id', () => {
        render(<Chat/>);

        expect(FakePeer.instances).toHaveLength(1);
        expect(shareLink()).toBe("https://otr.to/#" + FakePeer.instances[0].id);
    });

    it('points the share buttons at the same clearnet link', () => {
        render(<Chat/>);

        const link = "https://otr.to/#" + FakePeer.instances[0].id;

        expect(screen.getByText('Telegram').closest('a')).toHaveAttribute(
            'href', "https://telegram.me/share/url?url=" + link);
        expect(screen.getByText('WhatsApp').closest('a')).toHaveAttribute(
            'href', "https://wa.me/?text=" + link);
        expect(screen.getByText('E-Mail').closest('a')).toHaveAttribute(
            'href', "mailto:?subject=&body=" + link);
    });

    it('advertises the onion service', () => {
        render(<Chat/>);

        expect(screen.getByText('Also available via Tor')).toBeInTheDocument();
        expect(screen.getByDisplayValue(ONION_ADDRESS)).toBeInTheDocument();
        expect(screen.getByText('Tor Browser')).toHaveAttribute(
            'href', 'https://www.torproject.org/download/');
    });

    it('copies the onion address, not the chat link', () => {
        render(<Chat/>);

        fireEvent.click(screen.getByAltText('Copy onion address'));

        expect(copy).toHaveBeenCalledTimes(1);
        expect(copy.mock.calls[0][0]).toBe(ONION_ADDRESS);
        expect(screen.getAllByText('Copied!')).toHaveLength(1);
    });
});
