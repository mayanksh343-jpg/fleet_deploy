const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const db = require("../db");
const {
  JWT_SECRET,
  REFRESH_TOKEN_SECRET,
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY_MS,
  BCRYPT_ROUNDS,
} = require("../middleware/config");

// ── Helpers ──────────────────────────────────────────────

function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    { id: user.id, type: "refresh" },
    REFRESH_TOKEN_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
}

function storeRefreshToken(userId, token) {
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS).toISOString();
  db.prepare(
    "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)"
  ).run(userId, hash, expiresAt);
}

function revokeRefreshToken(token) {
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  db.prepare("DELETE FROM refresh_tokens WHERE token_hash = ?").run(hash);
}

function isRefreshTokenValid(userId, token) {
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const row = db.prepare(
    "SELECT id FROM refresh_tokens WHERE user_id = ? AND token_hash = ? AND expires_at > datetime('now')"
  ).get(userId, hash);
  return !!row;
}

// Clean up expired tokens periodically (on each auth request)
function cleanupExpiredTokens() {
  db.prepare("DELETE FROM refresh_tokens WHERE expires_at <= datetime('now')").run();
}

// ── POST /auth/signup ────────────────────────────────────

router.post("/signup", (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: "Name, email, password, and role are required" });
  }

  // Block Super Admin creation via public signup
  if (role === "Super Admin") {
    return res.status(403).json({ error: "Super Admin accounts cannot be created via signup" });
  }

  const VALID_ROLES = ["Manager", "Dispatcher", "Safety Officer", "Financial Analyst", "Driver"];
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: `Role must be one of: ${VALID_ROLES.join(", ")}` });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) {
    return res.status(409).json({ error: "Email already registered" });
  }

  const salt = bcrypt.genSaltSync(BCRYPT_ROUNDS);
  const password_hash = bcrypt.hashSync(password, salt);

  const result = db.prepare(
    "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)"
  ).run(name, email, password_hash, role);

  const user = db.prepare("SELECT id, name, email, role, avatar_url, created_at FROM users WHERE id = ?").get(result.lastInsertRowid);

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  storeRefreshToken(user.id, refreshToken);

  res.status(201).json({ accessToken, refreshToken, user });
});

// ── POST /auth/login ─────────────────────────────────────

router.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const validPassword = bcrypt.compareSync(password, user.password_hash);
  if (!validPassword) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  storeRefreshToken(user.id, refreshToken);

  // Cleanup expired tokens in the background
  cleanupExpiredTokens();

  res.json({
    accessToken,
    refreshToken,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar_url: user.avatar_url || null },
  });
});

// ── POST /auth/refresh ───────────────────────────────────

router.post("/refresh", (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: "Refresh token is required" });
  }

  try {
    const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);

    // Verify token exists in DB (not revoked)
    if (!isRefreshTokenValid(decoded.id, refreshToken)) {
      return res.status(401).json({ error: "Refresh token revoked or expired" });
    }

    // Get current user data (in case role changed)
    const user = db.prepare("SELECT id, name, email, role FROM users WHERE id = ?").get(decoded.id);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    // Rotate: revoke old refresh token and issue new pair
    revokeRefreshToken(refreshToken);
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);
    storeRefreshToken(user.id, newRefreshToken);

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired refresh token" });
  }
});

// ── POST /auth/logout ────────────────────────────────────

router.post("/logout", (req, res) => {
  const { refreshToken } = req.body;

  if (refreshToken) {
    revokeRefreshToken(refreshToken);
  }

  res.json({ message: "Logged out successfully" });
});

// ── GET /auth/me ─────────────────────────────────────────

router.get("/me", (req, res) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.prepare("SELECT id, name, email, role, avatar_url, created_at FROM users WHERE id = ?").get(decoded.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ user });
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired", code: "TOKEN_EXPIRED" });
    }
    return res.status(401).json({ error: "Invalid or expired token" });
  }
});

module.exports = router;
