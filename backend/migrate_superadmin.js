/**
 * FleetFlow Migration: Add Super Admin role + permissions table
 * Run: node migrate_superadmin.js
 *
 * This migration:
 * 1. Recreates the users table with the updated CHECK constraint (adds 'Super Admin')
 * 2. Creates the permissions table for granular per-user permission management
 */
const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "database", "fleetflow.db");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = OFF"); // Must be OFF to recreate table

console.log("Starting Super Admin migration...\n");

const migrate = db.transaction(() => {
  // 1. Recreate users table with updated CHECK constraint
  console.log("1. Updating users table CHECK constraint...");

  // Check if Super Admin is already in the constraint (idempotent)
  try {
    db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES ('__test__', '__test__@test.com', '__test__', 'Super Admin')").run();
    // If it succeeds, the constraint already allows Super Admin — clean up and skip
    db.prepare("DELETE FROM users WHERE email = '__test__@test.com'").run();
    console.log("   ✅ Users table already supports Super Admin role (skipped).");
  } catch (err) {
    if (err.message.includes("CHECK constraint failed")) {
      // Need to recreate the table
      db.exec(`
        CREATE TABLE users_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('Super Admin', 'Manager', 'Dispatcher', 'Safety Officer', 'Financial Analyst', 'Driver')),
          created_at TEXT DEFAULT (datetime('now'))
        );
      `);
      db.exec(`INSERT INTO users_new (id, name, email, password_hash, role, created_at) SELECT id, name, email, password_hash, role, created_at FROM users;`);
      db.exec(`DROP TABLE users;`);
      db.exec(`ALTER TABLE users_new RENAME TO users;`);
      console.log("   ✅ Users table recreated with Super Admin role in CHECK constraint.");
    } else {
      throw err;
    }
  }

  // 2. Create permissions table
  console.log("2. Creating permissions table...");
  db.exec(`
    CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      permission TEXT NOT NULL,
      granted_by INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(granted_by) REFERENCES users(id),
      UNIQUE(user_id, permission)
    );
  `);
  console.log("   ✅ Permissions table created.");
});

try {
  migrate();
  db.pragma("foreign_keys = ON");
  console.log("\n✅ Migration complete! Super Admin role is now available.");
} catch (err) {
  console.error("\n❌ Migration failed:", err.message);
  process.exit(1);
}
