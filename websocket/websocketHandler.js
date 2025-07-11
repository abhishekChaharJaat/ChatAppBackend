const WebSocket = require("ws");
const Message = require("../models/Message");
const clerk = require("../config/clerk");

const clients = new Map();

function broadcastOnlineStatus() {
  const message = JSON.stringify({
    type: "active_status",
    users: Array.from(clients.keys()),
  });

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function initializeWebSocket(server) {
  const wss = new WebSocket.Server({ server, path: "/ws" });

  wss.on("connection", async (ws, req) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const userId = url.searchParams.get("userId");

      if (!userId) {
        ws.close(1008, "User ID is required");
        return;
      }

      clients.set(userId, ws);
      ws.userId = userId;
      console.log(`✅ User ${userId} connected`);

      broadcastOnlineStatus();

      ws.on("message", async (message) => {
        try {
          const { senderId, recipientId, content } = JSON.parse(message);
          const sender = await clerk.users.getUser(senderId);
          const senderName = `${sender.firstName || ""} ${
            sender.lastName || ""
          }`.trim();

          const newMessage = new Message({
            senderId,
            senderName,
            recipientId,
            content,
          });

          await newMessage.save();

          const recipientWs = clients.get(recipientId);
          if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
            recipientWs.send(
              JSON.stringify({
                type: "new_message",
                senderId,
                senderName,
                content,
                timestamp: newMessage.timestamp,
              })
            );
          }
        } catch (err) {
          console.error("❌ WebSocket message error:", err);
          ws.send(JSON.stringify({ error: "Message error" }));
        }
      });

      ws.on("close", () => {
        clients.delete(ws.userId);
        console.log(`❌ User ${ws.userId} disconnected`);
        broadcastOnlineStatus();
      });
    } catch (err) {
      console.error("❌ WebSocket connection error:", err);
      ws.close(1011, "Server error");
    }
  });

  return wss;
}

module.exports = initializeWebSocket;
