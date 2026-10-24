# otr.to

[![CI](https://github.com/jermainee/otr.to/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/jermainee/otr.to/actions/workflows/ci.yml)

Peer-to-peer chat in your web browser. Open [otr.to](https://otr.to), send the
link it gives you to one person or several, and you talk over direct
connections between your browsers, end-to-end encrypted. There is no account,
nothing to install, and no history: the conversation is gone when the tab is
closed.

## Features

- **Direct connection.** Messages and files travel over WebRTC data channels
  straight from one browser to the other.
- **End-to-end encrypted.** The key is part of the link and never reaches a
  server, so only the people who have the link can read along.
- **Group chats.** Everyone who opens the link joins the same chat. Once there
  are more than two of you, messages show a short generated name, such as
  "Calm Otter", under them. The chat goes on as long as two people are in it,
  whoever leaves.
- **No sign-up.** Each visit gets a fresh random peer ID. Nothing ties it to
  you.
- **Nothing stored.** The conversation lives only in the open tab.
- **File transfer.** Send one or several files; the other side gets a
  download button once each one has arrived.
- **Easy sharing.** Copy the chat link or share it straight to Telegram,
  WhatsApp or email. Anyone in the chat can copy an invite link for more
  people.

## How it works

1. Opening otr.to without a link creates a peer with a random 22-character ID
   and a random 22-character secret, and shows the chat link,
   `https://otr.to/#<peer-id>.<secret>`.
2. Whoever opens that link creates a peer of their own and connects to the ID
   after the `#`. If nobody answers within 15 seconds, the page says the chat
   is no longer open and offers to start a new one. A link without a valid
   secret, for example one that was cut off when it was shared, is refused
   straight away.
3. The [PeerJS](https://peerjs.com) signalling server introduces the browsers
   to each other. From then on, everything goes over WebRTC data channels,
   which are encrypted with DTLS.
4. On top of that, every message, file chunk and member list is encrypted with
   AES-256-GCM. The key is derived from the secret with HKDF, and the sender's
   peer ID is authenticated along with each packet. Browsers never send the
   part of a link after the `#` to a server, so neither the signalling server
   nor a TURN relay learns the key, and neither could read or forge messages
   even if it got between two peers. A connection only counts as part of the
   chat once its first packet decrypts.
5. Every peer is connected to every other one. When someone joins, the peer
   they dialled tells them who else is in the chat, and tells the others about
   them; of every two peers, the one with the lower ID dials the other. That is
   why the chat survives anyone leaving, the person who made the link
   included. A link points at the person who shared it, so it works for as
   long as they are in the chat.
6. A closed tab hangs up on everyone on its way out. A tab that crashes or
   hangs, or loses its network, cannot, so every peer also sends an
   encrypted heartbeat every five seconds, and whoever stays silent for 30
   seconds is let go: the others read "Lost the connection to …".
7. Files are read in the browser and sent to everyone in 16 KB chunks over the
   same channels. The receiver puts them back together and offers the result
   as a download.
8. Nicknames come from a hash of the peer ID, so everyone works out the same
   name for the same person without asking anyone.

### What servers are involved

The chat itself never touches a server, but a few are needed to set it up:

- **Signalling.** The public PeerJS server (`0.peerjs.com`) brokers the
  connections. It sees the peer IDs and IP addresses and who connects to whom,
  but never the secret, so it cannot read the messages.
- **STUN.** Cloudflare's and Google's public STUN servers
  (`stun.cloudflare.com`, `stun.l.google.com`) tell each browser its address
  on the internet, so that devices on different networks can find a direct
  route to each other. They see the IP address of whoever asks, not the chat.
- **Analytics.** The page loads the apitiny analytics script.

Whoever has the link can join the chat and read it. That includes the service
it was shared through, such as Telegram, WhatsApp or an email provider, so
share it somewhere you trust.

### Limits

- There is no TURN relay. Where both sides sit behind a strict NAT or
  firewall, as on some mobile networks and in some offices, the browsers find
  no direct route and cannot connect.
- Every message and file is sent once to every other person, which suits
  small groups.
- Someone whose tab crashes or whose network drops stays listed for up to
  half a minute, until their heartbeat is missed.
- People who join later do not see what was said before they came.

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

**End-to-end tests** live in `e2e` and drive browser tabs through real chats
over WebRTC: the share link and its buttons, messages in both directions, a
stale link, file transfers down to the downloaded bytes, group chats of three
and four, and checks that nothing readable crosses a data channel and that the
signalling server never sees the secret. Another test holds the script back to
check that the page is styled without it. Only the PeerJS signalling server is
stubbed (`e2e/support/signalling.ts`), so the suite needs no internet
connection. Install the browser once before the first run:

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
index.tsx                  Entry point: mounts the app and the router
src/Chat.tsx               Connection states, notices, file transfer and share link
src/Messages.tsx           The conversation: messages, names, notices and files
src/Icons.tsx              Inline SVG icons that take the text colour
src/bulma.scss             The Bulma modules the app uses
src/theme.css              Colour tokens and Bulma overrides for light and dark mode
src/chat.css               Layout of the start page and the conversation
src/Service/Group.ts       The peers of a chat and how they find and greet each other
src/Service/RoomKey.ts     The chat's key: the link's secret, encryption, decryption
src/Service/ChatHelper.ts  Peer IDs, chat links, nicknames, file sizes
src/Struct/                Message, packet and file transfer models
src/__tests__/             Jest tests
e2e/                       Playwright tests and the static server they use
public/                    Static site: index.html, manifest and the bundle
```

## Deployment

`npm run build` produces a fully static site in `public`. Upload that folder
to any static host. The app only uses the root path, so no rewrite rules are
needed.
