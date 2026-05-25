import Database from "better-sqlite3";
import path from "node:path";

const dbPath = path.resolve(process.cwd(), process.env.SQLITE_PATH || "./data.sqlite");

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id           TEXT PRIMARY KEY,
    email        TEXT NOT NULL UNIQUE,
    password     TEXT NOT NULL,
    fullname     TEXT,
    created_at   INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS devices (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      TEXT NOT NULL,
    token        TEXT NOT NULL UNIQUE,
    platform     TEXT NOT NULL CHECK (platform IN ('ios','android','web')),
    created_at   INTEGER NOT NULL,
    updated_at   INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);

  CREATE TABLE IF NOT EXISTS notifications (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      TEXT,
    title        TEXT NOT NULL,
    body         TEXT NOT NULL,
    data         TEXT,
    created_at   INTEGER NOT NULL
  );
`);
