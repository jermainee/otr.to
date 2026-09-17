import * as React from "react";
import {fireEvent, render, screen} from "@testing-library/react";
import Chat from "../Chat";
import FakePeer from "../__mocks__/peerjs";

jest.mock('copy-to-clipboard');
const copy = require('copy-to-clipboard') as jest.Mock;

const shareLink = () => (screen.getByDisplayValue(/otr\.to/) as HTMLInputElement).value;

beforeEach(() => {
    FakePeer.reset();
    copy.mockClear();
});

describe('The share link', () => {
    it('is built from the generated peer id', () => {
        render(<Chat/>);

        expect(FakePeer.instances).toHaveLength(1);
        expect(shareLink()).toBe("https://otr.to/#" + FakePeer.instances[0].id);
    });

    it('is what the share buttons point at', () => {
        render(<Chat/>);

        const link = "https://otr.to/#" + FakePeer.instances[0].id;

        expect(screen.getByText('Telegram').closest('a')).toHaveAttribute(
            'href', "https://telegram.me/share/url?url=" + link);
        expect(screen.getByText('WhatsApp').closest('a')).toHaveAttribute(
            'href', "https://wa.me/?text=" + link);
        expect(screen.getByText('E-Mail').closest('a')).toHaveAttribute(
            'href', "mailto:?subject=&body=" + link);
    });

    it('is what the button next to it copies', () => {
        render(<Chat/>);

        fireEvent.click(screen.getByAltText('Copy link'));

        expect(copy.mock.calls[0][0]).toBe("https://otr.to/#" + FakePeer.instances[0].id);
        expect(screen.getAllByText('Copied!')).toHaveLength(1);
    });

    it('sits above a single rule and the GitHub button', () => {
        const {container} = render(<Chat/>);

        expect(container.querySelectorAll('hr')).toHaveLength(1);
        expect(screen.getByLabelText(/Star .* on GitHub/).previousElementSibling.tagName).toBe('HR');
    });
});
