const express = require("express");
const { requireAuth } = require("@clerk/express");
const clerk = require("../config/clerk");

const router = express.Router();

// Protected route to fetch Clerk users
router.get("/all-users", requireAuth(), async (req, res) => {
  try {
    const currentUserId = req.auth.userId;
    const users = await clerk.users.getUserList();
    const formattedUsers = users
      .filter((user) => user.id !== currentUserId)
      .map((user) => ({
        id: user.id,
        fullName: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        imageUrl: user.imageUrl,
      }));
    res.status(200).json(formattedUsers);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

module.exports = router;
