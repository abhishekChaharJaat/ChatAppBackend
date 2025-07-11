const express = require("express");
const { requireAuth } = require("@clerk/express");
const Message = require("../models/Message");

const router = express.Router();

// Protected route to get messages
router.post("/list-messages", requireAuth(), async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { recipientId } = req.body;

    if (!recipientId) {
      return res.status(400).json({ error: "Recipient ID is required" });
    }

    const messages = await Message.find({
      $or: [
        { senderId: userId, recipientId: recipientId },
        { senderId: recipientId, recipientId: userId },
      ],
    }).sort({ timestamp: 1 });

    res.status(200).json(messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

module.exports = router;
