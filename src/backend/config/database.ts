/**
 * database.ts - Unified Database using `libsql` (drop-in for better-sqlite3)
 * 
 * `libsql` is already installed as a peer dep of @libsql/client.
 * It provides the exact same synchronous API as better-sqlite3.
 * Works on Vercel serverless (pure JS, no native C++ compilation issues).
 */

import Database from 'libsql';
import path from 'path';
import fs from 'fs';

// ─── Database Path ────────────────────────────────────────────────────────────
const dataDir = process.env.VERCEL ? '/tmp' : path.resolve(process.cwd(), 'data');
try { if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true }); } catch {}
const dbPath = path.resolve(dataDir, 'jobsearch.db');

// ─── Sync Database (libsql - same API as better-sqlite3) ──────────────────────
export const sqliteDb = new Database(dbPath);

try { sqliteDb.pragma('journal_mode = WAL'); } catch {}

// ─── Sync db interface (used by controllers and services) ────────────────────
export const db = {
  prepare: (sql: string) => sqliteDb.prepare(sql),
  exec: (sql: string) => sqliteDb.exec(sql)
};

// ─── Async db interface (compatible with old async refactor attempts) ────────
export const dbAsync = {
  get: async (sql: string, args: any[] = []): Promise<any> => {
    return sqliteDb.prepare(sql).get(...args) ?? null;
  },
  all: async (sql: string, args: any[] = []): Promise<any[]> => {
    return sqliteDb.prepare(sql).all(...args) as any[];
  },
  run: async (sql: string, args: any[] = []): Promise<void> => {
    sqliteDb.prepare(sql).run(...args);
  }
};

// ─── Table Creation ───────────────────────────────────────────────────────────
function createTables() {
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS resume_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, version TEXT NOT NULL, resume_text TEXT NOT NULL,
      file_path TEXT, is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, primary_role TEXT NOT NULL,
      experience_years REAL DEFAULT 3.0, experience_text TEXT,
      primary_location TEXT NOT NULL, preferred_locations TEXT NOT NULL,
      preferred_roles TEXT NOT NULL, core_skills TEXT NOT NULL,
      active_resume_id INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS search_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keywords TEXT NOT NULL, location TEXT NOT NULL,
      min_experience REAL DEFAULT 3, max_experience REAL DEFAULT 5,
      remote_allowed INTEGER DEFAULT 1, job_type TEXT DEFAULT 'Full Time',
      posted_within TEXT DEFAULT '30 days', min_match_score INTEGER DEFAULT 80,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL, external_id TEXT, title TEXT NOT NULL,
      company TEXT NOT NULL, location TEXT NOT NULL, remote INTEGER DEFAULT 0,
      salary_min REAL, salary_max REAL, salary_currency TEXT DEFAULT 'USD',
      experience_min REAL, experience_max REAL, employment_type TEXT DEFAULT 'Full Time',
      description TEXT NOT NULL, job_url TEXT NOT NULL, company_url TEXT,
      contact_email TEXT, posted_date TEXT, is_demo INTEGER DEFAULT 0,
      collected_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(source, external_id)
    );

    CREATE TABLE IF NOT EXISTS job_analysis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER UNIQUE NOT NULL, match_score INTEGER NOT NULL,
      role_score INTEGER DEFAULT 0, skills_score INTEGER DEFAULT 0,
      experience_score INTEGER DEFAULT 0, location_score INTEGER DEFAULT 0,
      employment_type_score INTEGER DEFAULT 0, salary_score INTEGER DEFAULT 0,
      seniority_score INTEGER DEFAULT 0, other_score INTEGER DEFAULT 0,
      matching_skills TEXT, missing_skills TEXT, required_skills TEXT,
      nice_to_have_skills TEXT, ai_summary TEXT,
      recommendation TEXT CHECK(recommendation IN ('APPLY','MAYBE','SKIP')),
      analyzed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL UNIQUE,
      status TEXT CHECK(status IN ('DISCOVERED','ANALYZED','SAVED','APPLIED','INTERVIEW','OFFER','REJECTED')) DEFAULT 'SAVED',
      applied_at DATETIME, notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      component TEXT NOT NULL, event TEXT NOT NULL, status TEXT NOT NULL,
      message TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS job_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL,
      is_enabled INTEGER DEFAULT 1, is_restricted INTEGER DEFAULT 0,
      status_message TEXT
    );
  `);

  const safeAlter = (sql: string) => { try { sqliteDb.exec(sql); } catch {} };
  safeAlter("ALTER TABLE job_sources ADD COLUMN is_restricted INTEGER DEFAULT 0");
  safeAlter("ALTER TABLE job_sources ADD COLUMN status_message TEXT");
  safeAlter("ALTER TABLE applications ADD COLUMN notes TEXT");
}

// ─── Seeding ──────────────────────────────────────────────────────────────────
function seedData() {
  const HARDCODED_CLUSTER_KEY = 'cp_b585d212b386450a88f866049aa19fc0af387b46279719b75c588543e275dede';

  // Profile
  const profileCount = sqliteDb.prepare('SELECT COUNT(*) as count FROM profile').get() as any;
  if (!profileCount || profileCount.count === 0) {
    sqliteDb.prepare(`
      INSERT INTO profile (name, primary_role, experience_years, experience_text, primary_location, preferred_locations, preferred_roles, core_skills)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'Candidate Profile', 'Software Developer', 3.0,
      '3+ years professional experience',
      'Remote, India',
      JSON.stringify(['Remote', 'India', 'Worldwide']),
      JSON.stringify(['Software Engineer', 'Full Stack Developer', 'Frontend Developer', 'Backend Engineer']),
      JSON.stringify(['React', 'Node.js', 'TypeScript', 'JavaScript', 'REST API', 'SQL'])
    );
  }

  // Search Config
  const configCount = sqliteDb.prepare('SELECT COUNT(*) as count FROM search_configs').get() as any;
  if (!configCount || configCount.count === 0) {
    sqliteDb.prepare(`
      INSERT INTO search_configs (keywords, location, min_experience, max_experience, remote_allowed, job_type, posted_within, min_match_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      JSON.stringify(['React Native Developer', 'Senior React Native Developer', 'Mobile Engineer']),
      'Ahmedabad', 2, 6, 1, 'Full Time', '30 days', 80
    );
  }

  // Settings
  const settingsToSeed: Record<string, string> = {
    cluster_api_url: process.env.CLUSTER_API_URL || 'https://api.clusterprotocol.ai/v1',
    cluster_api_key: (process.env.CLUSTER_API_KEY || '').trim() || HARDCODED_CLUSTER_KEY,
    cluster_model: 'best-model',
    cluster_temperature: '0.2',
    cluster_max_tokens: '2048',
    scheduler_enabled: '1',
    scheduler_interval: '180',
  };
  const upsertSetting = sqliteDb.prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`);
  for (const [key, value] of Object.entries(settingsToSeed)) {
    upsertSetting.run(key, value);
  }

  // Job Sources
  const sources = [
    ['linkedin', 'LinkedIn Jobs (Guest Search)', 1, 'ACTIVE'],
    ['naukri', 'Naukri & Indeed Public Feeds', 1, 'ACTIVE'],
    ['india_local_jobs', 'Global & Regional Public Feeds', 1, 'ACTIVE'],
    ['greenhouse', 'Greenhouse Career Boards', 1, 'ACTIVE'],
    ['arbeitnow', 'Arbeitnow Tech Jobs', 1, 'ACTIVE'],
    ['hackernews', 'HackerNews Jobs', 1, 'ACTIVE'],
    ['global_jobs', 'Global Jobs Aggregator', 1, 'ACTIVE'],
    ['remotive', 'Remotive Public API', 1, 'ACTIVE'],
    ['jobicy', 'Jobicy Engineering API', 1, 'ACTIVE'],
    ['weworkremotely', 'We Work Remotely RSS', 1, 'ACTIVE'],
    ['remoteok', 'RemoteOK Engineering API', 1, 'ACTIVE'],
  ];
  const upsertSource = sqliteDb.prepare(`
    INSERT INTO job_sources (name, display_name, is_enabled, is_restricted, status_message)
    VALUES (?, ?, ?, 0, ?) ON CONFLICT(name) DO UPDATE SET display_name = excluded.display_name
  `);
  for (const [name, display_name, is_enabled, status] of sources) {
    upsertSource.run(name, display_name, is_enabled, status);
  }
}

// ─── Main init ────────────────────────────────────────────────────────────────
let _initialized = false;

export function initDatabase(): void {
  if (_initialized) return;
  console.log(`[DB] Initializing SQLite database at ${dbPath}...`);
  try {
    createTables();
    seedData();
    _initialized = true;
    console.log('[DB] Database ready');
  } catch (err) {
    console.error('[DB] Init failed:', err);
    throw err;
  }
}

// Also export async version for compatibility
export async function initDatabaseAsync(): Promise<void> {
  initDatabase();
}
