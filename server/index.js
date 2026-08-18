"use strict";

const express = require("express");
const http = require("http");
const path = require("path");
const { ExpressPeerServer } = require("peer");
const { WebSocketServer } = require("ws");
const store = require("./store");

const app = express();
const server = http.createServer(app);

app.use(express.json({ limit: "10mb" }));

const peerServer = ExpressPeerServer(server, {
    debug: true,
    path: "/peerjs",
});
app.use("/peerjs", peerServer);

app.get("/api/health", (_req, res) => {
    res.json({ ok: true, uptime: process.uptime() });
});

app.post("/api/codes", (req, res) => {
    const { code, peerId } = req.body || {};
    if (!code || !peerId) {
        return res.status(400).json({ error: "code and peerId are required" });
    }
    store.registerCode(code, peerId);
    res.json({ ok: true });
});

app.get("/api/codes/:code", (req, res) => {
    const peerIds = store.resolveCode(req.params.code);
    res.json({ peerIds });
});

app.delete("/api/codes/:code", (req, res) => {
    const { peerId } = req.body || {};
    if (!peerId) {
        return res.status(400).json({ error: "peerId is required" });
    }
    store.unregisterCode(req.params.code, peerId);
    res.json({ ok: true });
});

app.post("/api/messages/:code", (req, res) => {
    const { id, ciphertext } = req.body || {};
    if (!id || !ciphertext) {
        return res.status(400).json({ error: "id and ciphertext are required" });
    }
    store.storeMessage(id, req.params.code, ciphertext);
    res.json({ ok: true });
});

app.get("/api/messages/:code", (req, res) => {
    const messages = store.listMessages(req.params.code);
    res.json({ messages });
});

app.delete("/api/messages/:code/:id", (req, res) => {
    store.removeMessage(req.params.id);
    res.json({ ok: true });
});

app.delete("/api/messages/:code", (_req, res) => {
    store.removeMessagesForCode(_req.params.code);
    res.json({ ok: true });
});

const publicDir = path.resolve(__dirname, "..", "public");
app.use(express.static(publicDir));

app.get(/^\/(c\/[A-Z2-9]+|shout|)\/?$/, (_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
});

const wss = new WebSocketServer({ server, path: "/shout" });

const rooms = new Map();

function broadcast(room, payload) {
    const sockets = rooms.get(room);
    if (!sockets) return;
    const data = JSON.stringify(payload);
    for (const ws of sockets) {
        if (ws.readyState === 1) {
            ws.send(data);
        }
    }
}

wss.on("connection", ws => {
    let room = null;
    let peerId = null;

    ws.on("message", raw => {
        let msg;
        try {
            msg = JSON.parse(raw.toString());
        } catch {
            return;
        }

        if (msg.type === "join" && msg.room) {
            room = msg.room;
            peerId = msg.peerId;
            if (!rooms.has(room)) rooms.set(room, new Set());
            rooms.get(room).add(ws);
            broadcast(room, { type: "presence", room, action: "join", peerId, members: count(room) });
        } else if (msg.type === "leave") {
            leave();
        }
    });

    function leave() {
        if (!room) return;
        rooms.get(room)?.delete(ws);
        if (rooms.get(room)?.size === 0) rooms.delete(room);
        broadcast(room, { type: "presence", room, action: "leave", peerId, members: count(room) });
        room = null;
        peerId = null;
    }

    ws.on("close", leave);
});

function count(room) {
    return rooms.get(room)?.size ?? 0;
}

const PORT = process.env.PORT || 4096;
server.listen(PORT, () => {
    console.log(`shoutroom server listening on :${PORT}`);
});