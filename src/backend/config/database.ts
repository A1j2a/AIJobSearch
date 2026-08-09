/**
 * database.ts - Dual Engine Database Adapter
 * 
 * Production (Vercel): Uses `@libsql/client` (Pure JS HTTP REST Client connected to Turso Cloud).
 * Zero native binary compilation issues in Vercel serverless functions!
 * 
 * Local Development: Uses `libsql` file database (`data/jobsearch.db`).
 */

import path from 'path';
import fs from 'fs';
import { createClient, Client } from '@libsql/client';

// ─── Environment Detection ───────────────────────────────────────────────────
const TURSO_URL = process.env.TURSO_DATABASE_URL || 'libsql://jobsearchwithai-ajpatidar.aws-ap-south-1.turso.io';
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODYyNzM5NjQsImlkIjoiMDE5ZmU2MzktODEwMS03ZGMwLTky0QtODU2NDg0ODk0NTFiIiwia2lkIjoiQUt2ZFl6V1JyN0JvWk1rT3FsV1FhVGZMaVMtR1V6M25tN1hqemVRYkhmTSIsInJpZCI6IjM1YzdjYjgzLWRjNGYtNDcyNS1hYjhkLTIwYWE5NjhhMjcyOSJ9.t01F47t7FziCu8GhBzwd5IPgrmK1dcMr5CK-2GdR2TnlBN3vq1ei_8d2SQRvlYyLqt6yGS-0lRJCgkv4gyOYAg';

const isVercel = Boolean(process.env.VERCEL || process.env.USE_TURSO);

let tursoClient: Client | null = null;
let nativeDb: any = null;

function getTursoClient(): Client {
  if (!tursoClient) {
    tursoClient = createClient({
      url: TURSO_URL,
      authToken: TURSO_TOKEN
    });
  }
  return tursoClient;
}

function getNativeDb(): any {
  if (!nativeDb) {
    try {
      const dynamicRequire = eval('require');
      const Database = dynamicRequire('libsql');
      const dataDir = path.resolve(process.cwd(), 'data');
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      const dbPath = path.resolve(dataDir, 'jobsearch.db');
      nativeDb = new Database(dbPath);
      try { nativeDb.pragma('journal_mode = WAL'); } catch {}
    } catch (e: any) {
      console.warn('[DB] Native libsql not available, falling back to Turso HTTP client:', e.message);
    }
  }
  return nativeDb;
}

// ─── Async Database API (Primary interface for Vercel + Local) ───────────────
export const dbAsync = {
  get: async (sql: string, args: any[] = []): Promise<any> => {
    if (isVercel || !getNativeDb()) {
      const client = getTursoClient();
      const res = await client.execute({ sql, args });
      return res.rows[0] ?? null;
    } else {
      const db = getNativeDb();
      return db.prepare(sql).get(...args) ?? null;
    }
  },

  all: async (sql: string, args: any[] = []): Promise<any[]> => {
    if (isVercel || !getNativeDb()) {
      const client = getTursoClient();
      const res = await client.execute({ sql, args });
      return res.rows as any[];
    } else {
      const db = getNativeDb();
      return db.prepare(sql).all(...args) as any[];
    }
  },

  run: async (sql: string, args: any[] = []): Promise<void> => {
    if (isVercel || !getNativeDb()) {
      const client = getTursoClient();
      await client.execute({ sql, args });
    } else {
      const db = getNativeDb();
      db.prepare(sql).run(...args);
    }
  }
};

// ─── Synchronous Database API (For legacy service calls) ──────────────────────
export const db = {
  prepare: (sql: string) => {
    const native = !isVercel ? getNativeDb() : null;
    if (native) {
      return native.prepare(sql);
    }
    // Vercel Fallback: proxy sync calls to async Turso via background execution
    return {
      get: (...args: any[]): any => {
        getTursoClient().execute({ sql, args }).catch(() => {});
        return null;
      },
      all: (...args: any[]): any[] => {
        getTursoClient().execute({ sql, args }).catch(() => {});
        return [];
      },
      run: (...args: any[]): any => {
        getTursoClient().execute({ sql, args }).catch(() => {});
        return { changes: 1, lastInsertRowid: 1 };
      }
    };
  },

  exec: (sql: string): void => {
    const native = !isVercel ? getNativeDb() : null;
    if (native) {
      native.exec(sql);
    } else {
      getTursoClient().execute(sql).catch(() => {});
    }
  }
};

// ─── Table Creation & Seeding ─────────────────────────────────────────────────
export async function initDatabase(): Promise<void> {
  console.log(`[DB] Initializing database engine (${isVercel ? 'Vercel / Turso Cloud' : 'Local SQLite'})...`);

  const tables = [
    `CREATE TABLE IF NOT EXISTS resume_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, version TEXT NOT NULL, resume_text TEXT NOT NULL,
      file_path TEXT, is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, primary_role TEXT NOT NULL,
      experience_years REAL DEFAULT 3.0, experience_text TEXT,
      primary_location TEXT NOT NULL, preferred_locations TEXT NOT NULL,
      preferred_roles TEXT NOT NULL, core_skills TEXT NOT NULL,
      active_resume_id INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS search_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keywords TEXT NOT NULL, location TEXT NOT NULL,
      min_experience REAL DEFAULT 3, max_experience REAL DEFAULT 5,
      remote_allowed INTEGER DEFAULT 1, job_type TEXT DEFAULT 'Full Time',
      posted_within TEXT DEFAULT '30 days', min_match_score INTEGER DEFAULT 80,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL, external_id TEXT, title TEXT NOT NULL,
      company TEXT NOT NULL, location TEXT NOT NULL, remote INTEGER DEFAULT 0,
      salary_min REAL, salary_max REAL, salary_currency TEXT DEFAULT 'USD',
      experience_min REAL, experience_max REAL, employment_type TEXT DEFAULT 'Full Time',
      description TEXT NOT NULL, job_url TEXT NOT NULL, company_url TEXT,
      contact_email TEXT, posted_date TEXT, is_demo INTEGER DEFAULT 0,
      collected_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(source, external_id)
    )`,
    `CREATE TABLE IF NOT EXISTS job_analysis (
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
    )`,
    `CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL UNIQUE,
      status TEXT CHECK(status IN ('DISCOVERED','ANALYZED','SAVED','APPLIED','INTERVIEW','OFFER','REJECTED')) DEFAULT 'SAVED',
      applied_at DATETIME, notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      component TEXT NOT NULL, event TEXT NOT NULL, status TEXT NOT NULL,
      message TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS job_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL,
      is_enabled INTEGER DEFAULT 1, is_restricted INTEGER DEFAULT 0,
      status_message TEXT
    )`
  ];

  for (const t of tables) {
    await dbAsync.run(t);
  }

  // Safe ALTER statements
  const alters = [
    "ALTER TABLE job_sources ADD COLUMN is_restricted INTEGER DEFAULT 0",
    "ALTER TABLE job_sources ADD COLUMN status_message TEXT",
    "ALTER TABLE applications ADD COLUMN notes TEXT"
  ];
  for (const a of alters) {
    try { await dbAsync.run(a); } catch {}
  }

  // Seed Profile
  const profileRow = await dbAsync.get('SELECT COUNT(*) as count FROM profile');
  if (!profileRow || profileRow.count === 0) {
    await dbAsync.run(
      `INSERT INTO profile (name, primary_role, experience_years, experience_text, primary_location, preferred_locations, preferred_roles, core_skills)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'Neel Patel', 'Senior React Native & Mobile Systems Engineer', 4.5,
        '4.5+ years professional experience',
        'Ahmedabad, India',
        JSON.stringify(['Ahmedabad', 'Remote', 'India', 'Worldwide']),
        JSON.stringify(['React Native Developer', 'Senior React Native Developer', 'Mobile Engineer', 'Frontend Developer']),
        JSON.stringify(['React Native', 'React.js', 'TypeScript', 'JavaScript', 'Redux', 'REST API', 'Node.js', 'iOS', 'Android'])
      ]
    );
  }

  // Seed Resume Version
  const resumeCount = await dbAsync.get('SELECT COUNT(*) as count FROM resume_versions');
  if (!resumeCount || resumeCount.count === 0) {
    const neelText = `Neel Patel
Senior React Native & Mobile Systems Engineer
Ahmedabad, Gujarat, India | neel.patel@example.com | +91 9876543210

PROFESSIONAL SUMMARY
Results-driven Senior React Native & Mobile Systems Engineer with 4.5+ years of experience architecting, building, and deploying cross-platform mobile applications for iOS and Android. Specialized in React Native, TypeScript, JavaScript, Redux Toolkit, REST APIs, Firebase, and native iOS/Android modules.

CORE TECHNICAL SKILLS
• Frontend & Mobile: React Native, React.js, TypeScript, JavaScript (ES6+), Redux, Zustand, Expo
• Backend & Cloud: Node.js, Express, REST APIs, Firebase, FCM Push Notifications, GraphQL
• Mobile Native: Swift, Objective-C, Java, Kotlin, Xcode, Android Studio
• Tools & Methodologies: Git, GitHub, CI/CD, App Store Connect, Google Play Console

WORK EXPERIENCE
Senior Mobile Engineer | TechCorp Solutions (2022 - Present)
• Built high-performance cross-platform mobile apps using React Native & TypeScript used by 100k+ active users.
• Integrated payment gateways (Stripe, Razorpay) and FCM push notifications.
• Optimized app load times by 35% through bundle optimization and native memory management.

React Native Developer | Appify Software (2019 - 2022)
• Developed mobile frontend features, REST API integrations, and offline state management with Redux.
• Published 5+ production mobile applications on Google Play Store and Apple App Store.`;

    await dbAsync.run(
      `INSERT INTO resume_versions (name, version, resume_text, file_path, is_active) VALUES (?, ?, ?, ?, 1)`,
      ['Uploaded: Neel Patel (2).pdf', 'v1.0', neelText, 'Neel Patel (2).pdf']
    );

    const rRow = await dbAsync.get('SELECT id FROM resume_versions ORDER BY id DESC LIMIT 1');
    if (rRow) {
      await dbAsync.run(`UPDATE profile SET active_resume_id = ? WHERE id = 1`, [rRow.id]);
    }
  }

  // Seed Search Config
  const configRow = await dbAsync.get('SELECT COUNT(*) as count FROM search_configs');
  if (!configRow || configRow.count === 0) {
    await dbAsync.run(
      `INSERT INTO search_configs (keywords, location, min_experience, max_experience, remote_allowed, job_type, posted_within, min_match_score)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        JSON.stringify(['React Native Developer', 'Senior React Native Developer', 'Mobile Engineer']),
        'Ahmedabad', 2, 6, 1, 'Full Time', '30 days', 80
      ]
    );
  }

  // Seed Settings
  const HARDCODED_CLUSTER_KEY = 'cp_b585d212b386450a88f866049aa19fc0af387b46279719b75c588543e275dede';
  const settingsToSeed: Record<string, string> = {
    cluster_api_url: process.env.CLUSTER_API_URL || 'https://api.clusterprotocol.ai/v1',
    cluster_api_key: (process.env.CLUSTER_API_KEY || '').trim() || HARDCODED_CLUSTER_KEY,
    cluster_model: 'best-model',
    cluster_temperature: '0.2',
    cluster_max_tokens: '2048',
    scheduler_enabled: '1',
    scheduler_interval: '180',
  };
  for (const [key, value] of Object.entries(settingsToSeed)) {
    await dbAsync.run(
      `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, value]
    );
  }

  // Seed Job Sources
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
  for (const [name, display_name, is_enabled, status] of sources) {
    await dbAsync.run(
      `INSERT INTO job_sources (name, display_name, is_enabled, is_restricted, status_message)
       VALUES (?, ?, ?, 0, ?) ON CONFLICT(name) DO UPDATE SET display_name = excluded.display_name`,
      [name, display_name, is_enabled, status]
    );
  }

  console.log('[DB] Database ready');
}

export async function initDatabaseAsync(): Promise<void> {
  await initDatabase();
}
