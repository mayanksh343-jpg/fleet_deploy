/**
 * Centralized JWT & Security Configuration
 * Single source of truth for all auth-related constants.
 */
const crypto = require("crypto");

// Generate a fallback secret if none is set (warns in production)
const DEFAULT_SECRET = crypto.randomBytes(32).toString("hex");

const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || crypto.randomBytes(32).toString("hex");

if (!process.env.JWT_SECRET) {
  console.warn("⚠️  JWT_SECRET not set in .env — using random fallback (tokens will invalidate on restart)");
}

module.exports = {
  JWT_SECRET,
  REFRESH_TOKEN_SECRET,
  ACCESS_TOKEN_EXPIRY: "15m",
  REFRESH_TOKEN_EXPIRY: "7d",
  REFRESH_TOKEN_EXPIRY_MS: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  BCRYPT_ROUNDS: 10,
};
