import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// On Vercel serverless environment, use /tmp writable directory for SQLite database storage
const dataDir = process.env.VERCEL ? '/tmp' : path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
  } catch (e) {}
}

const dbPath = path.resolve(dataDir, 'jobsearch.db');
export const sqliteDb = new Database(dbPath);

try {
  sqliteDb.pragma('journal_mode = WAL');
} catch (e) {}

// Unified Database Abstraction
export const db = {
  prepare: (sql: string) => {
    return sqliteDb.prepare(sql);
  },
  exec: (sql: string) => {
    return sqliteDb.exec(sql);
  }
};

export function initDatabase() {
  console.log(`[DB] Initializing SQLite database at ${dbPath}...`);

  // 1. Resume Versions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS resume_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      version TEXT NOT NULL,
      resume_text TEXT NOT NULL,
      file_path TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Profile table
  db.exec(`
    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      primary_role TEXT NOT NULL,
      experience_years REAL DEFAULT 3.0,
      experience_text TEXT,
      primary_location TEXT NOT NULL,
      preferred_locations TEXT NOT NULL,
      preferred_roles TEXT NOT NULL,
      core_skills TEXT NOT NULL,
      active_resume_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (active_resume_id) REFERENCES resume_versions(id) ON DELETE SET NULL
    );
  `);

  // 3. Search Configs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS search_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keywords TEXT NOT NULL,
      location TEXT NOT NULL,
      min_experience REAL DEFAULT 3,
      max_experience REAL DEFAULT 5,
      remote_allowed INTEGER DEFAULT 1,
      job_type TEXT DEFAULT 'Full Time',
      posted_within TEXT DEFAULT '30 days',
      min_match_score INTEGER DEFAULT 80,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 4. Jobs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      external_id TEXT,
      title TEXT NOT NULL,
      company TEXT NOT NULL,
      location TEXT NOT NULL,
      remote INTEGER DEFAULT 0,
      salary_min REAL,
      salary_max REAL,
      salary_currency TEXT DEFAULT 'USD',
      experience_min REAL,
      experience_max REAL,
      employment_type TEXT DEFAULT 'Full Time',
      description TEXT NOT NULL,
      job_url TEXT NOT NULL,
      company_url TEXT,
      contact_email TEXT,
      posted_date TEXT,
      is_demo INTEGER DEFAULT 0,
      collected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(source, external_id)
    );
  `);

  // 5. Job Analysis table
  db.exec(`
    CREATE TABLE IF NOT EXISTS job_analysis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER UNIQUE NOT NULL,
      match_score INTEGER NOT NULL,
      role_score INTEGER DEFAULT 0,
      skills_score INTEGER DEFAULT 0,
      experience_score INTEGER DEFAULT 0,
      location_score INTEGER DEFAULT 0,
      employment_type_score INTEGER DEFAULT 0,
      salary_score INTEGER DEFAULT 0,
      seniority_score INTEGER DEFAULT 0,
      other_score INTEGER DEFAULT 0,
      matching_skills TEXT,
      missing_skills TEXT,
      required_skills TEXT,
      nice_to_have_skills TEXT,
      ai_summary TEXT,
      recommendation TEXT CHECK(recommendation IN ('APPLY', 'MAYBE', 'SKIP')),
      analyzed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
    );
  `);

  // 6. Applications table
  db.exec(`
    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL,
      status TEXT CHECK(status IN ('DISCOVERED', 'ANALYZED', 'SAVED', 'APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED')) DEFAULT 'SAVED',
      applied_at DATETIME,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
    );
  `);

  // 7. Settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 8. Logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      component TEXT NOT NULL,
      event TEXT NOT NULL,
      status TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 9. Job Sources table
  db.exec(`
    CREATE TABLE IF NOT EXISTS job_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      is_enabled INTEGER DEFAULT 1,
      is_restricted INTEGER DEFAULT 0,
      status_message TEXT
    );
  `);

  try {
    db.exec("ALTER TABLE job_sources ADD COLUMN is_restricted INTEGER DEFAULT 0;");
  } catch (e) {}

  try {
    db.exec("ALTER TABLE job_sources ADD COLUMN status_message TEXT;");
  } catch (e) {}

  // Seed default Profile if empty
  const profileCount = db.prepare('SELECT COUNT(*) as count FROM profile').get() as { count: number };
  if (!profileCount || profileCount.count === 0) {
    db.prepare(`
      INSERT INTO profile (
        name, primary_role, experience_years, experience_text, primary_location,
        preferred_locations, preferred_roles, core_skills
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'Ajay Patidar',
      'React Native Developer',
      4.0,
      '4 years in React Native, Mobile Apps & Fullstack Systems',
      'Ahmedabad, India',
      JSON.stringify(['Ahmedabad', 'Remote', 'India', 'Worldwide']),
      JSON.stringify(['React Native Developer', 'Senior React Native Developer', 'Mobile Engineer', 'Frontend Developer']),
      JSON.stringify(['React Native', 'React.js', 'TypeScript', 'JavaScript', 'Redux', 'REST API', 'Node.js', 'iOS', 'Android'])
    );
  }

  // Seed default Search Config if empty
  const configCount = db.prepare('SELECT COUNT(*) as count FROM search_configs').get() as { count: number };
  if (!configCount || configCount.count === 0) {
    db.prepare(`
      INSERT INTO search_configs (
        keywords, location, min_experience, max_experience, remote_allowed,
        job_type, posted_within, min_match_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      JSON.stringify(['React Native Developer', 'Senior React Native Developer', 'Mobile Engineer']),
      'Ahmedabad',
      2,
      6,
      1,
      'Full Time',
      '30 days',
      80
    );
  }

  // Seed Default App Settings
  const HARDCODED_CLUSTER_KEY = 'cp_b585d212b386450a88f866049aa19fc0af387b46279719b75c588543e275dede';
  const defaultSettingsMap: Record<string, string> = {
    cluster_api_url: process.env.CLUSTER_API_URL || 'https://api.clusterprotocol.ai/v1',
    cluster_api_key: (process.env.CLUSTER_API_KEY || '').trim() || HARDCODED_CLUSTER_KEY,
    cluster_model: 'best-model',
    cluster_temperature: '0.2',
    cluster_max_tokens: '2048',
    scheduler_enabled: '1',
    scheduler_interval: '180'
  };

  const insertSetting = db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);

  for (const [key, value] of Object.entries(defaultSettingsMap)) {
    insertSetting.run(key, value);
  }

  // Seed Job Sources
  const defaultSources = [
    { name: 'linkedin', display_name: 'LinkedIn Jobs (Guest Search)', is_enabled: 1, status: 'ACTIVE' },
    { name: 'naukri', display_name: 'Naukri & Indeed Public Feeds', is_enabled: 1, status: 'ACTIVE' },
    { name: 'india_local_jobs', display_name: 'Global & Regional Public Feeds', is_enabled: 1, status: 'ACTIVE' },
    { name: 'greenhouse', display_name: 'Greenhouse Career Boards', is_enabled: 1, status: 'ACTIVE' },
    { name: 'arbeitnow', display_name: 'Arbeitnow Tech Jobs', is_enabled: 1, status: 'ACTIVE' },
    { name: 'hackernews', display_name: 'HackerNews Jobs', is_enabled: 1, status: 'ACTIVE' },
    { name: 'global_jobs', display_name: 'Global Jobs Aggregator', is_enabled: 1, status: 'ACTIVE' },
    { name: 'remotive', display_name: 'Remotive Public API', is_enabled: 1, status: 'ACTIVE' },
    { name: 'jobicy', display_name: 'Jobicy Engineering API', is_enabled: 1, status: 'ACTIVE' },
    { name: 'weworkremotely', display_name: 'We Work Remotely RSS', is_enabled: 1, status: 'ACTIVE' },
    { name: 'remoteok', display_name: 'RemoteOK Engineering API', is_enabled: 1, status: 'ACTIVE' }
  ];

  const insertSource = db.prepare(`
    INSERT INTO job_sources (name, display_name, is_enabled, is_restricted, status_message)
    VALUES (?, ?, ?, 0, ?)
    ON CONFLICT(name) DO UPDATE SET display_name = excluded.display_name
  `);

  for (const src of defaultSources) {
    insertSource.run(src.name, src.display_name, src.is_enabled, src.status);
  }
}
