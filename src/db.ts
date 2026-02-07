import { Database } from 'bun:sqlite';
import { mkdirSync } from 'fs';
import { STATE_DIR, DB_PATH } from './config';
import type { PinRecord } from './types';

let db: Database | null = null;

export function initDatabase(): Database {
  if (db) return db;

  mkdirSync(STATE_DIR, { recursive: true });
  db = new Database(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS pins (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp     TEXT NOT NULL DEFAULT (datetime('now')),
      folder_name   TEXT NOT NULL,
      folder_cid    TEXT NOT NULL,
      zip_cid       TEXT,
      ipns_key_name TEXT,
      ipns_name     TEXT,
      server        TEXT NOT NULL,
      gateway       TEXT NOT NULL,
      folder_url    TEXT NOT NULL,
      zip_url       TEXT,
      ipns_url      TEXT,
      file_count    INTEGER NOT NULL DEFAULT 0,
      folder_size   INTEGER NOT NULL DEFAULT 0,
      zip_size      INTEGER NOT NULL DEFAULT 0,
      report_path   TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_pins_folder_name ON pins(folder_name);
    CREATE INDEX IF NOT EXISTS idx_pins_folder_cid ON pins(folder_cid);
    CREATE INDEX IF NOT EXISTS idx_pins_timestamp ON pins(timestamp);

    CREATE TABLE IF NOT EXISTS config (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  return db;
}

export function insertPin(record: PinRecord): number {
  const d = initDatabase();
  const stmt = d.prepare(`
    INSERT INTO pins (folder_name, folder_cid, zip_cid, ipns_key_name, ipns_name,
                      server, gateway, folder_url, zip_url, ipns_url,
                      file_count, folder_size, zip_size, report_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    record.folder_name,
    record.folder_cid,
    record.zip_cid || null,
    record.ipns_key_name || null,
    record.ipns_name || null,
    record.server,
    record.gateway,
    record.folder_url,
    record.zip_url || null,
    record.ipns_url || null,
    record.file_count,
    record.folder_size,
    record.zip_size,
    record.report_path || null,
  );
  return Number(result.lastInsertRowid);
}

export function listPins(limit = 50): PinRecord[] {
  const d = initDatabase();
  return d.prepare('SELECT * FROM pins ORDER BY timestamp DESC LIMIT ?').all(limit) as PinRecord[];
}

export function searchPins(query: string): PinRecord[] {
  const d = initDatabase();
  const pattern = `%${query}%`;
  return d.prepare(`
    SELECT * FROM pins
    WHERE folder_name LIKE ? OR folder_cid LIKE ? OR ipns_name LIKE ?
    ORDER BY timestamp DESC
  `).all(pattern, pattern, pattern) as PinRecord[];
}

export function getConfigValue(key: string): string | undefined {
  const d = initDatabase();
  const row = d.prepare('SELECT value FROM config WHERE key = ?').get(key) as { value: string } | null;
  return row?.value;
}

export function setConfigValue(key: string, value: string): void {
  const d = initDatabase();
  d.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(key, value);
}
