import { useEffect, useMemo, useRef, useState } from "react";
import { Application, Container, Graphics, Text } from "pixi.js";
import { io } from "socket.io-client";

const WORLD_WIDTH = 1400;
const WORLD_HEIGHT = 900;
const SOCKET_URL = "http://localhost:4000";

const randomColor = () => {
  const colors = ["#22d3ee", "#f97316", "#a78bfa", "#34d399", "#f43f5e", "#facc15"];
  return colors[Math.floor(Math.random() * colors.length)];
};

const hashString = (value) =>
  [...value].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) % 2147483647, 7);

const shadeHex = (hex, amount) => {
  const normalized = hex.replace("#", "");
  const raw = Number.parseInt(normalized, 16);
  const r = Math.max(0, Math.min(255, ((raw >> 16) & 0xff) + amount));
  const g = Math.max(0, Math.min(255, ((raw >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, (raw & 0xff) + amount));
  return (r << 16) + (g << 8) + b;
};

const drawOfficeEnvironment = (worldLayer) => {
  const floorGrid = new Graphics();
  floorGrid.rect(0, 0, WORLD_WIDTH, WORLD_HEIGHT).fill(0xece6d9);
  for (let x = 0; x < WORLD_WIDTH; x += 56) {
    floorGrid.moveTo(x, 0).lineTo(x, WORLD_HEIGHT).stroke({ width: 1, color: 0xffffff, alpha: 0.2 });
  }
  for (let y = 0; y < WORLD_HEIGHT; y += 56) {
    floorGrid.moveTo(0, y).lineTo(WORLD_WIDTH, y).stroke({ width: 1, color: 0xffffff, alpha: 0.2 });
  }
  worldLayer.addChild(floorGrid);

  const addDesk = (x, y, width, height) => {
    const desk = new Graphics();
    desk.roundRect(x, y, width, height, 12).fill(0xcaa57a);
    desk.roundRect(x + 8, y + 8, width - 16, height - 16, 10).fill(0xb58c60);
    desk.roundRect(x + width * 0.18, y + 10, width * 0.28, 16, 4).fill(0x1f2937);
    desk.roundRect(x + width * 0.54, y + 10, width * 0.28, 16, 4).fill(0x111827);
    worldLayer.addChild(desk);
  };

  addDesk(60, 72, 240, 100);
  addDesk(340, 72, 240, 100);
  addDesk(620, 72, 240, 100);
  addDesk(900, 72, 240, 100);
  addDesk(1180, 72, 180, 100);

  addDesk(90, 760, 240, 90);
  addDesk(380, 760, 240, 90);
  addDesk(670, 760, 240, 90);
  addDesk(960, 760, 240, 90);

  const meetingTable = new Graphics();
  meetingTable.roundRect(460, 330, 480, 220, 24).fill(0xd4b38b);
  meetingTable.roundRect(476, 346, 448, 188, 20).fill(0xc39a70);
  worldLayer.addChild(meetingTable);

  const chairs = [
    [520, 300],
    [630, 300],
    [740, 300],
    [850, 300],
    [520, 570],
    [630, 570],
    [740, 570],
    [850, 570],
  ];
  chairs.forEach(([x, y]) => {
    const chair = new Graphics();
    chair.roundRect(x, y, 60, 24, 8).fill(0x334155);
    chair.roundRect(x + 6, y + 24, 48, 8, 4).fill(0x1e293b);
    worldLayer.addChild(chair);
  });

  const glassRoom = new Graphics();
  glassRoom.roundRect(34, 324, 310, 260, 14).stroke({ width: 4, color: 0x94a3b8, alpha: 0.65 });
  glassRoom.roundRect(38, 328, 302, 252, 12).fill({ color: 0xb6d4ee, alpha: 0.12 });
  worldLayer.addChild(glassRoom);
};

const createAvatarVisual = (user, isLocal) => {
  const container = new Container();
  const seed = hashString(user.userId || user.username || "avatar");
  const baseColor = shadeHex(user.avatarColor || "#7C3AED", 0);
  const accentColor = shadeHex(user.avatarColor || "#7C3AED", 36);
  const darkColor = shadeHex(user.avatarColor || "#7C3AED", -48);

  const glow = new Graphics();
  glow.circle(0, 2, 23).fill({ color: isLocal ? 0xffffff : 0x93c5fd, alpha: isLocal ? 0.2 : 0.1 });
  container.addChild(glow);

  const torso = new Graphics();
  torso.roundRect(-12, 2, 24, 22, 9).fill(baseColor);
  torso.roundRect(-10, 5, 20, 8, 6).fill(accentColor);
  container.addChild(torso);

  const neck = new Graphics();
  neck.roundRect(-4, -4, 8, 8, 3).fill(0xf1c8a7);
  container.addChild(neck);

  const head = new Graphics();
  head.circle(0, -12, 12).fill(0xf4d3b2);
  container.addChild(head);

  const hair = new Graphics();
  const hairStyle = seed % 3;
  if (hairStyle === 0) {
    hair.ellipse(0, -17, 12, 7).fill(darkColor);
  } else if (hairStyle === 1) {
    hair.roundRect(-12, -24, 24, 10, 5).fill(darkColor);
  } else {
    hair.circle(0, -18, 10).fill(darkColor);
  }
  container.addChild(hair);

  const glasses = new Graphics();
  if (seed % 2 === 0) {
    glasses.roundRect(-9, -14, 8, 5, 2).stroke({ width: 1.5, color: 0x111827 });
    glasses.roundRect(1, -14, 8, 5, 2).stroke({ width: 1.5, color: 0x111827 });
    glasses.moveTo(-1, -12).lineTo(1, -12).stroke({ width: 1.2, color: 0x111827 });
    container.addChild(glasses);
  }

  const device = new Graphics();
  device.roundRect(10, 3, 10, 15, 3).fill(0x0f172a);
  device.roundRect(12, 5, 6, 8, 2).fill(0x22d3ee);
  container.addChild(device);

  const ring = new Graphics();
  ring.circle(0, 0, 26).stroke({ width: 2, color: isLocal ? 0xffffff : 0x60a5fa, alpha: 0.8 });
  container.addChild(ring);

  const label = new Text({
    text: user.username,
    style: {
      fill: isLocal ? "#0f172a" : "#1f2937",
      fontSize: 12,
      fontWeight: "700",
    },
  });
  label.anchor.set(0.5);
  label.y = -35;
  container.addChild(label);

  return { container, label };
};

function App() {
  const stageRef = useRef(null);
  const appRef = useRef(null);
  const pixiCleanupRef = useRef(() => {});
  const socketRef = useRef(null);
  const keyStateRef = useRef({});
  const zoomRef = useRef(1);
  const cameraRef = useRef({ x: 0, y: 0 });
  const worldUsersRef = useRef([]);
  const localStateRef = useRef({
    userId: null,
    position: { x: 260, y: 220 },
  });
  const userSpritesRef = useRef(new Map());
  const chatRoomInputRef = useRef("");

  const [username] = useState(`Explorer-${Math.floor(100 + Math.random() * 900)}`);
  const [avatarColor] = useState(randomColor);
  const [nearbyUsers, setNearbyUsers] = useState([]);
  const [messagesByRoom, setMessagesByRoom] = useState({});
  const [gamesByRoom, setGamesByRoom] = useState({});
  const [visibleGamesByRoom, setVisibleGamesByRoom] = useState({});
  const [message, setMessage] = useState("");
  const [connected, setConnected] = useState(false);

  const activeChat = nearbyUsers[0] || null;
  const activeRoomId = activeChat?.roomId || null;
  const activeMessages = activeRoomId ? messagesByRoom[activeRoomId] || [] : [];
  const activeGame = activeRoomId ? gamesByRoom[activeRoomId] || null : null;
  const isGameVisible = activeRoomId ? Boolean(visibleGamesByRoom[activeRoomId]) : false;

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      localStateRef.current.userId = socket.id;
      socket.emit("join-cosmos", {
        username,
        avatarColor,
        position: localStateRef.current.position,
      });
    });

    socket.on("disconnect", () => setConnected(false));

    socket.on("world-state", (payload) => {
      const users = payload.users || [];
      worldUsersRef.current = users;
    });

    socket.on("proximity-update", (payload) => {
      const nextNearby = payload.nearby || [];
      setNearbyUsers(nextNearby);
      if (!nextNearby.find((user) => user.roomId === chatRoomInputRef.current)) {
        setMessage("");
      }
    });

    socket.on("chat-message", (payload) => {
      if (!payload?.roomId) return;
      setMessagesByRoom((prev) => {
        const roomMessages = prev[payload.roomId] || [];
        return {
          ...prev,
          [payload.roomId]: [...roomMessages, payload].slice(-100),
        };
      });
    });

    socket.on("ttt-state", (payload) => {
      if (!payload?.roomId) return;
      setGamesByRoom((prev) => ({
        ...prev,
        [payload.roomId]: payload,
      }));
      setVisibleGamesByRoom((prev) => ({
        ...prev,
        [payload.roomId]: true,
      }));
    });

    return () => {
      socket.disconnect();
    };
  }, [username, avatarColor]);

  useEffect(() => {
    if (!stageRef.current) return undefined;
    let mounted = true;
    const spritesMap = userSpritesRef.current;

    const initPixi = async () => {
      const app = new Application();
      await app.init({
        width: WORLD_WIDTH,
        height: WORLD_HEIGHT,
        antialias: true,
        backgroundColor: 0xf8eecf,
      });

      if (!mounted) {
        app.destroy(true);
        return;
      }

      stageRef.current.innerHTML = "";
      stageRef.current.appendChild(app.canvas);
      appRef.current = app;

      const resizeRendererToContainer = () => {
        const containerWidth = Math.max(520, stageRef.current?.clientWidth || WORLD_WIDTH);
        const containerHeight = Math.max(360, stageRef.current?.clientHeight || WORLD_HEIGHT);
        app.renderer.resize(containerWidth, containerHeight);
      };
      resizeRendererToContainer();

      const worldLayer = new Container();
      app.stage.addChild(worldLayer);
      drawOfficeEnvironment(worldLayer);

      const roomLabels = [
        { x: 88, y: 54, text: "Cubicle A" },
        { x: 368, y: 54, text: "Cubicle B" },
        { x: 648, y: 54, text: "Cubicle C" },
        { x: 928, y: 54, text: "Cubicle D" },
        { x: 1202, y: 54, text: "Cubicle E" },
        { x: 120, y: 742, text: "Cubicle F" },
        { x: 410, y: 742, text: "Cubicle G" },
        { x: 700, y: 742, text: "Cubicle H" },
        { x: 990, y: 742, text: "Cubicle I" },
        { x: 560, y: 364, text: "Brainstorming Arena" },
        { x: 72, y: 300, text: "CEO Room" },
      ];

      roomLabels.forEach((label) => {
        const badge = new Graphics();
        const badgeWidth = Math.max(106, label.text.length * 8.2);
        badge.roundRect(label.x - 12, label.y - 8, badgeWidth, 28, 7).fill(0x111827);
        const t = new Text({
          text: label.text,
          style: { fill: "#f8fafc", fontSize: 12, fontWeight: "600" },
        });
        t.x = label.x;
        t.y = label.y;
        worldLayer.addChild(badge);
        worldLayer.addChild(t);
      });

      const ticker = () => {
        const speed = 2.3;
        const keys = keyStateRef.current;
        let { x, y } = localStateRef.current.position;

        if (keys.w || keys.arrowup) y -= speed;
        if (keys.s || keys.arrowdown) y += speed;
        if (keys.a || keys.arrowleft) x -= speed;
        if (keys.d || keys.arrowright) x += speed;

        x = Math.max(10, Math.min(WORLD_WIDTH - 10, x));
        y = Math.max(10, Math.min(WORLD_HEIGHT - 10, y));

        const didMove = x !== localStateRef.current.position.x || y !== localStateRef.current.position.y;
        if (didMove) {
          localStateRef.current.position = { x, y };
          socketRef.current?.emit("move-user", { x, y });
        }

        const zoom = zoomRef.current;
        const viewportWidth = app.renderer.width;
        const viewportHeight = app.renderer.height;
        const halfWorldViewW = viewportWidth / (2 * zoom);
        const halfWorldViewH = viewportHeight / (2 * zoom);
        const clampedCameraX = Math.max(halfWorldViewW, Math.min(WORLD_WIDTH - halfWorldViewW, x));
        const clampedCameraY = Math.max(halfWorldViewH, Math.min(WORLD_HEIGHT - halfWorldViewH, y));
        cameraRef.current = { x: clampedCameraX, y: clampedCameraY };

        worldLayer.scale.set(zoom);
        worldLayer.position.set(
          viewportWidth / 2 - clampedCameraX * zoom,
          viewportHeight / 2 - clampedCameraY * zoom
        );

        const usersMap = new Map(worldUsersRef.current.map((user) => [user.userId, user]));
        usersMap.forEach((user) => {
          const isLocal = user.userId === localStateRef.current.userId;
          let sprite = spritesMap.get(user.userId);

          if (!sprite) {
            const { container, label } = createAvatarVisual(user, isLocal);
            worldLayer.addChild(container);
            sprite = { container, label };
            spritesMap.set(user.userId, sprite);
          }

          sprite.container.x = user.position.x;
          sprite.container.y = user.position.y;
          sprite.label.text = user.username;
        });

        [...spritesMap.keys()].forEach((userId) => {
          if (!usersMap.has(userId)) {
            const sprite = spritesMap.get(userId);
            if (sprite) worldLayer.removeChild(sprite.container);
            spritesMap.delete(userId);
          }
        });
      };

      app.ticker.add(ticker);

      const handleResize = () => resizeRendererToContainer();
      const handleWheel = (event) => {
        event.preventDefault();
        const zoomStep = event.deltaY > 0 ? -0.08 : 0.08;
        zoomRef.current = Math.max(0.7, Math.min(1.8, zoomRef.current + zoomStep));
      };
      const stageElement = stageRef.current;
      stageElement?.addEventListener("wheel", handleWheel, { passive: false });
      window.addEventListener("resize", handleResize);

      pixiCleanupRef.current = () => {
        stageElement?.removeEventListener("wheel", handleWheel);
        window.removeEventListener("resize", handleResize);
      };
    };

    initPixi();

    return () => {
      mounted = false;
      if (appRef.current) {
        pixiCleanupRef.current?.();
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
      spritesMap.clear();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      keyStateRef.current[event.key.toLowerCase()] = true;
    };
    const handleKeyUp = (event) => {
      keyStateRef.current[event.key.toLowerCase()] = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useEffect(() => {
    chatRoomInputRef.current = activeRoomId || "";
  }, [activeRoomId]);

  const sendMessage = () => {
    if (!activeRoomId || !message.trim()) return;
    socketRef.current?.emit("chat-message", {
      roomId: activeRoomId,
      text: message.trim(),
    });
    setMessage("");
  };

  const startTicTacToe = () => {
    if (!activeRoomId) return;
    socketRef.current?.emit("ttt-start", { roomId: activeRoomId });
    setVisibleGamesByRoom((prev) => ({ ...prev, [activeRoomId]: true }));
  };

  const toggleTicTacToe = () => {
    if (!activeRoomId || !activeChat) return;
    const isVisible = Boolean(visibleGamesByRoom[activeRoomId]);
    if (isVisible) {
      setVisibleGamesByRoom((prev) => ({ ...prev, [activeRoomId]: false }));
      return;
    }
    startTicTacToe();
  };

  const resetTicTacToe = () => {
    if (!activeRoomId) return;
    socketRef.current?.emit("ttt-reset", { roomId: activeRoomId });
  };

  const onTicTacToeMove = (index) => {
    if (!activeRoomId || !activeGame) return;
    socketRef.current?.emit("ttt-move", { roomId: activeRoomId, index });
  };

  const localUserId = localStateRef.current.userId;
  const localSymbol = !activeGame
    ? null
    : localUserId === activeGame.xPlayerId
      ? "X"
      : localUserId === activeGame.oPlayerId
        ? "O"
        : null;
  const gameStatusText = useMemo(() => {
    if (!activeGame) return "Click TIC TAC TOE to start.";
    if (activeGame.winner) return `Winner: ${activeGame.winner}`;
    if (activeGame.isDraw) return "Game ended in a draw.";
    if (!activeGame.nextTurnUserId) return "Waiting...";
    if (activeGame.nextTurnUserId === localUserId) {
      return `Your turn (${localSymbol || "-"})`;
    }
    return "Opponent's turn";
  }, [activeGame, localSymbol, localUserId]);

  const statusBadge = useMemo(() => {
    if (!connected) return "Connecting to Cosmos...";
    if (!activeChat) return "No nearby explorers";
    return `Connected to ${activeChat.username}`;
  }, [connected, activeChat]);

  return (
    <div className="h-screen w-full bg-slate-950 p-4 text-slate-100">
      <div className="mx-auto flex h-full max-w-[1650px] gap-4">
        <section className="relative flex h-full flex-1 flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900/70">
          <header className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
            <div>
              <h1 className="text-xl font-semibold">Virtual Cosmos</h1>
              <p className="text-xs text-slate-400">Move with WASD / Arrow keys to start proximity chat</p>
            </div>
            <div className="rounded-full bg-slate-800 px-3 py-1 text-xs">{statusBadge}</div>
          </header>

          <div className="border-b border-slate-700 px-4 py-3">
            <div className="vc-scrollbar flex gap-3 overflow-x-auto">
              {nearbyUsers.length === 0 && (
                <div className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-400">
                  Walk near another user to connect.
                </div>
              )}
              {nearbyUsers.map((user) => (
                <div
                  key={user.userId}
                  className="min-w-[180px] rounded-lg border border-blue-300/30 bg-slate-800 px-3 py-2"
                >
                  <div className="text-sm font-semibold">{user.username}</div>
                  <div className="text-xs text-slate-400">{user.distance}px away</div>
                </div>
              ))}
            </div>
          </div>

          <div ref={stageRef} className="vc-scrollbar flex-1 overflow-hidden bg-slate-950 p-2" />
        </section>

        <aside className="flex h-full w-[360px] flex-col rounded-xl border border-slate-700 bg-white text-slate-900">
          <div className="border-b px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Chat</h2>
              <button
                type="button"
                onClick={toggleTicTacToe}
                disabled={!activeChat}
                className={`rounded-md px-2 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300 ${
                  isGameVisible ? "bg-rose-600" : "bg-emerald-600"
                }`}
              >
                TIC TAC TOE {isGameVisible ? "OFF" : "ON"}
              </button>
            </div>
            {activeChat ? (
              <p className="text-sm text-slate-600">Live with @{activeChat.username}</p>
            ) : (
              <p className="text-sm text-slate-500">Move close to someone to unlock chat</p>
            )}
          </div>

          {isGameVisible && (
            <div className="border-b bg-slate-50 px-4 py-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-semibold text-slate-700">Tic Tac Toe</div>
                <button
                  type="button"
                  onClick={resetTicTacToe}
                  disabled={!activeGame}
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Reset
                </button>
              </div>
              <div className="mb-2 text-xs text-slate-600">{gameStatusText}</div>
              <div className="grid grid-cols-3 gap-2">
                {(activeGame?.board || Array(9).fill(null)).map((cellValue, index) => {
                  const isDisabled =
                    !activeGame ||
                    Boolean(cellValue) ||
                    Boolean(activeGame.winner) ||
                    activeGame.isDraw ||
                    activeGame.nextTurnUserId !== localUserId;
                  return (
                    <button
                      type="button"
                      key={`ttt-cell-${index}`}
                      onClick={() => onTicTacToeMove(index)}
                      disabled={isDisabled}
                      className="h-12 rounded-md border border-slate-300 bg-white text-xl font-bold text-indigo-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      {cellValue || ""}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="vc-scrollbar flex-1 space-y-2 overflow-y-auto px-4 py-3">
            {activeMessages.length === 0 && (
              <p className="text-sm text-slate-500">
                {activeChat ? "No messages yet. Say hello!" : "This is the beginning of your chat history."}
              </p>
            )}
            {activeMessages.map((chat, idx) => {
              const mine = chat.senderId === localStateRef.current.userId;
              return (
                <div
                  key={`${chat.createdAt}-${idx}`}
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                    mine ? "ml-auto bg-indigo-600 text-white" : "bg-slate-100 text-slate-800"
                  }`}
                >
                  <div className="mb-1 text-xs opacity-80">{chat.senderName}</div>
                  <div>{chat.text}</div>
                </div>
              );
            })}
          </div>

          <div className="border-t px-3 py-3">
            <div className="flex items-center gap-2">
              <input
                value={message}
                disabled={!activeChat}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") sendMessage();
                }}
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-100"
                placeholder={activeChat ? "Message the group" : "Chat disabled until you connect"}
              />
              <button
                type="button"
                onClick={sendMessage}
                disabled={!activeChat || !message.trim()}
                className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Send
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default App;
