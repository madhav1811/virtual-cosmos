# Virtual Cosmos Assignment

End-to-end proximity-based 2D multiplayer app with:

- **Frontend:** React + Vite + PixiJS + Tailwind
- **Backend:** Node.js + Express + Socket.IO
- **Realtime logic:** position sync, proximity connect/disconnect, auto chat rooms

## What this implementation includes

### 1) User movement
- 2D canvas world rendered with PixiJS
- Keyboard movement with **WASD** or **Arrow keys**
- Local movement emits real-time coordinates to backend

### 2) Real-time multiplayer
- Multiple connected users are visible with avatar color + name
- All users receive live world updates through Socket.IO

### 3) Proximity detection (core)
- Backend computes user-to-user distance continuously
- If distance `< PROXIMITY_RADIUS`, users are linked
- If distance `>= PROXIMITY_RADIUS`, connection is removed

### 4) Chat system
- On proximity connect, backend places the pair into a deterministic room (`room:userA:userB`)
- Chat panel activates automatically when nearby users exist
- On moving away, room membership is removed and chat input is disabled

### 5) UI/UX
- Left pane: virtual space and active connection cards
- Right pane: chat panel (similar structure to your sample screenshot)
- Clear connection status badge

---

## Project structure

```text
virtual-cosmos/
  frontend/   # React + Pixi client
  backend/    # Express + Socket.IO server
```

## Backend events

- `join-cosmos`: register user (`userId`, `position`, `avatar`, `username`)
- `move-user`: update user position
- `proximity-update`: tell each client who is nearby
- `world-state`: broadcast all users and positions
- `chat-message`: room-based message emit

## Proximity algorithm

- Evaluate every pair of users
- Build active pair set for this tick
- Compare with previous active set:
  - newly active pair -> both sockets `join(roomId)`
  - no longer active pair -> both sockets `leave(roomId)`
- Send each user their sorted nearby list (nearest first)

---

## Run locally

### Prerequisites
- Node.js 20+

### 1) Start backend

```bash
cd backend
npm install
npm run dev
```

Backend runs on `http://localhost:4000`

### 2) Start frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`

---

## Configuration

Backend supports environment variables:

- `PORT` (default: `4000`)
- `FRONTEND_ORIGIN` (default: `http://localhost:5173`)

---

## Notes about MongoDB

This assignment implementation keeps active session state in-memory for simplicity and faster local setup.
If you want MongoDB persistence, add:

- `users` collection for profile/session metadata
- optional `messages` collection for chat history replay after reconnect

Current architecture already isolates the socket/session logic, so persistence can be added without changing the client protocol.
