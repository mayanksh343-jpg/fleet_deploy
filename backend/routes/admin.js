const express = require("express");
const router = express.Router();
const db = require("../db");
const bcrypt = require("bcryptjs");
const { requireSuperAdmin } = require("../middleware/auth");

// All routes require Super Admin
router.use(requireSuperAdmin);

// ──────────────────────────────────────────────────
// GET /admin/stats — System-wide admin overview
// ──────────────────────────────────────────────────
router.get("/stats", (req, res) => {
  const totalUsers = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;

  const roleBreakdown = db.prepare(`
    SELECT role, COUNT(*) AS count FROM users GROUP BY role ORDER BY count DESC
  `).all();

  const recentUsers = db.prepare(`
    SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC LIMIT 5
  `).all();

  const totalPermissions = db.prepare("SELECT COUNT(*) AS count FROM permissions").get().count;

  res.json({
    total_users: totalUsers,
    total_permissions: totalPermissions,
    role_breakdown: roleBreakdown,
    recent_users: recentUsers,
  });
});

// ──────────────────────────────────────────────────
// GET /admin/users — List all users
// ──────────────────────────────────────────────────
router.get("/users", (req, res) => {
  const users = db.prepare(`
    SELECT id, name, email, role, created_at FROM users ORDER BY id ASC
  `).all();
  res.json(users);
});

// ──────────────────────────────────────────────────
// PUT /admin/users/:id/role — Change user role
// ──────────────────────────────────────────────────
router.put("/users/:id/role", (req, res) => {
  const { role } = req.body;
  const userId = req.params.id;

  if (!role) {
    return res.status(400).json({ error: "Role is required" });
  }

  const VALID_ROLES = ["Super Admin", "Manager", "Dispatcher", "Safety Officer", "Financial Analyst", "Driver"];
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: `Role must be one of: ${VALID_ROLES.join(", ")}` });
  }

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  // Prevent demoting yourself
  if (parseInt(userId) === req.user.id && role !== "Super Admin") {
    return res.status(400).json({ error: "Cannot change your own role" });
  }

  db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, userId);

  const updated = db.prepare("SELECT id, name, email, role, created_at FROM users WHERE id = ?").get(userId);
  res.json({ message: "Role updated successfully", user: updated });
});

// ──────────────────────────────────────────────────
// POST /admin/users — Create a user (including Super Admin)
// ──────────────────────────────────────────────────
router.post("/users", (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: "Name, email, password, and role are required" });
  }

  const VALID_ROLES = ["Super Admin", "Manager", "Dispatcher", "Safety Officer", "Financial Analyst", "Driver"];
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: `Role must be one of: ${VALID_ROLES.join(", ")}` });
  }

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) {
    return res.status(409).json({ error: "Email already registered" });
  }

  const salt = bcrypt.genSaltSync(10);
  const password_hash = bcrypt.hashSync(password, salt);

  const result = db.prepare(
    "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)"
  ).run(name, email, password_hash, role);

  const user = db.prepare("SELECT id, name, email, role, created_at FROM users WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json({ message: "User created successfully", user });
});

// ──────────────────────────────────────────────────
// DELETE /admin/users/:id — Delete a user
// ──────────────────────────────────────────────────
router.delete("/users/:id", (req, res) => {
  const userId = req.params.id;

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  // Prevent deleting yourself
  if (parseInt(userId) === req.user.id) {
    return res.status(400).json({ error: "Cannot delete your own account" });
  }

  // Clean up related permissions
  db.prepare("DELETE FROM permissions WHERE user_id = ?").run(userId);
  db.prepare("DELETE FROM users WHERE id = ?").run(userId);

  res.json({ message: "User deleted successfully" });
});

// ──────────────────────────────────────────────────
// GET /admin/users/:id/permissions — List user permissions
// ──────────────────────────────────────────────────
router.get("/users/:id/permissions", (req, res) => {
  const userId = req.params.id;

  const user = db.prepare("SELECT id, name, email, role FROM users WHERE id = ?").get(userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const permissions = db.prepare(`
    SELECT p.id, p.permission, p.created_at, u.name AS granted_by_name
    FROM permissions p
    LEFT JOIN users u ON p.granted_by = u.id
    WHERE p.user_id = ?
    ORDER BY p.created_at DESC
  `).all(userId);

  res.json({ user, permissions });
});

// ──────────────────────────────────────────────────
// POST /admin/users/:id/permissions — Grant permission
// ──────────────────────────────────────────────────
router.post("/users/:id/permissions", (req, res) => {
  const userId = req.params.id;
  const { permission } = req.body;

  if (!permission) {
    return res.status(400).json({ error: "Permission name is required" });
  }

  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  // Check if already granted
  const existing = db.prepare("SELECT id FROM permissions WHERE user_id = ? AND permission = ?").get(userId, permission);
  if (existing) {
    return res.status(409).json({ error: "Permission already granted" });
  }

  const result = db.prepare(
    "INSERT INTO permissions (user_id, permission, granted_by) VALUES (?, ?, ?)"
  ).run(userId, permission, req.user.id);

  const perm = db.prepare(`
    SELECT p.id, p.permission, p.created_at, u.name AS granted_by_name
    FROM permissions p
    LEFT JOIN users u ON p.granted_by = u.id
    WHERE p.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json({ message: "Permission granted", permission: perm });
});

// ──────────────────────────────────────────────────
// DELETE /admin/users/:id/permissions/:permId — Revoke permission
// ──────────────────────────────────────────────────
router.delete("/users/:id/permissions/:permId", (req, res) => {
  const { id: userId, permId } = req.params;

  const perm = db.prepare("SELECT * FROM permissions WHERE id = ? AND user_id = ?").get(permId, userId);
  if (!perm) {
    return res.status(404).json({ error: "Permission not found" });
  }

  db.prepare("DELETE FROM permissions WHERE id = ?").run(permId);
  res.json({ message: "Permission revoked" });
});

module.exports = router;
