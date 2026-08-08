import { Request, Response } from 'express';
import { db } from '../config/database.js';
import { SearchConfig } from '../../shared/types.js';

export function getSearchConfig(req: Request, res: Response) {
  try {
    const row = db.prepare('SELECT * FROM search_configs ORDER BY id ASC LIMIT 1').get() as any;
    if (!row) {
      return res.status(404).json({ error: 'Search config not found' });
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

export function updateSearchConfig(req: Request, res: Response) {
  try {
    const {
      keywords,
      location,
      min_experience,
      max_experience,
      remote_allowed,
      job_type,
      posted_within,
      min_match_score
    } = req.body;

    const existing = db.prepare('SELECT id FROM search_configs ORDER BY id ASC LIMIT 1').get() as any;

    if (!existing) {
      db.prepare(`
        INSERT INTO search_configs (
          keywords, location, min_experience, max_experience, remote_allowed, job_type, posted_within, min_match_score
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        JSON.stringify(keywords || []),
        location,
        min_experience,
        max_experience,
        remote_allowed ? 1 : 0,
        job_type,
        posted_within,
        min_match_score
      );
    } else {
      db.prepare(`
        UPDATE search_configs SET
          keywords = ?,
          location = ?,
          min_experience = ?,
          max_experience = ?,
          remote_allowed = ?,
          job_type = ?,
          posted_within = ?,
          min_match_score = ?
        WHERE id = ?
      `).run(
        JSON.stringify(keywords || []),
        location,
        min_experience,
        max_experience,
        remote_allowed ? 1 : 0,
        job_type,
        posted_within,
        min_match_score,
        existing.id
      );
    }

    db.prepare(`
      INSERT INTO logs (component, event, status, message)
      VALUES (?, ?, ?, ?)
    `).run('SEARCH_CONFIG', 'UPDATE_SEARCH_CONFIG', 'SUCCESS', 'Search parameters updated.');

    return res.json({ success: true, message: 'Search configuration updated successfully' });
  } catch (error: any) {
    console.error('Error updating search config:', error);
    return res.status(500).json({ error: error.message });
  }
}
