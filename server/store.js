"use strict";

const { DatabaseSync } = require("node:sqlite");
const path = require("path");

const CODE_TTL_MS = 24 * 60 * 60 * 1000;
const MESSAGE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const db = new DatabaseSync(path.join(__dirname, "shoutroom.db"));

db.exec(`
    CREATE TABLE IF NOT EXISTS codes (
        code       TEXT NOT NULL,
        peer_id    TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        PRIMARY KEY (code, peer_id)
    );

    CREATE TABLE IF NOT EXISTS messages (
        id         TEXT PRIMARY KEY,
        code       TEXT NOT NULL,
        ciphertext TEXT NOT NULL,
        created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_messages_code ON messages (code);
`);

const prune = db.prepare(`
    DELETE FROM codes WHERE expires_at < ?
`);
const insertCode = db.prepare(`
    INSERT OR REPLACE INTO codes (code, peer_id, expires_at) VALUES (?, ?, ?)
`);
const selectCodes = db.prepare(`
    SELECT peer_id, expires_at FROM codes WHERE code = ?
`);
const deleteCode = db.prepare(`
    DELETE FROM codes WHERE code = ?
`);

const insertMessage = db.prepare(`
    INSERT OR REPLACE INTO messages (id, code, ciphertext, created_at) VALUES (?, ?, ?, ?)
`);
const selectMessages = db.prepare(`
    SELECT id, ciphertext, created_at FROM messages WHERE code = ? ORDER BY created_at ASC
`);
const deleteMessage = db.prepare(`
    DELETE FROM messages WHERE id = ?
`);
const deleteMessagesByCode = db.prepare(`
    DELETE FROM messages WHERE code = ?
`);
const deleteExpiredMessages = db.prepare(`
    DELETE FROM messages WHERE created_at < ?
`);

function now() {
    return Date.now();
}

function registerCode(code, peerId) {
    prune.run(now());
    insertCode.run(code, peerId, now() + CODE_TTL_MS);
}

function resolveCode(code) {
    prune.run(now());
    const rows = selectCodes.all(code);
    return rows.map(row => row.peer_id);
}

function unregisterCode(code, peerId) {
    deleteCode.run(code, peerId);
}

function storeMessage(id, code, ciphertext) {
    deleteExpiredMessages.run(now() - MESSAGE_TTL_MS);
    insertMessage.run(id, code, ciphertext, now());
}

function listMessages(code) {
    return selectMessages.all(code);
}

function removeMessage(id) {
    deleteMessage.run(id);
}

function removeMessagesForCode(code) {
    deleteMessagesByCode.run(code);
}

module.exports = {
    registerCode,
    resolveCode,
    unregisterCode,
    storeMessage,
    listMessages,
    removeMessage,
    removeMessagesForCode,
};