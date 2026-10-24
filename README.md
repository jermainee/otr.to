# otr.to

[![CI](https://github.com/jermainee/otr.to/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/jermainee/otr.to/actions/workflows/ci.yml)

Peer-to-peer chat in your web browser. Open [otr.to](https://otr.to), send the
link it gives you to someone, and the two of you talk over a direct connection
between your browsers. There is no account, nothing to install, and no history:
the conversation is gone when the tab is closed.

## Features

- **Direct connection.** Messages and files travel over a WebRTC data channel
  between the two browsers, encrypted in transit.
- **No sign-up.** Each visit gets a fresh random peer ID. Nothing ties it to
  you.
- **Nothing stored.** The conversation lives only in the open tab.
- **File transfer.** Send one or several files; the other side gets a
  download button once each one has arrived.
- **Easy sharing.** Copy the chat link or share it straight to Telegram,
  WhatsApp or email.

## How it works

1. Opening otr.to without a link creates a peer with a random 22-character ID
   and shows the chat link, `https://otr.to/#<peer-id>`.
2. Whoever opens that link creates a peer of their own and connects to the ID
   after the `#`. If nobody answers within six seconds, the page says the chat
   is no longer open and offers to start a new one.
3. The [PeerJS](https://peerjs.com) signalling server introduces the two
   browsers to each other. From then on, everything goes over the WebRTC data
   channel, which is encrypted with DTLS.
4. Files are read in the browser and sent in 16 KB chunks over the same
   channel. The receiver puts them back together and offers the result as a
   download.

### What servers are involved

The chat itself never touches a server, but a few are needed to set it up:

- **Signalling.** The public PeerJS server (`0.peerjs.com`) brokers the
  connection. It sees both peer IDs and IP addresses, not the messages.
- **STUN and TURN.** STUN servers help the browsers find a direct route. When
  a firewall or NAT rules that out, traffic is relayed through a TURN server,
  which forwards the encrypted data without being able to read it.
- **Analytics.** The page loads the apitiny analytics script.

## Tech stack

- [React](https://react.dev) and [TypeScript](https://www.typescriptlang.org)
- [PeerJS](https://github.com/peers/peerjs) for WebRTC
- [Bulma](https://bulma.io) for styling, only the modules that
  [`src/bulma.scss`](src/bulma.scss) lists
- [webpack](https://webpack.js.org) for bundling
- [Jest](https://jestjs.io), [Testing Library](https://testing-library.com) and
  [Playwright](https://playwright.dev) for tests

## Getting started

You need Node.js 22 or newer.

```sh
git clone https://github.com/jermainee/otr.to.git
cd otr.to
npm install
npm run dev
```

`npm run dev` writes the script and the stylesheet to `public/dist` and
rebuilds them on every change. Serve the `public` folder with any static file
server to open the app, for example the one the end-to-end tests use:

```sh
node e2e/static-server.js
```

It listens on http://127.0.0.1:4173 (set `PORT` to change that). To try a
conversation, open the app in one tab and the chat link it shows in another.

## Scripts

| Command                 | What it does                                                |
| ----------------------- | ----------------------------------------------------------- |
| `npm run dev`           | Builds in development mode and rebuilds on every change.    |
| `npm run build`         | Builds the minified script and stylesheet in `public/dist`. |
| `npm test`              | Runs the Jest suite once.                                   |
| `npm run test:watch`    | Runs Jest in watch mode.                                    |
| `npm run test:coverage` | Runs Jest with a coverage report in `coverage/`.            |
| `npm run test:e2e`      | Builds the site and runs the Playwright suite against it.   |

## Testing

**Unit tests** live in `src/__tests__` and run in jsdom. PeerJS is replaced by
a mock (`src/__mocks__/peerjs.ts`), so they never open a network connection.

**End-to-end tests** live in `e2e` and drive two browser tabs through a real
chat over WebRTC: the share link and its buttons, messages in both directions,
a stale link, and file transfers down to the downloaded bytes. Another test
holds the script back to check that the page is styled without it. Only the
PeerJS signalling server is stubbed (`e2e/support/signalling.ts`), so the suite
needs no internet connection. Install the browser once before the first run:

```sh
npx playwright install chromium
```

## Continuous integration

[GitHub Actions](.github/workflows/ci.yml) runs on every push to `main` and
on every pull request, in two jobs:

- **Test and build** runs the Jest suite with coverage, then the production
  build, which also type-checks everything the entry point reaches.
- **End to end** runs the Playwright suite and keeps its HTML report as a
  build artifact for seven days.

Dependabot checks the npm packages and the GitHub Actions weekly.

## Project structure

```
index.tsx              Entry point: mounts the app and the router
src/Chat.tsx           Peer setup, connection states, file transfer and share link
src/Messages.tsx       The conversation: messages, notices and files
src/Icons.tsx          Inline SVG icons that take the text colour
src/bulma.scss         The Bulma modules the app uses
src/theme.css          Colour tokens and Bulma overrides for light and dark mode
src/chat.css           Layout of the start page and the conversation
src/Service/           Peer ID generation and file size formatting
src/Struct/            Message and file transfer models
src/__tests__/         Jest tests
e2e/                   Playwright tests and the static server they use
public/                Static site: index.html, manifest and the bundle
```

## Deployment

`npm run build` produces a fully static site in `public`. Upload that folder
to any static host. The app only uses the root path, so no rewrite rules are
needed.
