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

        fireEvent.click(screen.getByRole('button', {name: 'Copy link'}));

        expect(copy.mock.calls[0][0]).toBe("https://otr.to/#" + FakePeer.instances[0].id);
        expect(screen.getAllByText('Copied!')).toHaveLength(1);
    });

    it('sits above a single rule and a button to the repository', () => {
        const {container} = render(<Chat/>);

        const repository = screen.getByRole('link', {name: 'View on GitHub'});

        expect(container.querySelectorAll('hr')).toHaveLength(1);
        expect(repository.previousElementSibling.tagName).toBe('HR');
        expect(repository).toHaveAttribute('href', 'https://github.com/jermainee/otr.to');
        // Not primary like the share buttons: it is not what the page is about.
        expect(repository).not.toHaveClass('is-primary');
    });

    it('takes its icons in the colour of the text around them', () => {
        render(<Chat/>);

        const buttons = [
            screen.getByRole('button', {name: 'Copy link'}),
            screen.getByRole('link', {name: 'Telegram'}),
            screen.getByRole('link', {name: 'WhatsApp'}),
            screen.getByRole('link', {name: 'View on GitHub'}),
        ];

        buttons.forEach(button => expect(button.querySelector('svg')).toHaveAttribute('fill', 'currentColor'));
    });
});
