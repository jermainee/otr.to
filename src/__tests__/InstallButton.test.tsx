import * as React from "react";
import {act, fireEvent, render, screen} from "@testing-library/react";
import InstallButton from "../InstallButton";

/** What Chrome hands the page when it offers to install the site. */
function offerInstall() {
    const offer = Object.assign(new Event('beforeinstallprompt', {cancelable: true}), {
        prompt: jest.fn().mockResolvedValue({outcome: 'accepted'}),
    });

    act(() => {
        window.dispatchEvent(offer);
    });

    return offer;
}

const installButton = () => screen.queryByRole('button', {name: 'Install app'});

describe('InstallButton', () => {
    afterEach(() => {
        // The offer outlives the button, so don't let one test's reach the next.
        act(() => {
            window.dispatchEvent(new Event('appinstalled'));
        });
    });

    it('shows nothing until the browser offers to install the app', () => {
        render(<InstallButton/>);

        expect(installButton()).not.toBeInTheDocument();
    });

    it('takes the browser’s offer instead of letting it show its own banner', () => {
        render(<InstallButton/>);

        const offer = offerInstall();

        expect(installButton()).toBeInTheDocument();
        expect(offer.defaultPrevented).toBe(true);
    });

    it('keeps an offer made before it was shown', () => {
        offerInstall();

        render(<InstallButton/>);

        expect(installButton()).toBeInTheDocument();
    });

    it('opens the browser’s install dialog and steps aside, since an offer only does that once', () => {
        render(<InstallButton/>);
        const offer = offerInstall();

        fireEvent.click(installButton());

        expect(offer.prompt).toHaveBeenCalledTimes(1);
        expect(installButton()).not.toBeInTheDocument();
    });

    it('comes back with the browser’s next offer, when the dialog was turned down', () => {
        render(<InstallButton/>);
        offerInstall();
        fireEvent.click(installButton());

        const next = offerInstall();
        fireEvent.click(installButton());

        expect(next.prompt).toHaveBeenCalledTimes(1);
    });

    it('goes away once the app is installed', () => {
        render(<InstallButton/>);
        offerInstall();

        act(() => {
            window.dispatchEvent(new Event('appinstalled'));
        });

        expect(installButton()).not.toBeInTheDocument();
    });
});
