import * as React from "react";
import {act, fireEvent, render, screen} from "@testing-library/react";
import Chat from "../Chat";
import FakePeer from "../__mocks__/peerjs";

jest.mock('copy-to-clipboard');
const copy = require('copy-to-clipboard') as jest.Mock;

const shareLink = () => (screen.getByDisplayValue(/otr\.to/) as HTMLInputElement).value;
const secret = () => shareLink().split('.').pop();

beforeEach(() => {
    FakePeer.reset();
    copy.mockClear();
});

describe('The share link', () => {
    it('is built from the generated peer id and the secret of the chat’s key', () => {
        render(<Chat/>);

        expect(FakePeer.instances).toHaveLength(1);
        expect(shareLink()).toBe("https://otr.to/#" + FakePeer.instances[0].id + "." + secret());
        expect(secret()).toMatch(/^[0-9A-Za-z]{22}$/);
    });

    it('carries a new secret for every chat', () => {
        const first = render(<Chat/>);
        const firstSecret = secret();
        first.unmount();

        render(<Chat/>);

        expect(secret()).not.toBe(firstSecret);
    });

    it('is what the share buttons point at, peer id included', () => {
        render(<Chat/>);

        // Unencoded, the # would end the share URL and drop the peer id and the secret.
        const link = encodeURIComponent(shareLink());

        expect(screen.getByRole('link', {name: 'Telegram'})).toHaveAttribute(
            'href', "https://telegram.me/share/url?url=" + link);
        expect(screen.getByRole('link', {name: 'WhatsApp'})).toHaveAttribute(
            'href', "https://wa.me/?text=" + link);
        expect(screen.getByRole('link', {name: 'Email'})).toHaveAttribute(
            'href', "mailto:?subject=&body=" + link);
    });

    it('is what the button next to it copies, which confirms it for a moment', () => {
        jest.useFakeTimers();

        try {
            render(<Chat/>);

            fireEvent.click(screen.getByRole('button', {name: 'Copy link'}));

            expect(copy.mock.calls[0][0]).toBe(shareLink());
            expect(screen.getByRole('button', {name: 'Link copied'})).toBeInTheDocument();
            expect(screen.getByRole('status')).toHaveTextContent('Link copied. Waiting for someone to open it');

            act(() => { jest.advanceTimersByTime(2500); });

            expect(screen.getByRole('button', {name: 'Copy link'})).toBeInTheDocument();
            expect(screen.getByRole('status')).toHaveTextContent('Waiting for someone to open the link');
        } finally {
            jest.useRealTimers();
        }
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
