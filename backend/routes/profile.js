const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const db = require("../db");
const { BCRYPT_ROUNDS } = require("../middleware/config");

// ── GET /profile — Get current user's full profile ──────
router.get("/", (req, res) => {
  const user = db.prepare(`
    SELECT id, name, email, role, phone, avatar_url, address,
           timezone, notifications_enabled, theme_preference,
           created_at, updated_at
    FROM users WHERE id = ?
  `).get(req.user.id);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json({ profile: user });
});

// ── PUT /profile — Update profile info ──────────────────
router.put("/", (req, res) => {
  const { name, phone, address, timezone, notifications_enabled, theme_preference } = req.body;

  // Build dynamic update
  const fields = [];
  const values = [];

  if (name !== undefined) {
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: "Name must be at least 2 characters" });
    }
    fields.push("name = ?");
    values.push(name.trim());
  }
  if (phone !== undefined) {
    fields.push("phone = ?");
    values.push(phone || null);
  }
  if (address !== undefined) {
    fields.push("address = ?");
    values.push(address || null);
  }
  if (timezone !== undefined) {
    fields.push("timezone = ?");
    values.push(timezone);
  }
  if (notifications_enabled !== undefined) {
    fields.push("notifications_enabled = ?");
    values.push(notifications_enabled ? 1 : 0);
  }
  if (theme_preference !== undefined) {
    if (!["dark", "light", "system"].includes(theme_preference)) {
      return res.status(400).json({ error: "Theme must be 'dark', 'light', or 'system'" });
    }
    fields.push("theme_preference = ?");
    values.push(theme_preference);
  }

  if (fields.length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }

  fields.push("updated_at = datetime('now')");
  values.push(req.user.id);

  db.prepare(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`).run(...values);

  const user = db.prepare(`
    SELECT id, name, email, role, phone, avatar_url, address,
           timezone, notifications_enabled, theme_preference,
           created_at, updated_at
    FROM users WHERE id = ?
  `).get(req.user.id);

  res.json({ profile: user, message: "Profile updated successfully" });
});

// ── PUT /profile/password — Change password ─────────────
router.put("/password", (req, res) => {
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    return res.status(400).json({ error: "Current password and new password are required" });
  }

  if (new_password.length < 6) {
    return res.status(400).json({ error: "New password must be at least 6 characters" });
  }

  if (current_password === new_password) {
    return res.status(400).json({ error: "New password must be different from current password" });
  }

  // Verify current password
  const user = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const valid = bcrypt.compareSync(current_password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: "Current password is incorrect" });
  }

  // Hash and save new password
  const salt = bcrypt.genSaltSync(BCRYPT_ROUNDS);
  const newHash = bcrypt.hashSync(new_password, salt);

  db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(newHash, req.user.id);

  res.json({ message: "Password changed successfully" });
});

// ── PUT /profile/avatar — Update avatar URL ─────────────
router.put("/avatar", (req, res) => {
  const { avatar_url } = req.body;

  if (avatar_url !== undefined && avatar_url !== null && typeof avatar_url !== "string") {
    return res.status(400).json({ error: "avatar_url must be a string or null" });
  }

  db.prepare("UPDATE users SET avatar_url = ?, updated_at = datetime('now') WHERE id = ?").run(avatar_url || null, req.user.id);

  const user = db.prepare(`
    SELECT id, name, email, role, phone, avatar_url, address,
           timezone, notifications_enabled, theme_preference,
           created_at, updated_at
    FROM users WHERE id = ?
  `).get(req.user.id);

  res.json({ profile: user, message: "Avatar updated successfully" });
});

module.exports = router;
