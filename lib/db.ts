// ============================================================================
// db.ts — tiny SQLite database that persists billboard items across sessions
// ============================================================================
//
// Mirrors the pattern used in killrctx. SQLite lives at data/braille-billboard.db.
// We own the billboard item list (query string, chatId, VisualizationData, audio).
// OpenRAG owns the conversation threads; chatId is kept here so we can delete
// them when an item is removed.
//
// Why better-sqlite3?
//   Synchronous, zero-config, single-file. No connection pool needed for a
//   single-user local app.
//
// Why lazy open?
//   During `next build`, Next.js worker processes all load modules. Deferring
//   open() to the first query avoids SQLITE_BUSY races between workers.
// ============================================================================

import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { VisualizationData, SpriteData } from "./types";

// ---------------------------------------------------------------------------
// Row type — mirrors the BillboardItem shape, stored flat in SQLite.
// data, audioB64, and spriteData are JSON-serialised TEXT columns.
// ---------------------------------------------------------------------------

export type ItemRow = {
  id: string;
  query: string;
  chat_id: string | null;
  data_json: string;         // JSON-serialised VisualizationData
  audio_b64: string | null;
  sprite_data: string | null; // JSON-serialised SpriteData, or NULL
  created_at: number;        // ms since epoch
};

// The deserialised form returned to callers.
export type PersistedItem = {
  id: string;
  query: string;
  chatId: string | null;
  data: VisualizationData;
  audioB64: string | null;
  spriteData: SpriteData | null;
  createdAt: number;
};

// ---------------------------------------------------------------------------
// Lazy singleton
// ---------------------------------------------------------------------------

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;

  const dataDir = join(process.cwd(), "data");
  mkdirSync(dataDir, { recursive: true });

  const conn = new Database(join(dataDir, "braille-billboard.db"));
  conn.pragma("journal_mode = WAL");

  conn.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id          TEXT    PRIMARY KEY,
      query       TEXT    NOT NULL,
      chat_id     TEXT,
      data_json   TEXT    NOT NULL,
      audio_b64   TEXT,
      created_at  INTEGER NOT NULL
    );
  `);

  // Idempotent migration: add sprite_data column if it doesn't exist yet.
  const cols = conn
    .prepare("PRAGMA table_info(items)")
    .all() as { name: string }[];
  if (!cols.some((c) => c.name === "sprite_data")) {
    conn.exec("ALTER TABLE items ADD COLUMN sprite_data TEXT");
  }

  _db = conn;
  return conn;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rowToItem(row: ItemRow): PersistedItem {
  return {
    id: row.id,
    query: row.query,
    chatId: row.chat_id,
    data: JSON.parse(row.data_json) as VisualizationData,
    audioB64: row.audio_b64,
    spriteData: row.sprite_data ? (JSON.parse(row.sprite_data) as SpriteData) : null,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Return all items ordered oldest-first (preserves playlist order). */
export function listItems(): PersistedItem[] {
  const rows = getDb()
    .prepare("SELECT * FROM items ORDER BY created_at ASC")
    .all() as ItemRow[];
  return rows.map(rowToItem);
}

/** Insert a new item. Silently ignores duplicate IDs (INSERT OR IGNORE). */
export function insertItem(item: {
  id: string;
  query: string;
  chatId: string | null;
  data: VisualizationData;
  audioB64: string | null;
}): void {
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO items (id, query, chat_id, data_json, audio_b64, sprite_data, created_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?)`,
    )
    .run(
      item.id,
      item.query,
      item.chatId,
      JSON.stringify(item.data),
      item.audioB64,
      Date.now(),
    );
}

/**
 * Update (replace) the sprite_data for an existing item.
 * Passing null clears the sprite.
 */
export function updateItemSprite(id: string, spriteData: SpriteData | null): void {
  getDb()
    .prepare("UPDATE items SET sprite_data = ? WHERE id = ?")
    .run(spriteData ? JSON.stringify(spriteData) : null, id);
}

/**
 * Delete an item by id.
 * Returns `{ found: false }` when the id doesn't exist in the DB.
 * Returns `{ found: true, chatId }` on success — `chatId` may be null if the
 * item had no OpenRAG conversation.
 */
export function deleteItem(id: string): { found: false } | { found: true; chatId: string | null } {
  const row = getDb()
    .prepare("SELECT chat_id FROM items WHERE id = ?")
    .get(id) as { chat_id: string | null } | undefined;
  if (!row) return { found: false };
  getDb().prepare("DELETE FROM items WHERE id = ?").run(id);
  return { found: true, chatId: row.chat_id };
}

