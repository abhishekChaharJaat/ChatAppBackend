const WebSocket = require("ws");
const Message = require("../models/Message");
const clerk = require("../config/clerk");

const clients = new Map(); // userId -> WebSocket

// Function to broadcast online status to all connected clients
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
  const wss = new WebSocket.Server({ server });

  wss.on("connection", (ws, req) => {
    // Get userId from query parameters
    const url = new URL(req.url, "ws://localhost");
    const userId = url.searchParams.get("userId");

    if (!userId) {
      ws.close(1008, "User ID is required");
      return;
    }

    // Store the WebSocket connection with the user ID
    clients.set(userId, ws);
    ws.userId = userId;
    console.log(`User ${userId} connected`);

    // Broadcast that this user is now online
    broadcastOnlineStatus();

    // Handle incoming messages
    ws.on("message", async (message) => {
      try {
        const messageData = JSON.parse(message);
        console.log(messageData);

        // Handle chat message
        const { senderId, recipientId, content } = messageData;

        const sender = await clerk.users.getUser(senderId);

        const newMessage = new Message({
          senderId,
          senderName: `${sender.firstName || ""} ${
            sender.lastName || ""
          }`.trim(),
          recipientId,
          content,
        });

        await newMessage.save();

        // Forward message to recipient if connected
        const recipientMessage = JSON.stringify({
          type: "new_message",
          senderId,
          senderName: `${sender.firstName || ""} ${
            sender.lastName || ""
          }`.trim(),
          content,
          timestamp: newMessage.timestamp,
        });
        const recipientWs = clients.get(recipientId);
        if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
          recipientWs.send(recipientMessage);
        }
      } catch (err) {
        console.error("WebSocket message error:", err);
        ws.send(
          JSON.stringify({ error: "Invalid message format or server error" })
        );
      }
    });

    // Handle disconnects and cleanup
    ws.on("close", () => {
      if (ws.userId) {
        clients.delete(ws.userId);
        console.log(`User ${ws.userId} disconnected`);
        // Broadcast that this user is now offline
        broadcastOnlineStatus();
      }
    });
  });

  return wss;
}

module.exports = initializeWebSocket;
