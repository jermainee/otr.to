import * as React from "react";
import {DownloadIcon} from "./Icons";

/**
 * The browser's offer to install the app (beforeinstallprompt), which Chrome,
 * Edge and Samsung Internet make once the site qualifies, and only once per
 * page. No standard describes it, so TypeScript's DOM types don't either.
 */
interface InstallOffer extends Event {
    prompt(): Promise<unknown>;
}

let offer: InstallOffer | null = null;
const listeners = new Set<() => void>();

function setOffer(next: InstallOffer | null): void {
    offer = next;
    listeners.forEach(listener => listener());
}

// From the moment the script runs rather than from when the button mounts, so
// an offer made in between isn't lost.
window.addEventListener('beforeinstallprompt', event => {
    // Instead of the browser's own banner, which would cover the page.
    event.preventDefault();
    setOffer(event as InstallOffer);
});
window.addEventListener('appinstalled', () => setOffer(null));

function subscribe(listener: () => void): () => void {
    listeners.add(listener);

    return () => listeners.delete(listener);
}

/**
 * Installs otr.to as an app, for as long as the browser offers that. Browsers
 * that install some other way, like Safari through its share menu, never
 * show it, and neither does the installed app.
 */
export default function InstallButton() {
    const current = React.useSyncExternalStore(subscribe, () => offer);

    if (current === null) {
        return null;
    }

    const install = () => {
        // An offer only opens the dialog once. If it is turned down, the
        // browser makes a new one, and the button comes back with it.
        setOffer(null);
        current.prompt();
    };

    return (
        <button type="button" className="button" onClick={install}>
            <span className="icon"><DownloadIcon/></span>
            <span>Install app</span>
        </button>
    );
}
