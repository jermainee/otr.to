#!/usr/bin/env python3
# Health check after a deploy: does the relay on this host give the user from turnserver.conf an
# allocation, over UDP and over TCP, the two ways browsers ask? Standard library only, install.sh
# runs it with the system Python.
#   healthcheck.py <turnserver.conf>
import hashlib
import hmac
import ipaddress
import os
import socket
import struct
import sys

MAGIC_COOKIE = 0x2112A442
ALLOCATE, REFRESH = 0x0003, 0x0004
SUCCESS, ERROR = 0x0100, 0x0110
USERNAME = 0x0006
MESSAGE_INTEGRITY = 0x0008
ERROR_CODE = 0x0009
LIFETIME = 0x000D
REALM = 0x0014
NONCE = 0x0015
XOR_RELAYED_ADDRESS = 0x0016
REQUESTED_TRANSPORT = 0x0019
UDP = 17


def settings(path: str) -> tuple[int, str, str]:
    """Port, user name and password from the coturn configuration."""
    values = {}
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                values.setdefault(key.strip(), value.strip())
    user, password = values["user"].split(":", 1)
    return int(values.get("listening-port", 3478)), user, password


def attribute(kind: int, value: bytes) -> bytes:
    return struct.pack("!HH", kind, len(value)) + value + b"\0" * (-len(value) % 4)


def message(method: int, transaction: bytes, attributes: list[tuple[int, bytes]], key: bytes | None = None) -> bytes:
    body = b"".join(attribute(kind, value) for kind, value in attributes)
    if key is not None:
        # The integrity covers the header with a length that already counts the integrity itself
        header = struct.pack("!HHI", method, len(body) + 24, MAGIC_COOKIE) + transaction
        body += attribute(MESSAGE_INTEGRITY, hmac.new(key, header + body, hashlib.sha1).digest())
    return struct.pack("!HHI", method, len(body), MAGIC_COOKIE) + transaction + body


def parse(data: bytes, transaction: bytes) -> tuple[int, dict[int, bytes], bytes]:
    kind, length, cookie = struct.unpack("!HHI", data[:8])
    if cookie != MAGIC_COOKIE or data[8:20] != transaction:
        raise ValueError("answer to a different request")
    attributes = {}
    offset = 20
    while offset + 4 <= 20 + length:
        attr, size = struct.unpack("!HH", data[offset:offset + 4])
        attributes.setdefault(attr, data[offset + 4:offset + 4 + size])
        offset += 4 + size + (-size % 4)
    return kind, attributes, transaction


def error(attributes: dict[int, bytes]) -> str:
    value = attributes.get(ERROR_CODE, b"\0\0\0\0")
    return f"{(value[2] & 7) * 100 + value[3]} {value[4:].decode(errors='replace')}".strip()


def relayed_address(value: bytes, transaction: bytes) -> ipaddress.IPv4Address | ipaddress.IPv6Address:
    mask = struct.pack("!I", MAGIC_COOKIE) + transaction
    return ipaddress.ip_address(bytes(a ^ b for a, b in zip(value[4:], mask)))


def own_address() -> str:
    """The address this host reaches the internet from. Asked there, the relay hands out the address
    browsers get; asked on 127.0.0.1, it would hand out 127.0.0.1."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as probe:
            # Connecting over UDP sends nothing, it only picks the route
            probe.connect(("192.0.2.1", 9))
            return probe.getsockname()[0]
    except OSError:
        return "127.0.0.1"


class Connection:
    """STUN over UDP or TCP to the relay on this host. Over TCP, messages carry their own length."""

    def __init__(self, transport: str, host: str, port: int, timeout: float):
        kind = socket.SOCK_DGRAM if transport == "udp" else socket.SOCK_STREAM
        self.transport = transport
        self.sock = socket.socket(socket.AF_INET, kind)
        self.sock.settimeout(timeout)
        self.sock.connect((host, port))

    def ask(self, method: int, attributes: list[tuple[int, bytes]], key: bytes | None = None) -> tuple[int, dict[int, bytes], bytes]:
        transaction = os.urandom(12)
        self.sock.sendall(message(method, transaction, attributes, key))
        if self.transport == "udp":
            return parse(self.sock.recv(4096), transaction)
        header = self.read(20)
        return parse(header + self.read(struct.unpack("!H", header[2:4])[0]), transaction)

    def read(self, size: int) -> bytes:
        data = b""
        while len(data) < size:
            chunk = self.sock.recv(size - len(data))
            if not chunk:
                raise ConnectionError("connection closed")
            data += chunk
        return data

    def close(self) -> None:
        self.sock.close()


def allocate(transport: str, host: str, port: int, user: str, password: str, timeout: float = 3) -> str | None:
    """Allocates a relay address the way a browser does and gives it back. Returns an error or None."""
    try:
        connection = Connection(transport, host, port, timeout)
    except OSError as e:
        return f"no connection: {e}"
    try:
        wanted = [(REQUESTED_TRANSPORT, struct.pack("!B3x", UDP))]
        # The first request has no credentials, the answer names the realm and a nonce
        kind, attributes, _ = connection.ask(ALLOCATE, wanted)
        if kind != ALLOCATE | ERROR or REALM not in attributes or NONCE not in attributes:
            return f"no challenge for credentials, but {kind:#06x} {error(attributes)}"
        realm, nonce = attributes[REALM], attributes[NONCE]
        key = hashlib.md5(user.encode() + b":" + realm + b":" + password.encode()).digest()
        signed = [(USERNAME, user.encode()), (REALM, realm), (NONCE, nonce)]
        kind, attributes, transaction = connection.ask(ALLOCATE, wanted + signed, key)
        if kind != ALLOCATE | SUCCESS or XOR_RELAYED_ADDRESS not in attributes:
            return f"allocation refused: {error(attributes)}"
        address = relayed_address(attributes[XOR_RELAYED_ADDRESS], transaction)
        # Give the allocation back right away instead of letting it expire
        connection.ask(REFRESH, [(LIFETIME, struct.pack("!I", 0))] + signed, key)
    except (OSError, ValueError, struct.error) as e:
        return f"no answer: {e}"
    finally:
        connection.close()
    if not address.is_global:
        print(f"Warning: over {transport} the relay hands out {address}, which is no public address. "
              "Behind NAT, set external-ip in turnserver.conf.", file=sys.stderr)
    return None


def check(path: str) -> int:
    port, user, password = settings(path)
    host = own_address()
    failed = 0
    for transport in ("udp", "tcp"):
        problem = allocate(transport, host, port, user, password)
        if problem:
            print(f"TURN over {transport} on {host}:{port}: {problem}", file=sys.stderr)
            failed = 1
    return failed


if __name__ == "__main__":
    sys.exit(check(sys.argv[1]))
