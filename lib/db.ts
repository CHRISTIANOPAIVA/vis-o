import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, "nutrivision.db"));

// WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS meals (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at   TEXT    DEFAULT (datetime('now')),
    food_name    TEXT    NOT NULL,
    calories     INTEGER NOT NULL,
    protein      REAL    NOT NULL,
    carbs        REAL    NOT NULL,
    fat          REAL    NOT NULL,
    fiber        REAL    NOT NULL DEFAULT 0,
    confidence   TEXT    NOT NULL,
    explanation  TEXT    NOT NULL,
    image_base64 TEXT
  );

  CREATE TABLE IF NOT EXISTS user_profile (
    id         INTEGER PRIMARY KEY DEFAULT 1,
    weight_kg  REAL    NOT NULL DEFAULT 70,
    height_cm  REAL    NOT NULL DEFAULT 170,
    age        INTEGER NOT NULL DEFAULT 25,
    sex        TEXT    NOT NULL DEFAULT 'male',
    goal       TEXT    NOT NULL DEFAULT 'maintain'
  );
`);

// Adiciona coluna is_edited se não existir (idempotente)
try {
  db.exec(`ALTER TABLE meals ADD COLUMN is_edited INTEGER NOT NULL DEFAULT 0`);
} catch {
  // coluna já existe — ignorar
}

export default db;
