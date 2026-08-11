/**
 * database.ts - Pure JavaScript / JSON File Storage Adapter
 * 
 * 100% Pure JS file database (`data/db.json`).
 * ZERO native C++ binary compilation issues (No better-sqlite3 / Turso).
 * Guaranteed to work on all Node.js versions (v14, v18, v20, v22) and Vercel!
 */

import path from 'path';
import fs from 'fs';

interface StoreData {
  resume_versions: any[];
  profile: any[];
  search_configs: any[];
  jobs: any[];
  job_analysis: any[];
  applications: any[];
  settings: Record<string, string>;
  logs: any[];
  job_sources: any[];
}

function getStoreFilePath(): string {
  let dataDir = path.resolve(process.cwd(), 'data');
  const isVercel = Boolean(process.env.VERCEL || process.env.NOW_BUILDER);
  if (isVercel) {
    dataDir = '/tmp';
  } else {
    try {
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    } catch {
      dataDir = '/tmp';
    }
  }
  return path.resolve(dataDir, 'db.json');
}

let memoryStore: StoreData | null = null;

function getStore(): StoreData {
  if (!memoryStore) {
    const file = getStoreFilePath();
    if (fs.existsSync(file)) {
      try {
        const raw = fs.readFileSync(file, 'utf-8');
        memoryStore = JSON.parse(raw);
      } catch {}
    }
    if (!memoryStore) {
      memoryStore = {
        resume_versions: [],
        profile: [],
        search_configs: [],
        jobs: [],
        job_analysis: [],
        applications: [],
        settings: {},
        logs: [],
        job_sources: []
      };
    }
  }
  return memoryStore;
}

function saveStore(): void {
  if (!memoryStore) return;
  try {
    fs.writeFileSync(getStoreFilePath(), JSON.stringify(memoryStore, null, 2), 'utf-8');
  } catch (err: any) {
    console.warn('[DB JSON] Storage save warning:', err.message);
  }
}

// ─── Query Evaluator ─────────────────────────────────────────────────────────

function queryGet(sql: string, args: any[] = []): any {
  const store = getStore();
  const cleanSql = sql.trim().replace(/\s+/g, ' ');
  const lower = cleanSql.toLowerCase();

  // SELECT COUNT
  if (lower.includes('count(')) {
    let tableName = 'profile';
    for (const t of Object.keys(store)) {
      if (lower.includes(`from ${t}`)) { tableName = t; break; }
    }
    const list = (store as any)[tableName];
    const len = Array.isArray(list) ? list.length : (list ? Object.keys(list).length : 0);
    return { count: len, c: len };
  }

  // SELECT settings
  if (lower.includes('from settings')) {
    if (lower.includes('where key =')) {
      const key = args[0];
      const val = store.settings[key];
      return val !== undefined ? { key, value: val } : null;
    }
  }

  // SELECT profile
  if (lower.includes('from profile')) {
    return store.profile[0] ?? null;
  }

  // SELECT search_configs
  if (lower.includes('from search_configs')) {
    return store.search_configs[0] ?? null;
  }

  // SELECT resume_versions
  if (lower.includes('from resume_versions')) {
    const match = lower.match(/where id\s*=\s*(\d+|\?)/);
    if (match) {
      const targetId = match[1] === '?' ? args[0] : Number(match[1]);
      return store.resume_versions.find(r => Number(r.id) === Number(targetId)) ?? null;
    }
    if (lower.includes('is_active = 1')) {
      return store.resume_versions.find(r => Number(r.is_active) === 1) || store.resume_versions[0] || null;
    }
    return store.resume_versions[store.resume_versions.length - 1] ?? null;
  }

  // SELECT jobs / job_sources / applications / job_analysis
  for (const t of ['job_sources', 'jobs', 'job_analysis', 'applications', 'logs']) {
    if (lower.includes(`from ${t}`)) {
      const list = (store as any)[t] || [];
      if (args.length > 0 && lower.includes('where')) {
        const found = list.find((item: any) => item.id == args[0] || item.name == args[0]);
        if (found) return found;
      }
      return list[0] ?? null;
    }
  }

  return null;
}

function queryAll(sql: string, args: any[] = []): any[] {
  const store = getStore();
  const lower = sql.trim().replace(/\s+/g, ' ').toLowerCase();

  if (lower.includes('from settings')) {
    return Object.entries(store.settings).map(([key, value]) => ({ key, value }));
  }

  if (lower.includes('from resume_versions')) {
    return [...store.resume_versions].sort((a, b) => (b.is_active || 0) - (a.is_active || 0));
  }

  if (lower.includes('from job_sources')) {
    return store.job_sources;
  }

  if (lower.includes('from jobs')) {
    return store.jobs.map(job => {
      const app = store.applications.find(a => a.job_id === job.id);
      const analysis = store.job_analysis.find(ja => ja.job_id === job.id);
      return {
        ...job,
        status: app ? app.status : 'SAVED',
        match_score: analysis ? analysis.match_score : 0,
        ai_summary: analysis ? analysis.ai_summary : null,
        recommendation: analysis ? analysis.recommendation : 'APPLY'
      };
    });
  }

  if (lower.includes('from applications')) {
    return store.applications;
  }

  if (lower.includes('from logs')) {
    return store.logs;
  }

  if (lower.includes('from profile')) {
    return store.profile;
  }

  if (lower.includes('from search_configs')) {
    return store.search_configs;
  }

  return [];
}

function queryRun(sql: string, args: any[] = []): void {
  const store = getStore();
  const lower = sql.trim().replace(/\s+/g, ' ').toLowerCase();

  if (lower.startsWith('alter table')) return;

  // INSERT INTO settings
  if (lower.includes('into settings')) {
    const key = args[0];
    const value = args[1];
    if (key !== undefined && value !== undefined) {
      store.settings[key] = String(value);
      saveStore();
    }
    return;
  }

  // INSERT INTO profile / UPDATE profile
  if (lower.includes('into profile')) {
    const newProfile = {
      id: 1,
      name: args[0] || 'Candidate Profile',
      primary_role: args[1] || 'Software Developer',
      experience_years: Number(args[2]) || 3.0,
      experience_text: args[3] || '',
      primary_location: args[4] || 'Remote, India',
      preferred_locations: typeof args[5] === 'string' ? args[5] : JSON.stringify(args[5] || []),
      preferred_roles: typeof args[6] === 'string' ? args[6] : JSON.stringify(args[6] || []),
      core_skills: typeof args[7] === 'string' ? args[7] : JSON.stringify(args[7] || []),
      active_resume_id: args[8] ? Number(args[8]) : (store.profile[0]?.active_resume_id || 1),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    store.profile = [newProfile];
    saveStore();
    return;
  }

  if (lower.startsWith('update profile')) {
    if (store.profile.length === 0) store.profile = [{}];
    const p = store.profile[0];

    if (lower.startsWith('update profile set core_skills =')) {
      p.core_skills = typeof args[0] === 'string' ? args[0] : JSON.stringify(args[0]);
    } else if (lower.startsWith('update profile set active_resume_id =')) {
      p.active_resume_id = Number(args[0]);
    } else if (args.length >= 8) {
      if (args[0] !== undefined) p.name = args[0];
      if (args[1] !== undefined) p.primary_role = args[1];
      if (args[2] !== undefined) p.experience_years = Number(args[2]);
      if (args[3] !== undefined) p.experience_text = args[3];
      if (args[4] !== undefined) p.primary_location = args[4];
      if (args[5] !== undefined) p.preferred_locations = typeof args[5] === 'string' ? args[5] : JSON.stringify(args[5]);
      if (args[6] !== undefined) p.preferred_roles = typeof args[6] === 'string' ? args[6] : JSON.stringify(args[6]);
      if (args[7] !== undefined) p.core_skills = typeof args[7] === 'string' ? args[7] : JSON.stringify(args[7]);
      if (args[8] !== undefined) p.active_resume_id = Number(args[8]);
    }
    p.updated_at = new Date().toISOString();
    saveStore();
    return;
  }

  // INSERT INTO search_configs / UPDATE search_configs
  if (lower.includes('into search_configs')) {
    const sc = {
      id: 1,
      keywords: typeof args[0] === 'string' ? args[0] : JSON.stringify(args[0] || []),
      location: args[1] || '',
      min_experience: Number(args[2]) || 0,
      max_experience: Number(args[3]) || 10,
      remote_allowed: args[4] ? 1 : 0,
      job_type: args[5] || 'Full Time',
      posted_within: args[6] || '30 days',
      min_match_score: Number(args[7]) || 80,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    store.search_configs = [sc];
    saveStore();
    return;
  }

  if (lower.startsWith('update search_configs')) {
    if (store.search_configs.length === 0) store.search_configs = [{}];
    const sc = store.search_configs[0];
    if (args[0] !== undefined) sc.keywords = typeof args[0] === 'string' ? args[0] : JSON.stringify(args[0]);
    if (args[1] !== undefined) sc.location = args[1];
    if (args[2] !== undefined) sc.min_experience = Number(args[2]);
    if (args[3] !== undefined) sc.max_experience = Number(args[3]);
    if (args[4] !== undefined) sc.remote_allowed = args[4] ? 1 : 0;
    if (args[5] !== undefined) sc.job_type = args[5];
    if (args[6] !== undefined) sc.posted_within = args[6];
    if (args[7] !== undefined) sc.min_match_score = Number(args[7]);
    sc.updated_at = new Date().toISOString();
    saveStore();
    return;
  }

  // INSERT INTO resume_versions / UPDATE resume_versions
  if (lower.includes('into resume_versions')) {
    const nextId = store.resume_versions.length > 0 ? Math.max(...store.resume_versions.map(r => Number(r.id) || 0)) + 1 : 1;
    const rv = {
      id: nextId,
      name: args[0] || 'Master Resume',
      version: args[1] || 'v1.0',
      resume_text: args[2] || '',
      file_path: args[3] || null,
      is_active: args[4] ? 1 : 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    store.resume_versions.push(rv);
    saveStore();
    return;
  }

  if (lower.startsWith('update resume_versions')) {
    if (lower.includes('is_active = 0') && !lower.includes('where')) {
      store.resume_versions.forEach(r => r.is_active = 0);
    }
    if (lower.includes('is_active = 1')) {
      const match = lower.match(/where id\s*=\s*(\d+|\?)/);
      let targetId: any = null;
      if (match) {
        targetId = match[1] === '?' ? args[0] : Number(match[1]);
      } else if (args.length > 0) {
        targetId = args[0];
      }
      if (targetId !== null && targetId !== undefined) {
        store.resume_versions.forEach(r => {
          r.is_active = Number(r.id) === Number(targetId) ? 1 : 0;
        });
      }
    }
    if (lower.includes('resume_text')) {
      const text = args[0];
      const match = lower.match(/where id\s*=\s*(\d+|\?)/);
      const targetId = match && match[1] !== '?' ? Number(match[1]) : args[1];
      const found = store.resume_versions.find(r => Number(r.id) === Number(targetId));
      if (found) {
        found.resume_text = text;
        found.updated_at = new Date().toISOString();
      }
    }
    saveStore();
    return;
  }

  // INSERT INTO job_sources
  if (lower.includes('into job_sources')) {
    const existing = store.job_sources.find(js => js.name === args[0]);
    if (existing) {
      existing.display_name = args[1];
      existing.is_enabled = args[2];
      existing.status_message = args[3];
    } else {
      store.job_sources.push({
        id: store.job_sources.length + 1,
        name: args[0],
        display_name: args[1],
        is_enabled: args[2],
        is_restricted: 0,
        status_message: args[3]
      });
    }
    saveStore();
    return;
  }

  if (lower.startsWith('update job_sources')) {
    const isEnabled = args[0];
    const name = args[1];
    const found = store.job_sources.find(js => js.name === name);
    if (found) {
      found.is_enabled = isEnabled;
    }
    saveStore();
    return;
  }

  // INSERT INTO logs
  if (lower.includes('into logs')) {
    store.logs.push({
      id: store.logs.length + 1,
      component: args[0] || 'APP',
      event: args[1] || 'EVENT',
      status: args[2] || 'INFO',
      message: args[3] || '',
      created_at: new Date().toISOString()
    });
    saveStore();
    return;
  }
  // DELETE FROM job_analysis
  if (lower.includes('delete from job_analysis')) {
    const appliedJobIds = new Set((store.applications || []).map(a => Number(a.job_id)));
    store.job_analysis = (store.job_analysis || []).filter(ja => appliedJobIds.has(Number(ja.job_id)));
    saveStore();
    return;
  }

  // DELETE FROM jobs
  if (lower.includes('delete from jobs')) {
    const appliedJobIds = new Set((store.applications || []).map(a => Number(a.job_id)));
    store.jobs = (store.jobs || []).filter(j => appliedJobIds.has(Number(j.id)));
    saveStore();
    return;
  }

  // INSERT INTO jobs
  if (lower.includes('into jobs')) {
    const existingIndex = store.jobs.findIndex(j => j.source === args[0] && j.external_id === args[1]);
    const jobObj = {
      id: existingIndex >= 0 ? store.jobs[existingIndex].id : store.jobs.length + 1,
      source: args[0],
      external_id: args[1],
      title: args[2],
      company: args[3],
      location: args[4],
      remote: args[5],
      salary_min: args[6],
      salary_max: args[7],
      salary_currency: args[8],
      experience_min: args[9],
      experience_max: args[10],
      employment_type: args[11],
      description: args[12],
      job_url: args[13],
      company_url: args[14],
      contact_email: args[15],
      posted_date: args[16],
      is_demo: args[17] || 0,
      collected_at: new Date().toISOString()
    };
    if (existingIndex >= 0) store.jobs[existingIndex] = jobObj;
    else store.jobs.push(jobObj);
    saveStore();
    return;
  }

  // INSERT INTO applications / UPDATE applications
  if (lower.includes('into applications')) {
    const existingIndex = store.applications.findIndex(a => a.job_id === args[0]);
    const appObj = {
      id: existingIndex >= 0 ? store.applications[existingIndex].id : store.applications.length + 1,
      job_id: args[0],
      status: args[1] || 'SAVED',
      applied_at: args[2] || null,
      notes: args[3] || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    if (existingIndex >= 0) store.applications[existingIndex] = appObj;
    else store.applications.push(appObj);
    saveStore();
    return;
  }

  if (lower.startsWith('update applications')) {
    const status = args[0];
    const jobId = args[1];
    const found = store.applications.find(a => a.job_id == jobId);
    if (found) {
      found.status = status;
      found.updated_at = new Date().toISOString();
    }
    saveStore();
    return;
  }
}

// ─── Async Database API (Compatibility layer for async routes) ───────────────
export const dbAsync = {
  get: async (sql: string, args: any[] = []): Promise<any> => {
    return queryGet(sql, args);
  },

  all: async (sql: string, args: any[] = []): Promise<any[]> => {
    return queryAll(sql, args);
  },

  run: async (sql: string, args: any[] = []): Promise<void> => {
    queryRun(sql, args);
  },

  batch: async (stmts: Array<string | { sql: string; args?: any[] }>): Promise<void> => {
    for (const s of stmts) {
      if (typeof s === 'string') {
        queryRun(s, []);
      } else {
        queryRun(s.sql, s.args || []);
      }
    }
  }
};

// ─── Synchronous Database API ──────────────────────────────────────────────────
export const db = {
  prepare: (sql: string) => {
    return {
      get: (...args: any[]): any => queryGet(sql, args),
      all: (...args: any[]): any[] => queryAll(sql, args),
      run: (...args: any[]): any => {
        queryRun(sql, args);
        return { changes: 1, lastInsertRowid: 1 };
      }
    };
  },

  exec: (sql: string): void => {
    queryRun(sql, []);
  }
};

// ─── Table Creation & Seeding ─────────────────────────────────────────────────
export async function initDatabase(): Promise<void> {
  console.log('[DB] Initializing Pure JavaScript JSON Database (data/db.json)...');

  // Seed Profile
  try {
    const profileRow = await dbAsync.get('SELECT COUNT(*) as count FROM profile');
    if (!profileRow || profileRow.count === 0) {
      await dbAsync.run(
        `INSERT INTO profile (name, primary_role, experience_years, experience_text, primary_location, preferred_locations, preferred_roles, core_skills, active_resume_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'Candidate Profile', 'Software Developer', 3.0,
          '3+ years professional experience',
          'Remote, India',
          JSON.stringify(['Remote', 'India', 'Worldwide']),
          JSON.stringify(['Software Engineer', 'Full Stack Developer', 'Frontend Developer', 'Backend Engineer']),
          JSON.stringify(['React', 'Node.js', 'TypeScript', 'JavaScript', 'REST API', 'SQL']),
          1
        ]
      );
    }
  } catch (e: any) {
    console.warn('[DB] Profile seed notice:', e.message);
  }

  // Seed Resume Version
  try {
    const resumeCount = await dbAsync.get('SELECT COUNT(*) as count FROM resume_versions');
    if (!resumeCount || resumeCount.count === 0) {
      const candidateText = `Candidate Profile
Software Developer
Remote, India

PROFESSIONAL SUMMARY
Experienced Software Developer skilled in building scalable web and mobile applications. Proficient in React, Node.js, TypeScript, JavaScript, REST APIs, and databases.

CORE TECHNICAL SKILLS
• Languages & Frameworks: React, Node.js, TypeScript, JavaScript, HTML, CSS
• Backend & Cloud: Express, REST APIs, SQL, PostgreSQL, MongoDB, Cloud Services
• Tools & Methodologies: Git, GitHub, Docker, CI/CD, Agile`;

      await dbAsync.run(
        `INSERT INTO resume_versions (name, version, resume_text, file_path, is_active) VALUES (?, ?, ?, ?, 1)`,
        ['Master Resume', 'v1.0', candidateText, null]
      );
    }
  } catch (e: any) {
    console.warn('[DB] Resume seed notice:', e.message);
  }

  // Seed Search Config
  try {
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
  } catch (e: any) {
    console.warn('[DB] Config seed notice:', e.message);
  }

  // Seed Settings
  try {
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
        `INSERT INTO settings (key, value) VALUES (?, ?)`,
        [key, value]
      );
    }
  } catch (e: any) {
    console.warn('[DB] Settings seed notice:', e.message);
  }

  // Seed Job Sources
  try {
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
        `INSERT INTO job_sources (name, display_name, is_enabled, status_message) VALUES (?, ?, ?, ?)`,
        [name, display_name, is_enabled, status]
      );
    }
  } catch (e: any) {
    console.warn('[DB] Sources seed notice:', e.message);
  }

  try {
    const { scannerService } = await import('../services/scanner.service');
    await scannerService.resetToIdle();
  } catch (e) {}

  console.log('[DB] Pure JavaScript JSON Database ready.');
}

export async function initDatabaseAsync(): Promise<void> {
  await initDatabase();
}
