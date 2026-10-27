const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(process.cwd(), 'eater.db');

let db = null;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initTables();
  }
  return db;
}

function initTables() {
  const d = db;

  d.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      daily_calorie_target REAL DEFAULT 2000,
      daily_protein_target REAL DEFAULT 50,
      monthly_budget REAL DEFAULT 5000,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS foods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      food_id TEXT UNIQUE NOT NULL,
      canteen TEXT NOT NULL,
      category TEXT NOT NULL,
      food_name TEXT NOT NULL,
      price_inr REAL NOT NULL,
      serving_description TEXT,
      calories_kcal REAL,
      protein_g REAL,
      carbs_g REAL,
      fat_g REAL,
      vegetarian TEXT DEFAULT 'Unknown',
      nutrition_status TEXT DEFAULT 'Not entered',
      source_notes TEXT,
      last_verified TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS food_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      food_db_id INTEGER NOT NULL,
      quantity REAL NOT NULL DEFAULT 1,
      logged_at TEXT NOT NULL DEFAULT (datetime('now')),
      price_snapshot REAL NOT NULL,
      calories_snapshot REAL,
      protein_snapshot REAL,
      carbs_snapshot REAL,
      fat_snapshot REAL,
      food_name_snapshot TEXT NOT NULL,
      canteen_snapshot TEXT NOT NULL,
      source TEXT DEFAULT 'manual',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (food_db_id) REFERENCES foods(id)
    );

    CREATE INDEX IF NOT EXISTS idx_food_logs_user_date ON food_logs(user_id, logged_at);
    CREATE INDEX IF NOT EXISTS idx_foods_canteen ON foods(canteen);
    CREATE INDEX IF NOT EXISTS idx_foods_category ON foods(category);
    CREATE INDEX IF NOT EXISTS idx_foods_food_id ON foods(food_id);
  `);
}

module.exports = { getDb, DB_PATH };
