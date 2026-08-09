import { Request, Response } from 'express';
import { dbAsync } from '../config/database.js';
import { SearchConfig } from '../../shared/types.js';

export async function getSearchConfig(req: Request, res: Response) {
  try {
    let row = await dbAsync.get('SELECT * FROM search_configs ORDER BY id ASC LIMIT 1') as any;
    if (!row) {
      await dbAsync.run(
        `INSERT INTO search_configs (keywords, location, min_experience, max_experience, remote_allowed, job_type, posted_within, min_match_score)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [JSON.stringify(['React Native Developer', 'Senior React Native Developer', 'Mobile Engineer']), 'Ahmedabad', 2, 6, 1, 'Full Time', '30 days', 80]
      );
      row = await dbAsync.get('SELECT * FROM search_configs ORDER BY id ASC LIMIT 1');
    }

    const config: SearchConfig = {
      id: row.id,
      keywords: JSON.parse(row.keywords || '[]'),
      location: row.location,
      min_experience: row.min_experience,
      max_experience: row.max_experience,
      remote_allowed: Boolean(row.remote_allowed),
      job_type: row.job_type,
      posted_within: row.posted_within,
      min_match_score: row.min_match_score,
      created_at: row.created_at
    };

    return res.json(config);
  } catch (error: any) {
    console.error('Error fetching search config:', error);
    return res.status(500).json({ error: error.message });
  }
}

export async function updateSearchConfig(req: Request, res: Response) {
  try {
    const { keywords, location, min_experience, max_experience, remote_allowed, job_type, posted_within, min_match_score } = req.body;

    const existing = await dbAsync.get('SELECT id FROM search_configs ORDER BY id ASC LIMIT 1') as any;

    if (!existing) {
      await dbAsync.run(
        `INSERT INTO search_configs (keywords, location, min_experience, max_experience, remote_allowed, job_type, posted_within, min_match_score)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [JSON.stringify(keywords || []), location, min_experience, max_experience, remote_allowed ? 1 : 0, job_type, posted_within, min_match_score]
      );
    } else {
      await dbAsync.run(
        `UPDATE search_configs SET keywords=?, location=?, min_experience=?, max_experience=?, remote_allowed=?, job_type=?, posted_within=?, min_match_score=? WHERE id=?`,
        [JSON.stringify(keywords || []), location, min_experience, max_experience, remote_allowed ? 1 : 0, job_type, posted_within, min_match_score, existing.id]
      );
    }

    await dbAsync.run(`INSERT INTO logs (component, event, status, message) VALUES (?, ?, ?, ?)`,
      ['SEARCH_CONFIG', 'UPDATE_SEARCH_CONFIG', 'SUCCESS', 'Search parameters updated.']);

    return res.json({ success: true, message: 'Search configuration updated successfully' });
  } catch (error: any) {
    console.error('Error updating search config:', error);
    return res.status(500).json({ error: error.message });
  }
}
