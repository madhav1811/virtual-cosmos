const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 4000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
const WORLD_WIDTH = 1400;
const WORLD_HEIGHT = 900;
const PROXIMITY_RADIUS = 170;

const app = express();
app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: FRONTEND_ORIGIN,
    methods: ["GET", "POST"],
  },
});

const users = new Map();
const activePairKeys = new Set();
const roomGames = new Map();

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const roomIdForPair = (firstUserId, secondUserId) => {
  const [a, b] = [firstUserId, secondUserId].sort();
  return `room:${a}:${b}`;
};

const pairKey = (firstUserId, secondUserId) => {
  const [a, b] = [firstUserId, secondUserId].sort();
  return `${a}|${b}`;
};

const distanceBetween = (a, b) => {
  const dx = a.position.x - b.position.x;
  const dy = a.position.y - b.position.y;
  return Math.sqrt(dx * dx + dy * dy);
};

const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

const createEmptyBoard = () => Array(9).fill(null);

const buildTicTacToeState = (roomId, firstUserId, secondUserId) => ({
  roomId,
  board: createEmptyBoard(),
  xPlayerId: firstUserId,
  oPlayerId: secondUserId,
  nextTurnUserId: firstUserId,
  winner: null,
  isDraw: false,
});

const getValidRoomContext = (senderId, roomId) => {
  if (!roomId) return null;
  const roomUserIds = roomId.replace("room:", "").split(":");
  if (roomUserIds.length !== 2) return null;
  if (!roomUserIds.includes(senderId)) return null;
  const [firstUserId, secondUserId] = roomUserIds;
  const expectedRoom = roomIdForPair(firstUserId, secondUserId);
  const key = pairKey(firstUserId, secondUserId);
  if (expectedRoom !== roomId || !activePairKeys.has(key)) return null;
  return { firstUserId, secondUserId, key };
};

function emitWorldState() {
  const userList = [...users.values()].map((user) => ({
    userId: user.userId,
    username: user.username,
    avatarColor: user.avatarColor,
    position: user.position,
    activeConnections: [...user.activeConnections],
  }));

  io.emit("world-state", {
    users: userList,
    world: {
      width: WORLD_WIDTH,
      height: WORLD_HEIGHT,
      proximityRadius: PROXIMITY_RADIUS,
    },
  });
}

function recomputeProximity() {
  const userArray = [...users.values()];
  const nextPairKeys = new Set();
  const connectionsByUser = new Map();

  userArray.forEach((user) => connectionsByUser.set(user.userId, []));

  for (let i = 0; i < userArray.length; i += 1) {
    for (let j = i + 1; j < userArray.length; j += 1) {
      const first = userArray[i];
      const second = userArray[j];
      const distance = distanceBetween(first, second);

      if (distance < PROXIMITY_RADIUS) {
        const roomId = roomIdForPair(first.userId, second.userId);
        const key = pairKey(first.userId, second.userId);
        nextPairKeys.add(key);

        connectionsByUser.get(first.userId).push({
          userId: second.userId,
          username: second.username,
          avatarColor: second.avatarColor,
          distance: Math.round(distance),
          roomId,
        });
        connectionsByUser.get(second.userId).push({
          userId: first.userId,
          username: first.username,
          avatarColor: first.avatarColor,
          distance: Math.round(distance),
          roomId,
        });

        if (!activePairKeys.has(key)) {
          first.socket.join(roomId);
          second.socket.join(roomId);
        }
      }
    }
  }

  for (const key of activePairKeys) {
    if (!nextPairKeys.has(key)) {
      const [firstUserId, secondUserId] = key.split("|");
      const roomId = roomIdForPair(firstUserId, secondUserId);
      const first = users.get(firstUserId);
      const second = users.get(secondUserId);
      if (first) first.socket.leave(roomId);
      if (second) second.socket.leave(roomId);
      roomGames.delete(roomId);
    }
  }

  activePairKeys.clear();
  nextPairKeys.forEach((key) => activePairKeys.add(key));

  userArray.forEach((user) => {
    const nearby = (connectionsByUser.get(user.userId) || []).sort(
      (a, b) => a.distance - b.distance
    );
    user.activeConnections = nearby.map((connection) => connection.userId);
    user.socket.emit("proximity-update", {
      nearby,
      canChat: nearby.length > 0,
    });
  });

  emitWorldState();
}

app.get("/health", (_, res) => {
  res.json({ ok: true, users: users.size });
});

io.on("connection", (socket) => {
  socket.on("join-cosmos", (payload) => {
    const username = (payload?.username || "").trim().slice(0, 24) || "Explorer";
    const avatarColor = payload?.avatarColor || "#7C3AED";
    const initialX =
      typeof payload?.position?.x === "number" ? payload.position.x : 200 + Math.random() * 800;
    const initialY =
      typeof payload?.position?.y === "number" ? payload.position.y : 150 + Math.random() * 550;

    users.set(socket.id, {
      userId: socket.id,
      username,
      avatarColor,
      position: {
        x: clamp(initialX, 0, WORLD_WIDTH),
        y: clamp(initialY, 0, WORLD_HEIGHT),
      },
      socket,
      activeConnections: [],
    });

    recomputeProximity();
  });

  socket.on("move-user", (payload) => {
    const user = users.get(socket.id);
    if (!user) return;

    const nextX = typeof payload?.x === "number" ? payload.x : user.position.x;
    const nextY = typeof payload?.y === "number" ? payload.y : user.position.y;

    user.position = {
      x: clamp(nextX, 0, WORLD_WIDTH),
      y: clamp(nextY, 0, WORLD_HEIGHT),
    };

    recomputeProximity();
  });

  socket.on("chat-message", (payload) => {
    const sender = users.get(socket.id);
    if (!sender) return;

    const roomId = payload?.roomId;
    const text = (payload?.text || "").trim().slice(0, 240);
    if (!roomId || !text) return;
    const roomContext = getValidRoomContext(sender.userId, roomId);
    if (!roomContext) return;

    io.to(roomId).emit("chat-message", {
      roomId,
      senderId: sender.userId,
      senderName: sender.username,
      text,
      createdAt: new Date().toISOString(),
    });
  });

  socket.on("ttt-start", (payload) => {
    const sender = users.get(socket.id);
    if (!sender) return;
    const roomId = payload?.roomId;
    const roomContext = getValidRoomContext(sender.userId, roomId);
    if (!roomContext) return;

    const nextState = buildTicTacToeState(roomId, roomContext.firstUserId, roomContext.secondUserId);
    roomGames.set(roomId, nextState);
    io.to(roomId).emit("ttt-state", nextState);
  });

  socket.on("ttt-reset", (payload) => {
    const sender = users.get(socket.id);
    if (!sender) return;
    const roomId = payload?.roomId;
    const roomContext = getValidRoomContext(sender.userId, roomId);
    if (!roomContext) return;

    const nextState = buildTicTacToeState(roomId, roomContext.firstUserId, roomContext.secondUserId);
    roomGames.set(roomId, nextState);
    io.to(roomId).emit("ttt-state", nextState);
  });

  socket.on("ttt-move", (payload) => {
    const sender = users.get(socket.id);
    if (!sender) return;

    const roomId = payload?.roomId;
    const index = payload?.index;
    if (typeof index !== "number" || index < 0 || index > 8) return;

    const roomContext = getValidRoomContext(sender.userId, roomId);
    if (!roomContext) return;

    let game = roomGames.get(roomId);
    if (!game) {
      game = buildTicTacToeState(roomId, roomContext.firstUserId, roomContext.secondUserId);
    }
    if (game.winner || game.isDraw) return;
    if (game.nextTurnUserId !== sender.userId) return;
    if (game.board[index]) return;

    const nextBoard = [...game.board];
    const symbol = sender.userId === game.xPlayerId ? "X" : "O";
    nextBoard[index] = symbol;

    let winner = null;
    for (const [a, b, c] of WIN_LINES) {
      if (nextBoard[a] && nextBoard[a] === nextBoard[b] && nextBoard[a] === nextBoard[c]) {
        winner = nextBoard[a];
        break;
      }
    }
    const isDraw = !winner && nextBoard.every(Boolean);

    const nextState = {
      ...game,
      board: nextBoard,
      winner,
      isDraw,
      nextTurnUserId: winner || isDraw ? null : sender.userId === game.xPlayerId ? game.oPlayerId : game.xPlayerId,
    };

    roomGames.set(roomId, nextState);
    io.to(roomId).emit("ttt-state", nextState);
  });

  socket.on("disconnect", () => {
    users.delete(socket.id);
    recomputeProximity();
  });
});

server.listen(PORT, () => {
  console.log(`Virtual Cosmos backend running on http://localhost:${PORT}`);
});
