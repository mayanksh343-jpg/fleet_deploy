const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

// Create DB file in database folder
const dbPath = path.join(__dirname, "database", "fleetflow.db");

// Initialize DB
const db = new Database(dbPath);

// Enable foreign key enforcement
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Load and run schema
const schemaPath = path.join(__dirname, "database", "schema.sql");
const schema = fs.readFileSync(schemaPath, "utf8");

db.exec(schema);

// ── Migrations — add new columns to existing databases ────
const profileColumns = [
  "ALTER TABLE users ADD COLUMN phone TEXT",
  "ALTER TABLE users ADD COLUMN avatar_url TEXT",
  "ALTER TABLE users ADD COLUMN address TEXT",
  "ALTER TABLE users ADD COLUMN timezone TEXT DEFAULT 'UTC'",
  "ALTER TABLE users ADD COLUMN notifications_enabled INTEGER DEFAULT 1",
  "ALTER TABLE users ADD COLUMN theme_preference TEXT DEFAULT 'dark'",
  "ALTER TABLE users ADD COLUMN updated_at TEXT DEFAULT (datetime('now'))",
];
for (const sql of profileColumns) {
  try { db.exec(sql); } catch { /* column already exists */ }
}

console.log("Database initialized with foreign keys enabled.");

module.exports = db;