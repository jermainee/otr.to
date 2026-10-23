<h1 align="center">otr.to</h1>
<p align="center">
  Peer-to-peer chat in your web browser
  <br/><br/>
  We believe that everyone has the right to communicate privately.<br/>
  That's why we provide otr.to, a tool that allows you to chat P2P.
  <br/><br/>
  Website: https://otr.to
</p>


## Mainly used packages:
 * [facebook/react](https://github.com/facebook/react)
 * [microsoft/TypeScript](https://github.com/microsoft/TypeScript)
 * [peers/peerjs](https://github.com/peers/peerjs)
 * [jgthms/bulma](https://github.com/jgthms/bulma)

## Available Scripts

In the project directory, you can run:

### `npm run dev`

Builds the bundle in development mode and rebuilds it on every change.

### `npm test`

Runs the Jest test suite once.\
Use `npm run test:watch` while editing, or `npm run test:coverage` for a coverage report.

### `npm run test:e2e`

Runs the Playwright suite against the built site: it drives two browser tabs
through a real chat over WebRTC, messages and file transfers included. Only the
PeerJS signalling server is stubbed, so the suite needs no network.\
The browser comes from `npx playwright install chromium`, which is a one-off.

### `npm run build`

Builds the app for production to the `public` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!
