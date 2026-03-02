# Call Module – 1-1 Audio Calling

## Overview

- **PostgreSQL** (`call_logs`): persistent call data (caller, receiver, status, duration, missed).
- **MongoDB** (`call_sessions`): live session state (offer, answer, ICE, status); cleared when call ends.
- **Socket.io** (namespace `/call`): signaling (initiate, ringing, accept, reject, busy, timeout, end, offer, answer, ice-candidate).
- **JWT**: required for Socket handshake (`auth.token` or `Authorization: Bearer <token>`).

## REST API (prefix `/api`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/call/initiate` | Check if receiver is available (body: `{ "receiverId": number }`). |
| POST | `/api/call/end` | End call (body: `{ "callSessionId": string }`). |
| GET | `/api/call/logs` | Call logs for current user (`?limit=&offset=`). |

## WebSocket (namespace `/call`)

Connect with JWT: `auth: { token: accessToken }` or header `Authorization: Bearer <accessToken>`.

**Client → Server**

- `call:initiate` – `{ receiverId: number }` → creates session, notifies receiver (or `call:busy`).
- `call:accept` – `{ callSessionId: string }`
- `call:reject` – `{ callSessionId: string }`
- `call:end` – `{ callSessionId: string }`
- `call:offer` – `{ callSessionId: string, offer: RTCSessionDescriptionInit }`
- `call:answer` – `{ callSessionId: string, answer: RTCSessionDescriptionInit }`
- `call:ice-candidate` – `{ callSessionId: string, candidate: RTCIceCandidateInit }`

**Server → Client**

- `call:ringing` – `{ callSessionId, callerId }`
- `call:accept` – `{ callSessionId, acceptedBy }`
- `call:reject` – `{ callSessionId, rejectedBy }`
- `call:busy` – `{ receiverId }`
- `call:timeout` – `{ callSessionId }`
- `call:end` – `{ callSessionId }`
- `call:offer` / `call:answer` / `call:ice-candidate` – relayed to peer.

## Timeout

If the receiver does not accept within **30 seconds**, the server emits `call:timeout`, marks the call as missed in PostgreSQL, and deletes the Mongo session.

## Android

Use the same HTTP base URL for REST. For Socket.io, connect to the same host/port with path/namespace `/call` and pass the JWT in the handshake.
