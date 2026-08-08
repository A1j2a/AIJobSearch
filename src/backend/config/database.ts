import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.resolve(dataDir, 'jobsearch.db');
export const db = new Database(dbPath);

// Enable WAL mode for high performance and concurrent read/write support
db.pragma('journal_mode = WAL');

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
      posted_within TEXT DEFAULT '7 days',
      min_match_score REAL DEFAULT 80,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 4. Settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 5. Jobs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      external_id TEXT NOT NULL,
      title TEXT NOT NULL,
      company TEXT NOT NULL,
      location TEXT NOT NULL,
      remote INTEGER DEFAULT 0,
      salary_min REAL,
      salary_max REAL,
      salary_currency TEXT DEFAULT 'INR',
      experience_min REAL,
      experience_max REAL,
      employment_type TEXT,
      description TEXT NOT NULL,
      job_url TEXT NOT NULL,
      company_url TEXT,
      posted_date TEXT,
      collected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_demo INTEGER DEFAULT 0,
      UNIQUE(source, external_id)
    );
  `);

  // 6. Job Analysis table with Hybrid Score fields
  db.exec(`
    CREATE TABLE IF NOT EXISTS job_analysis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER UNIQUE NOT NULL,
      match_score REAL NOT NULL,
      role_score REAL DEFAULT 0,
      skills_score REAL DEFAULT 0,
      experience_score REAL DEFAULT 0,
      location_score REAL DEFAULT 0,
      employment_type_score REAL DEFAULT 0,
      salary_score REAL DEFAULT 0,
      seniority_score REAL DEFAULT 0,
      other_score REAL DEFAULT 0,
      matching_skills TEXT,
      missing_skills TEXT,
      required_skills TEXT,
      nice_to_have_skills TEXT,
      ai_summary TEXT,
      recommendation TEXT,
      analyzed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
    );
  `);

  // Column migration for pre-existing SQLite database
  migrateJobAnalysisColumns();

  // 7. Applications table
  db.exec(`
    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'Saved',
      applied_at DATETIME,
      resume_version TEXT,
      recruiter_name TEXT,
      recruiter_url TEXT,
      notes TEXT,
      follow_up_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
    );
  `);

  // 8. Job Sources table
  db.exec(`
    CREATE TABLE IF NOT EXISTS job_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      is_enabled INTEGER DEFAULT 1,
      status TEXT DEFAULT 'ACTIVE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 9. Logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      component TEXT NOT NULL,
      event TEXT NOT NULL,
      status TEXT NOT NULL,
      message TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  seedDefaultData();
  console.log('[DB] Database schema migration and initialization complete.');
}

function migrateJobAnalysisColumns() {
  try {
    // 1. Migrate job_analysis table
    const columns = db.prepare("PRAGMA table_info(job_analysis)").all() as { name: string }[];
    const columnNames = columns.map(c => c.name);

    const requiredColumns = [
      'employment_type_score',
      'salary_score',
      'seniority_score',
      'other_score'
    ];

    for (const col of requiredColumns) {
      if (!columnNames.includes(col)) {
        console.log(`[DB] Migrating job_analysis: adding column ${col}`);
        db.exec(`ALTER TABLE job_analysis ADD COLUMN ${col} REAL DEFAULT 0`);
      }
    }

    // 2. Migrate profile table
    const profileCols = db.prepare("PRAGMA table_info(profile)").all() as { name: string }[];
    const profileColNames = profileCols.map(c => c.name);
    if (!profileColNames.includes('active_resume_id')) {
      console.log('[DB] Migrating profile: adding column active_resume_id');
      db.exec('ALTER TABLE profile ADD COLUMN active_resume_id INTEGER');
    }
    // 3. Migrate jobs table
    const jobCols = db.prepare("PRAGMA table_info(jobs)").all() as { name: string }[];
    const jobColNames = jobCols.map(c => c.name);
    if (!jobColNames.includes('contact_email')) {
      console.log('[DB] Migrating jobs: adding column contact_email');
      db.exec('ALTER TABLE jobs ADD COLUMN contact_email TEXT');
    }
  } catch (err: any) {
    console.error('[DB] Column migration error:', err.message);
  }
}

function seedDefaultData() {
  // Seed Master Resume Version if empty
  const resumeCount = db.prepare('SELECT COUNT(*) as count FROM resume_versions').get() as { count: number };
  let activeResumeId = 1;

  if (resumeCount.count === 0) {
    const resumeText = `Ajay Patidar - Senior React Native & Cross-Platform Mobile Engineer
3+ Years Professional IT Experience | Primary Location: Ahmedabad, Gujarat, India

SUMMARY:
Results-driven React Native Developer with over 3 years of experience building high-performance cross-platform Android and iOS applications using React Native CLI, Expo, TypeScript, and Firebase. Proven expertise in integrating payment gateways (Razorpay, Stripe), Shopify app ecosystem, state management (Redux), RESTful APIs, CI/CD pipelines, and Play Store / App Store publishing.

CORE TECHNICAL SKILLS:
- Mobile Development: React Native, React Native CLI, Expo, Android (Java/Kotlin basics), iOS (Swift basics), Redux Toolkit
- Programming Languages: JavaScript (ES6+), TypeScript
- Backend & Cloud Services: Firebase, Authentication, FCM Push Notifications, Supabase, Laravel, REST APIs, AWS
- E-Commerce & Payments: Shopify App Development, Razorpay Integration, Stripe Integration
- Database & Version Control: MySQL, Supabase, Git, GitHub
- App Publishing & Tools: Play Store Console, App Store Connect, CI/CD Pipelines`;

    const res = db.prepare(`
      INSERT INTO resume_versions (name, version, resume_text, is_active)
      VALUES (?, ?, ?, 1)
    `).run('Master Resume 2026', 'v1.0', resumeText);
    activeResumeId = Number(res.lastInsertRowid);
  }

  // Seed Profile if empty
  const profileCount = db.prepare('SELECT COUNT(*) as count FROM profile').get() as { count: number };
  if (profileCount.count === 0) {
    const defaultProfile = {
      name: 'Ajay Patidar',
      primary_role: 'React Native Developer',
      experience_years: 3.0,
      experience_text: '3+ years professional IT experience',
      primary_location: 'Ahmedabad, Gujarat, India',
      preferred_locations: JSON.stringify(['Ahmedabad', 'Gandhinagar', 'Remote - India']),
      preferred_roles: JSON.stringify([
        'React Native Developer',
        'React Native Engineer',
        'Mobile App Developer',
        'Mobile Application Developer',
        'React Developer - Mobile',
        'Cross Platform Mobile Developer',
        'React Native + TypeScript Developer'
      ]),
      core_skills: JSON.stringify([
        'React Native',
        'React Native CLI',
        'Expo',
        'JavaScript',
        'TypeScript',
        'React',
        'REST APIs',
        'Firebase',
        'Firebase Authentication',
        'Firebase Cloud Messaging',
        'Shopify',
        'Shopify App Development',
        'Payment Gateway Integration',
        'Razorpay',
        'Stripe',
        'Android',
        'iOS',
        'Redux',
        'Git',
        'GitHub',
        'Laravel',
        'MySQL',
        'Supabase',
        'AWS',
        'CI/CD',
        'Play Store Publishing',
        'App Store Publishing'
      ]),
      active_resume_id: activeResumeId
    };

    db.prepare(`
      INSERT INTO profile (
        name, primary_role, experience_years, experience_text, primary_location,
        preferred_locations, preferred_roles, core_skills, active_resume_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      defaultProfile.name,
      defaultProfile.primary_role,
      defaultProfile.experience_years,
      defaultProfile.experience_text,
      defaultProfile.primary_location,
      defaultProfile.preferred_locations,
      defaultProfile.preferred_roles,
      defaultProfile.core_skills,
      defaultProfile.active_resume_id
    );
  }

  // Seed Search Config if empty
  const searchCount = db.prepare('SELECT COUNT(*) as count FROM search_configs').get() as { count: number };
  if (searchCount.count === 0) {
    const defaultKeywords = JSON.stringify([
      'React Native Developer',
      'React Native Engineer',
      'React Native Developer TypeScript',
      'Mobile App Developer React Native',
      'React Native Firebase',
      'React Native Shopify',
      'React Developer Mobile'
    ]);

    db.prepare(`
      INSERT INTO search_configs (
        keywords, location, min_experience, max_experience, remote_allowed, job_type, posted_within, min_match_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(defaultKeywords, 'Ahmedabad', 3, 5, 1, 'Full Time', '7 days', 80);
  }

  // Seed Default Settings
  const defaultSettingsMap: Record<string, string> = {
    ollama_url: 'http://localhost:11434',
    ollama_model: 'qwen2.5:1.5b',
    ollama_temperature: '0.2',
    ollama_max_tokens: '2048',
    telegram_bot_token: '',
    telegram_chat_id: '',
    telegram_min_score: '85',
    scheduler_enabled: '0',
    scheduler_interval: '180'
  };

  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [key, value] of Object.entries(defaultSettingsMap)) {
    insertSetting.run(key, value);
  }

  // Seed Job Sources
  const defaultSources = [
    { name: 'public_careers', display_name: 'Company Career Pages', is_enabled: 1, status: 'ACTIVE' },
    { name: 'greenhouse', display_name: 'Greenhouse Public Jobs', is_enabled: 1, status: 'ACTIVE' },
    { name: 'lever', display_name: 'Lever Public Jobs', is_enabled: 1, status: 'ACTIVE' },
    { name: 'linkedin', display_name: 'LinkedIn (Public)', is_enabled: 0, status: 'SOURCE_REQUIRES_MANUAL_ACCESS' },
    { name: 'naukri', display_name: 'Naukri', is_enabled: 0, status: 'SOURCE_REQUIRES_MANUAL_ACCESS' },
    { name: 'indeed', display_name: 'Indeed', is_enabled: 0, status: 'SOURCE_REQUIRES_MANUAL_ACCESS' },
    { name: 'wellfound', display_name: 'Wellfound (AngelList)', is_enabled: 0, status: 'SOURCE_REQUIRES_MANUAL_ACCESS' },
    { name: 'hirist', display_name: 'Hirist', is_enabled: 0, status: 'SOURCE_REQUIRES_MANUAL_ACCESS' }
  ];

  const insertSource = db.prepare('INSERT OR IGNORE INTO job_sources (name, display_name, is_enabled, status) VALUES (?, ?, ?, ?)');
  for (const s of defaultSources) {
    insertSource.run(s.name, s.display_name, s.is_enabled, s.status);
  }
}
