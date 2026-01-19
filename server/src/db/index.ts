import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DATABASE_URL || path.join(__dirname, '../../data/halo.db');

// Ensure data directory exists
import fs from 'fs';
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const sqlite = new Database(dbPath);

// Create tables if they don't exist
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    first_name TEXT,
    last_name TEXT,
    phone_number TEXT,
    is_admin INTEGER DEFAULT 0,
    google_id TEXT,
    avatar_url TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS class_sessions (
    id TEXT PRIMARY KEY,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    class_type TEXT NOT NULL,
    mode TEXT NOT NULL,
    status TEXT DEFAULT 'scheduled',
    google_event_id TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES class_sessions(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    price REAL NOT NULL,
    status TEXT DEFAULT 'confirmed',
    user_calendar_event_id TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS schedule_configs (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    day_of_week INTEGER,
    specific_date TEXT,
    week_start_date TEXT,
    start_time TEXT,
    slots_count INTEGER DEFAULT 4,
    is_closed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS google_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_calendar_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

// Add class_type column to schedule_configs if it doesn't exist
try {
  sqlite.exec(`ALTER TABLE schedule_configs ADD COLUMN class_type TEXT`);
} catch (e) {
  // Column already exists, ignore
}

// Add pricing_tier_id column to users if it doesn't exist
try {
  sqlite.exec(`ALTER TABLE users ADD COLUMN pricing_tier_id TEXT`);
} catch (e) {
  // Column already exists, ignore
}

// Create slot_closures table
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS slot_closures (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    start_time TEXT,
    end_time TEXT,
    slot_index INTEGER,
    reason TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create pricing_tiers table
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS pricing_tiers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    discount_percent REAL DEFAULT 0,
    is_default INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create tier_pricing table
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS tier_pricing (
    id TEXT PRIMARY KEY,
    tier_id TEXT NOT NULL REFERENCES pricing_tiers(id),
    class_type TEXT NOT NULL,
    mode TEXT NOT NULL,
    price REAL NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create user_pricing table
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS user_pricing (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    class_type TEXT NOT NULL,
    mode TEXT NOT NULL,
    custom_price REAL,
    discount_percent REAL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create user_notes table
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS user_notes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    admin_id TEXT NOT NULL REFERENCES users(id),
    note TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

export const db = drizzle(sqlite, { schema });

export { schema };
