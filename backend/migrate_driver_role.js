const db = require('./db.js');

try {
  db.exec(`
    PRAGMA foreign_keys=off;
    BEGIN TRANSACTION;
    ALTER TABLE users RENAME TO _users_old;
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('Manager', 'Dispatcher', 'Safety Officer', 'Financial Analyst', 'Driver')),
      created_at TEXT DEFAULT (datetime('now'))
    );
    INSERT INTO users (id, name, email, password_hash, role, created_at)
    SELECT id, name, email, password_hash, role, created_at FROM _users_old;
    DROP TABLE _users_old;
    COMMIT;
    PRAGMA foreign_keys=on;
  `);
  console.log("Migration successful");
} catch(err) {
  console.error("Migration error:", err);
}
