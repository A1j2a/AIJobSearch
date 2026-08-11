import { Request, Response } from 'express';
import { dbAsync } from '../config/database';
import { seedDemoJobs } from '../services/demo-jobs.service';
import { aiProvider } from '../services/ai.service';
import { UserProfile, SearchConfig } from '../../shared/types';

export async function getJobs(req: Request, res: Response) {
  try {
    const { search, min_score, recommendation, source, status } = req.query;

    let query = `
      SELECT j.*, ja.match_score, ja.recommendation, ja.matching_skills, ja.missing_skills, ja.ai_summary, app.status as application_status
      FROM jobs j
      LEFT JOIN job_analysis ja ON j.id = ja.job_id
      LEFT JOIN applications app ON j.id = app.job_id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (search) {
      query += ` AND (j.title LIKE ? OR j.company LIKE ? OR j.description LIKE ? OR j.location LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }
    if (min_score) { query += ` AND ja.match_score >= ?`; params.push(Number(min_score)); }
    if (recommendation) { query += ` AND ja.recommendation = ?`; params.push(String(recommendation)); }
    if (source) { query += ` AND j.source = ?`; params.push(String(source)); }
    if (status) { query += ` AND app.status = ?`; params.push(String(status)); }

    query += ` ORDER BY j.collected_at DESC`;

function parseArraySafe(val: any): any[] {
  if (Array.isArray(val)) return val;
  if (typeof val !== 'string' || !val) return [];
  try {
    const res = JSON.parse(val);
    return Array.isArray(res) ? res : [];
  } catch {
    return [];
  }
}

    const rows = await dbAsync.all(query, params) as any[];
    const jobs = rows.map(r => ({ ...r, remote: Boolean(r.remote), is_demo: Boolean(r.is_demo), matching_skills: parseArraySafe(r.matching_skills), missing_skills: parseArraySafe(r.missing_skills) }));
    return res.json({ jobs, count: jobs.length });
  } catch (error: any) {
    console.error('Error fetching jobs:', error);
    return res.status(500).json({ error: error.message });
  }
}

export async function getJobById(req: Request, res: Response) {
  try {
    const id = req.params.id;
    const row = await dbAsync.get(`
      SELECT j.*, ja.match_score, ja.role_score, ja.skills_score, ja.experience_score, ja.location_score, ja.employment_type_score, ja.salary_score, ja.seniority_score, ja.other_score, ja.matching_skills, ja.missing_skills, ja.required_skills, ja.nice_to_have_skills, ja.ai_summary, ja.recommendation, app.status as application_status, app.notes as application_notes, app.applied_at
      FROM jobs j
      LEFT JOIN job_analysis ja ON j.id = ja.job_id
      LEFT JOIN applications app ON j.id = app.job_id
      WHERE j.id = ?
    `, [id]) as any;

    if (!row) return res.status(404).json({ error: 'Job not found' });

    const job = { ...row, remote: Boolean(row.remote), is_demo: Boolean(row.is_demo), matching_skills: row.matching_skills ? JSON.parse(row.matching_skills) : [], missing_skills: row.missing_skills ? JSON.parse(row.missing_skills) : [], required_skills: row.required_skills ? JSON.parse(row.required_skills) : [], nice_to_have_skills: row.nice_to_have_skills ? JSON.parse(row.nice_to_have_skills) : [] };
    return res.json(job);
  } catch (error: any) {
    console.error('Error fetching job details:', error);
    return res.status(500).json({ error: error.message });
  }
}

export async function triggerSeedDemoJobs(req: Request, res: Response) {
  try {
    const result = await seedDemoJobs();
    return res.json({ success: true, message: `Demo jobs loaded. ${result.added} new jobs added, ${result.skipped} duplicates skipped.`, result });
  } catch (error: any) {
    console.error('Error seeding demo jobs:', error);
    return res.status(500).json({ error: error.message });
  }
}

export async function analyzeJob(req: Request, res: Response) {
  try {
    const jobId = req.params.id;
    const jobRow = await dbAsync.get('SELECT * FROM jobs WHERE id = ?', [jobId]) as any;
    if (!jobRow) return res.status(404).json({ error: 'Job not found' });

    const pRow = await dbAsync.get('SELECT * FROM profile ORDER BY id ASC LIMIT 1') as any;
    const rRow = await dbAsync.get('SELECT * FROM resume_versions WHERE is_active = 1 LIMIT 1') as any;
    const sRow = await dbAsync.get('SELECT * FROM search_configs ORDER BY id ASC LIMIT 1') as any;

    const profile: UserProfile = { ...pRow, preferred_locations: JSON.parse(pRow.preferred_locations || '[]'), preferred_roles: JSON.parse(pRow.preferred_roles || '[]'), core_skills: JSON.parse(pRow.core_skills || '[]') };
    const searchConfig: SearchConfig = { ...sRow, keywords: JSON.parse(sRow.keywords || '[]'), remote_allowed: Boolean(sRow.remote_allowed) };
    const resumeText = rRow ? rRow.resume_text : '';

    const analysis = await aiProvider.analyzeJob(jobRow, profile, searchConfig, resumeText);

    await dbAsync.run(
      `INSERT OR REPLACE INTO job_analysis (job_id, match_score, role_score, skills_score, experience_score, location_score, employment_type_score, salary_score, seniority_score, other_score, matching_skills, missing_skills, required_skills, nice_to_have_skills, ai_summary, recommendation, analyzed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [jobId, analysis.matchScore, analysis.scoreBreakdown?.roleScore || 0, analysis.scoreBreakdown?.skillsScore || 0, analysis.scoreBreakdown?.experienceScore || 0, analysis.scoreBreakdown?.locationScore || 0, analysis.scoreBreakdown?.employmentTypeScore || 0, analysis.scoreBreakdown?.salaryScore || 0, analysis.scoreBreakdown?.seniorityScore || 0, analysis.scoreBreakdown?.otherScore || 0, JSON.stringify(analysis.matchingSkills), JSON.stringify(analysis.missingSkills), JSON.stringify(analysis.requiredSkills), JSON.stringify(analysis.niceToHaveSkills), analysis.reason, analysis.recommendation]
    );

    return res.json({ success: true, analysis });
  } catch (error: any) {
    console.error('Error analyzing job:', error);
    return res.status(500).json({ error: error.message });
  }
}

export async function getDashboardStats(req: Request, res: Response) {
  try {
    const [newJobsRow, analyzedRow, strongRow, applicationsRow, interviewsRow] = await Promise.all([
      dbAsync.get('SELECT COUNT(*) as count FROM jobs') as any,
      dbAsync.get('SELECT COUNT(*) as count FROM job_analysis') as any,
      dbAsync.get('SELECT COUNT(*) as count FROM job_analysis WHERE match_score >= 80') as any,
      dbAsync.get("SELECT COUNT(*) as count FROM applications WHERE status != 'Saved'") as any,
      dbAsync.get("SELECT COUNT(*) as count FROM applications WHERE status IN ('Interview', 'Technical Round', 'HR Round')") as any,
    ]);

    return res.json({
      new_jobs: (newJobsRow as any)?.count || 0,
      jobs_analyzed: (analyzedRow as any)?.count || 0,
      strong_matches: (strongRow as any)?.count || 0,
      applications: (applicationsRow as any)?.count || 0,
      interviews: (interviewsRow as any)?.count || 0
    });
  } catch (error: any) {
    console.error('Error fetching dashboard stats:', error);
    return res.status(500).json({ error: error.message });
  }
}

export async function getLogs(req: Request, res: Response) {
  try {
    const rows = await dbAsync.all('SELECT * FROM logs ORDER BY created_at DESC LIMIT 100');
    return res.json(rows);
  } catch (error: any) {
    console.error('Error fetching logs:', error);
    return res.status(500).json({ error: error.message });
  }
}

export async function clearLogs(req: Request, res: Response) {
  try {
    await dbAsync.run('DELETE FROM logs', []);
    await dbAsync.run(`INSERT INTO logs (component, event, status, message) VALUES (?, ?, ?, ?)`, ['LOGS', 'CLEAR_LOGS', 'INFO', 'System logs cleared by user.']);
    return res.json({ success: true, message: 'Logs cleared successfully' });
  } catch (error: any) {
    console.error('Error clearing logs:', error);
    return res.status(500).json({ error: error.message });
  }
}

export async function updateApplicationStatus(req: Request, res: Response) {
  try {
    const { jobId, status, notes } = req.body;
    if (!jobId) return res.status(400).json({ error: 'Job ID is required' });

    const newStatus = status || 'Saved';

    await dbAsync.run(
      `INSERT INTO applications (job_id, status, applied_at, notes, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(job_id) DO UPDATE SET status=excluded.status, notes=excluded.notes, updated_at=CURRENT_TIMESTAMP`,
      [jobId, newStatus, notes || null]
    );

    await dbAsync.run(`INSERT INTO logs (component, event, status, message) VALUES (?, ?, ?, ?)`, ['APPLICATIONS', 'STATUS_UPDATE', 'INFO', `Job ID ${jobId} application status set to ${newStatus}.`]);
    return res.json({ success: true, jobId, status: newStatus, message: `Job saved as ${newStatus}!` });
  } catch (error: any) {
    console.error('Error updating application status:', error);
    return res.status(500).json({ error: error.message });
  }
}

export async function getApplications(req: Request, res: Response) {
  try {
    const rows = await dbAsync.all(`
      SELECT j.*, ja.match_score, ja.recommendation, ja.matching_skills, ja.missing_skills, ja.ai_summary, app.status as application_status, app.notes as application_notes, app.applied_at
      FROM applications app
      JOIN jobs j ON app.job_id = j.id
      LEFT JOIN job_analysis ja ON j.id = ja.job_id
      ORDER BY app.updated_at DESC
    `) as any[];

    const applications = rows.map(r => ({ ...r, remote: Boolean(r.remote), is_demo: Boolean(r.is_demo), matching_skills: r.matching_skills ? JSON.parse(r.matching_skills) : [], missing_skills: r.missing_skills ? JSON.parse(r.missing_skills) : [] }));
    return res.json({ applications, count: applications.length });
  } catch (error: any) {
    console.error('Error fetching applications:', error);
    return res.status(500).json({ error: error.message });
  }
}
