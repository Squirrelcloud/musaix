"""Wire transport to the MusaixPROOSC Remote Script in Ableton Live 12.

Defaults follow the documented control path: commands to UDP 127.0.0.1:9002,
state feedback arriving on UDP 127.0.0.1:9000.

Two wire formats, picked with ``BRIDGE_WIRE`` so the bridge matches whatever
the Remote Script build expects:

* ``osc``  (default) — OSC message at ``BRIDGE_OSC_ADDRESS`` (``/musaix/command``)
  whose single string argument is the JSON envelope.
* ``json`` — the raw JSON envelope as the UDP datagram.

Envelope: ``{"id": str, "type": "transport.play", "args": {...}, "source": "alic3x"}``.
"""

from __future__ import annotations

import json
import socket
from typing import Any, Protocol

from pythonosc.osc_message_builder import OscMessageBuilder


class Transport(Protocol):
    def send(self, envelope: dict[str, Any]) -> None: ...


def encode(envelope: dict[str, Any], wire: str, osc_address: str) -> bytes:
    body = json.dumps(envelope, separators=(",", ":"))
    if wire == "json":
        return body.encode()
    if wire == "osc":
        builder = OscMessageBuilder(address=osc_address)
        builder.add_arg(body)
        return builder.build().dgram
    raise ValueError(f"Unknown BRIDGE_WIRE {wire!r} (expected 'osc' or 'json')")


class UdpTransport:
    def __init__(self, host: str, port: int, wire: str, osc_address: str) -> None:
        self.target = (host, port)
        self.wire = wire
        self.osc_address = osc_address
        self._sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

    def send(self, envelope: dict[str, Any]) -> None:
        self._sock.sendto(encode(envelope, self.wire, self.osc_address), self.target)


def decode_feedback(data: bytes) -> tuple[str, Any]:
    """Parse a feedback datagram into ``(address, payload)``.

    Accepts an OSC message (first string arg parsed as JSON when possible) or a
    raw JSON datagram (address taken from its ``type``/``address`` field).
    """
    from pythonosc.osc_message import OscMessage

    if data[:1] == b"/":
        msg = OscMessage(data)
        params = list(msg.params)
        payload: Any = params
        if len(params) == 1 and isinstance(params[0], str):
            try:
                payload = json.loads(params[0])
            except ValueError:
                payload = params[0]
        return msg.address, payload
    obj = json.loads(data.decode())
    address = obj.get("address") or obj.get("type") or "/musaix/feedback"
    return str(address), obj
