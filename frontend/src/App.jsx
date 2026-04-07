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

function App() {
  const stageRef = useRef(null);
  const appRef = useRef(null);
  const socketRef = useRef(null);
  const keyStateRef = useRef({});
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
  const [message, setMessage] = useState("");
  const [connected, setConnected] = useState(false);

  const activeChat = nearbyUsers[0] || null;
  const activeRoomId = activeChat?.roomId || null;
  const activeMessages = activeRoomId ? messagesByRoom[activeRoomId] || [] : [];

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
        backgroundColor: 0x020617,
      });

      if (!mounted) {
        app.destroy(true);
        return;
      }

      stageRef.current.innerHTML = "";
      stageRef.current.appendChild(app.canvas);
      appRef.current = app;

      const worldLayer = new Container();
      app.stage.addChild(worldLayer);

      const floor = new Graphics();
      floor.rect(0, 0, WORLD_WIDTH, WORLD_HEIGHT).fill(0x020617);
      worldLayer.addChild(floor);

      const grid = new Graphics();
      grid.stroke({ width: 1, color: 0x0f172a, alpha: 0.8 });
      const gridSize = 40;
      for (let x = 0; x <= WORLD_WIDTH; x += gridSize) {
        grid.moveTo(x, 0).lineTo(x, WORLD_HEIGHT);
      }
      for (let y = 0; y <= WORLD_HEIGHT; y += gridSize) {
        grid.moveTo(0, y).lineTo(WORLD_WIDTH, y);
      }
      worldLayer.addChild(grid);

      const zones = new Graphics();
      zones.roundRect(40, 40, 520, 280, 18).fill(0x0f172a);
      zones.roundRect(620, 40, 580, 280, 18).fill(0x020617).stroke({ width: 2, color: 0x1d4ed8, alpha: 0.8 });
      zones.roundRect(40, 360, 1160, 500, 26).fill(0x020617).stroke({ width: 2, color: 0x334155, alpha: 0.9 });
      worldLayer.addChild(zones);

      const desksLayer = new Graphics();
      const drawDesk = (x, y, width = 120, height = 48) => {
        desksLayer.roundRect(x, y, width, height, 10).fill(0x1e293b).stroke({ width: 2, color: 0x0f172a });
      };

      [
        [80, 80],
        [80, 150],
        [210, 80],
        [210, 150],
        [340, 80],
        [340, 150],
        [720, 80],
        [720, 150],
        [860, 80],
        [860, 150],
        [1000, 80],
        [1000, 150],
      ].forEach(([x, y]) => drawDesk(x, y));

      [
        [120, 420],
        [120, 520],
        [120, 620],
        [120, 720],
        [360, 420],
        [360, 520],
        [360, 620],
        [360, 720],
        [640, 420],
        [640, 520],
        [640, 620],
        [640, 720],
        [920, 420],
        [920, 520],
        [920, 620],
        [920, 720],
      ].forEach(([x, y]) => drawDesk(x, y, 140, 52));

      worldLayer.addChild(desksLayer);

      const deco = new Graphics();
      deco.circle(1180, 120, 26).fill(0x22c55e);
      deco.circle(1180, 120, 34).stroke({ width: 3, color: 0x16a34a, alpha: 0.7 });
      deco.circle(1180, 260, 22).fill(0x38bdf8);
      deco.circle(1180, 260, 30).stroke({ width: 3, color: 0x0284c7, alpha: 0.7 });
      worldLayer.addChild(deco);

      const roomLabels = [
        { x: 80, y: 250, text: "Focus Pods" },
        { x: 660, y: 250, text: "Project War Room" },
        { x: 80, y: 380, text: "Collaboration Floor" },
      ];

      roomLabels.forEach((label) => {
        const badge = new Graphics();
        badge.roundRect(label.x - 18, label.y - 12, 200, 34, 999).fill(0x020617).stroke({
          width: 1.5,
          color: 0x64748b,
          alpha: 0.9,
        });
        const t = new Text({
          text: label.text,
          style: { fill: "#e5e7eb", fontSize: 14, fontWeight: "600" },
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

        const usersMap = new Map(worldUsersRef.current.map((user) => [user.userId, user]));
        usersMap.forEach((user) => {
          const isLocal = user.userId === localStateRef.current.userId;
          let sprite = spritesMap.get(user.userId);

          if (!sprite) {
            const container = new Container();

            const base = new Graphics();
            const colorHex = Number.parseInt(user.avatarColor.replace("#", ""), 16);
            base.roundRect(-18, -18, 36, 36, 10).fill(0x020617).stroke({
              width: 2,
              color: isLocal ? 0x22c55e : 0x475569,
            });
            container.addChild(base);

            const chip = new Graphics();
            chip.roundRect(-12, -12, 24, 24, 6).fill(colorHex);
            container.addChild(chip);

            const status = new Graphics();
            status.circle(20, -16, 5).fill(isLocal ? 0x22c55e : 0x64748b);
            container.addChild(status);

            const initials =
              typeof user.username === "string" && user.username.trim().length > 0
                ? user.username
                    .split(/\s+/)
                    .map((part) => part[0]?.toUpperCase())
                    .join("")
                    .slice(0, 3)
                : "NPC";

            const label = new Text({
              text: initials,
              style: {
                fill: "#020617",
                fontSize: 11,
                fontWeight: "700",
              },
            });
            label.anchor.set(0.5);
            container.addChild(label);

            const tag = new Text({
              text: user.username,
              style: {
                fill: "#e5e7eb",
                fontSize: 11,
                fontWeight: "500",
              },
            });
            tag.anchor.set(0, 0.5);
            tag.x = 26;
            tag.y = 0;
            container.addChild(tag);

            worldLayer.addChild(container);
            sprite = { container, base, chip, status, label, tag };
            spritesMap.set(user.userId, sprite);
          }

          sprite.container.x = user.position.x;
          sprite.container.y = user.position.y;
          sprite.tag.text = user.username;
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
    };

    initPixi();

    return () => {
      mounted = false;
      if (appRef.current) {
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
            <div className="flex gap-3 overflow-x-auto">
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

          <div ref={stageRef} className="flex-1 overflow-auto bg-slate-950 p-2" />
        </section>

        <aside className="flex h-full w-[360px] flex-col rounded-xl border border-slate-700 bg-white text-slate-900">
          <div className="border-b px-4 py-3">
            <h2 className="text-lg font-semibold">Chat</h2>
            {activeChat ? (
              <p className="text-sm text-slate-600">Live with @{activeChat.username}</p>
            ) : (
              <p className="text-sm text-slate-500">Move close to someone to unlock chat</p>
            )}
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
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
