import '@testing-library/jest-dom';
import {webcrypto} from 'node:crypto';
import * as util from 'node:util';

// jsdom brings crypto.getRandomValues(), but neither the rest of WebCrypto nor
// the text encoders, which the chat encrypts with. Node's are the same API.
if (!window.crypto.subtle) {
    Object.defineProperty(window.crypto, 'subtle', {value: webcrypto.subtle});
}

if (typeof TextEncoder === 'undefined') {
    Object.assign(globalThis, {TextEncoder: util.TextEncoder, TextDecoder: util.TextDecoder});
}

// jsdom does not implement Blob.arrayBuffer(), which Chat uses to chunk a file
// before sending it. Every browser peerjs runs in has it.
if (typeof Blob !== 'undefined' && !Blob.prototype.arrayBuffer) {
    Blob.prototype.arrayBuffer = function (this: Blob): Promise<ArrayBuffer> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as ArrayBuffer);
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(this);
        });
    };
}
