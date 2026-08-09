import { Request, Response } from 'express';
import { dbAsync } from '../config/database';
import { UserProfile, ResumeVersion } from '../../shared/types';
import fs from 'fs';
import path from 'path';

function resolvePdfPath(targetPath: string): string | null {
  if (!targetPath) return null;
  if (fs.existsSync(targetPath)) return targetPath;
  const fileName = path.basename(targetPath);
  const downloadsPath = path.join('/Users/ajaypatidar/Downloads', fileName);
  if (fs.existsSync(downloadsPath)) return downloadsPath;
  const desktopPath = path.join('/Users/ajaypatidar/Desktop', fileName);
  if (fs.existsSync(desktopPath)) return desktopPath;
  const cwdPath = path.resolve(process.cwd(), targetPath);
  if (fs.existsSync(cwdPath)) return cwdPath;
  const dataPath = path.resolve(process.cwd(), 'data', fileName);
  if (fs.existsSync(dataPath)) return dataPath;
  return null;
}

export function parseProfileFromResumeText(resumeText: string, resumeTitle?: string) {
  const lines = resumeText.split('\n').map(l => l.trim()).filter(Boolean);

  let name = 'Candidate Profile';
  for (const line of lines) {
    const isLocationLine = ['india', 'ahmedabad', 'gujar', 'usa', 'street', 'road', 'mumbai', 'bangalore', 'pune', 'delhi', 'hyderabad', 'noida', 'remote'].some(loc => line.toLowerCase().includes(loc));
    if (!isLocationLine && !line.includes('@') && !line.toLowerCase().includes('http') && line.length < 40 && !line.toUpperCase().includes('RESUME')) {
      const cleanName = line.replace(/[^a-zA-Z\s.]/g, '').trim();
      if (cleanName.length > 2 && cleanName.toLowerCase() !== 'candidate profile' && cleanName.toLowerCase() !== 'software developer') {
        name = cleanName;
        break;
      }
    }
  }

  // Fallback or override if title contains a candidate name (e.g. "Uploaded: Candidate Resume.pdf")
  if (resumeTitle) {
    const base = resumeTitle.replace(/^Uploaded:\s*/i, '').replace(/\.[^/.]+$/, '').replace(/[\d()_-]/g, ' ').trim();
    const words = base.split(/\s+/).filter(w => w.length > 1 && !['resume', 'cv', 'v1', 'v2', 'v3', 'final', 'updated', 'pdf', 'doc', 'docx'].includes(w.toLowerCase()));
    if (words.length >= 1) {
      const derivedName = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      if (name === 'Candidate Profile' || derivedName.length > name.length) {
        name = derivedName;
      }
    }
  }

  let primary_role = 'Software Developer';
  for (let i = 0; i < Math.min(8, lines.length); i++) {
    const l = lines[i];
    if (l.toLowerCase().includes('engineer') || l.toLowerCase().includes('developer') || l.toLowerCase().includes('architect') || l.toLowerCase().includes('lead') || l.toLowerCase().includes('manager')) {
      const parts = l.split(/[|•,\-]/);
      const cleanRole = parts[0].replace(/[^a-zA-Z\s]/g, '').trim();
      if (cleanRole.length > 3) {
        primary_role = cleanRole;
        break;
      }
    }
  }

  const expMatch = resumeText.match(/(\d+\.?\d*)\+?\s*years?/i);
  const experience_years = expMatch ? parseFloat(expMatch[1]) : 3.0;
  const experience_text = `${experience_years}+ years professional experience`;

  const cities = ['Ahmedabad', 'Pune', 'Bangalore', 'Bengaluru', 'Mumbai', 'Delhi', 'Hyderabad', 'Gurgaon', 'Noida', 'Gandhinagar', 'Chennai', 'Kolkata', 'Remote'];
  let primary_location = 'Remote, India';
  for (const city of cities) {
    if (new RegExp('\\b' + city + '\\b', 'i').test(resumeText)) { primary_location = `${city}, India`; break; }
  }

  const knownSkills = ['Node.js', 'Express', 'React', 'React Native', 'TypeScript', 'JavaScript', 'Python', 'Go', 'Java', 'C++', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'SQLite', 'Supabase', 'Firebase', 'Docker', 'Kubernetes', 'AWS', 'GCP', 'Azure', 'Microservices', 'REST APIs', 'GraphQL', 'CI/CD', 'Git', 'GitHub', 'System Design', 'Kafka', 'RabbitMQ', 'Redux', 'Zustand', 'Expo', 'Laravel', 'Shopify'];
  const core_skills = knownSkills.filter(s => new RegExp('\\b' + s.replace('+', '\\+') + '\\b', 'i').test(resumeText));
  if (core_skills.length === 0) core_skills.push('Software Engineering', 'JavaScript', 'TypeScript');

  const roleParts = primary_role.split(/[|•,\-]/).map(p => p.trim()).filter(Boolean);
  const preferred_roles = Array.from(new Set([primary_role, ...roleParts, primary_role.includes('Senior') ? primary_role.replace(/Senior/gi, '').trim() : `Senior ${primary_role}`])).filter(Boolean);
  const preferred_locations = Array.from(new Set([primary_location.split(',')[0].trim(), 'Remote - India']));

  return { name, primary_role, experience_years, experience_text, primary_location, preferred_locations, preferred_roles, core_skills };
}

export async function syncProfileWithResume(resumeText: string, activeResumeId: number, resumeTitle?: string) {
  try {
    const parsed = parseProfileFromResumeText(resumeText, resumeTitle);
    const existing = await dbAsync.get('SELECT id FROM profile ORDER BY id ASC LIMIT 1') as any;

    if (existing) {
      await dbAsync.run(
        `UPDATE profile SET name=?, primary_role=?, experience_years=?, experience_text=?, primary_location=?, preferred_locations=?, preferred_roles=?, core_skills=?, active_resume_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
        [parsed.name, parsed.primary_role, parsed.experience_years, parsed.experience_text, parsed.primary_location, JSON.stringify(parsed.preferred_locations), JSON.stringify(parsed.preferred_roles), JSON.stringify(parsed.core_skills), activeResumeId, existing.id]
      );
    } else {
      await dbAsync.run(
        `INSERT INTO profile (name, primary_role, experience_years, experience_text, primary_location, preferred_locations, preferred_roles, core_skills, active_resume_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [parsed.name, parsed.primary_role, parsed.experience_years, parsed.experience_text, parsed.primary_location, JSON.stringify(parsed.preferred_locations), JSON.stringify(parsed.preferred_roles), JSON.stringify(parsed.core_skills), activeResumeId]
      );
    }

    const searchKeywords = Array.from(new Set([...parsed.preferred_roles, parsed.primary_role, `${parsed.primary_role} ${parsed.core_skills[0] || ''}`.trim()])).filter(Boolean);
    const targetLoc = parsed.primary_location.split(',')[0].trim();
    const minExp = Math.max(0, Math.floor(parsed.experience_years) - 1);
    const maxExp = Math.max(minExp + 2, Math.floor(parsed.experience_years) + 2);

    await dbAsync.run(
      `UPDATE search_configs SET keywords=?, location=?, min_experience=?, max_experience=? WHERE id=(SELECT id FROM search_configs ORDER BY id ASC LIMIT 1)`,
      [JSON.stringify(searchKeywords), targetLoc, minExp, maxExp]
    );
  } catch (err: any) {
    console.error('[PROFILE_SYNC] Error syncing profile from resume:', err.message);
  }
}

export async function getProfile(req: Request, res: Response) {
  try {
    let row = await dbAsync.get('SELECT * FROM profile ORDER BY id ASC LIMIT 1') as any;
    if (!row) {
      await dbAsync.run(
        `INSERT INTO profile (name, primary_role, experience_years, experience_text, primary_location, preferred_locations, preferred_roles, core_skills) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ['Candidate Profile', 'Software Developer', 3.0, '3+ years professional experience', 'Remote, India', JSON.stringify(['Remote', 'India', 'Worldwide']), JSON.stringify(['Software Engineer', 'Full Stack Developer', 'Frontend Developer', 'Backend Engineer']), JSON.stringify(['React', 'Node.js', 'TypeScript', 'JavaScript', 'REST API', 'SQL'])]
      );
      row = await dbAsync.get('SELECT * FROM profile ORDER BY id ASC LIMIT 1');
    }

    if (!row) {
      return res.status(503).json({ error: 'Profile not initialized yet, please retry in a moment.' });
    }

    let activeResume: ResumeVersion | undefined;
    const rRow = row?.active_resume_id
      ? await dbAsync.get('SELECT * FROM resume_versions WHERE id = ?', [row.active_resume_id]) as any
      : await dbAsync.get('SELECT * FROM resume_versions WHERE is_active = 1 ORDER BY id DESC LIMIT 1') as any;

    if (rRow) {
      activeResume = { id: rRow.id, name: rRow.name, version: rRow.version, resume_text: rRow.resume_text, file_path: rRow.file_path, is_active: Boolean(rRow.is_active), created_at: rRow.created_at, updated_at: rRow.updated_at };
      
      // Auto-sync profile with active resume text if profile is still default or active resume mismatch
      if (rRow.resume_text && (row.name === 'Candidate Profile' || row.active_resume_id !== rRow.id)) {
        await syncProfileWithResume(rRow.resume_text, rRow.id, rRow.name);
        const updatedRow = await dbAsync.get('SELECT * FROM profile ORDER BY id ASC LIMIT 1') as any;
        if (updatedRow) row = updatedRow;
      }
    }

    const profile: UserProfile = {
      id: row.id, name: row.name, primary_role: row.primary_role,
      experience_years: row.experience_years, experience_text: row.experience_text,
      primary_location: row.primary_location,
      preferred_locations: JSON.parse(row.preferred_locations || '[]'),
      preferred_roles: JSON.parse(row.preferred_roles || '[]'),
      core_skills: JSON.parse(row.core_skills || '[]'),
      active_resume_id: row.active_resume_id, active_resume: activeResume,
      created_at: row.created_at, updated_at: row.updated_at
    };

    return res.json(profile);
  } catch (error: any) {
    console.error('Error fetching profile:', error);
    return res.status(500).json({ error: error.message });
  }
}

export async function updateProfile(req: Request, res: Response) {
  try {
    const { name, primary_role, experience_years, experience_text, primary_location, preferred_locations, preferred_roles, core_skills, resume_text } = req.body;
    const existing = await dbAsync.get('SELECT id, active_resume_id FROM profile ORDER BY id ASC LIMIT 1') as any;
    let activeResumeId = existing?.active_resume_id ?? null;

    if (resume_text) {
      if (activeResumeId) {
        await dbAsync.run(`UPDATE resume_versions SET resume_text=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`, [resume_text, activeResumeId]);
      } else {
        await dbAsync.run(`INSERT INTO resume_versions (name, version, resume_text, is_active) VALUES (?, ?, ?, 1)`, ['Master Resume', 'v1.0', resume_text]);
        const ins = await dbAsync.get('SELECT id FROM resume_versions ORDER BY id DESC LIMIT 1') as any;
        activeResumeId = ins?.id ?? null;
      }
    }

    if (!existing) {
      await dbAsync.run(
        `INSERT INTO profile (name, primary_role, experience_years, experience_text, primary_location, preferred_locations, preferred_roles, core_skills, active_resume_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [name, primary_role, experience_years, experience_text, primary_location, JSON.stringify(preferred_locations || []), JSON.stringify(preferred_roles || []), JSON.stringify(core_skills || []), activeResumeId]
      );
    } else {
      await dbAsync.run(
        `UPDATE profile SET name=?, primary_role=?, experience_years=?, experience_text=?, primary_location=?, preferred_locations=?, preferred_roles=?, core_skills=?, active_resume_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
        [name, primary_role, experience_years, experience_text, primary_location, JSON.stringify(preferred_locations || []), JSON.stringify(preferred_roles || []), JSON.stringify(core_skills || []), activeResumeId, existing.id]
      );
    }

    await dbAsync.run(`INSERT INTO logs (component, event, status, message) VALUES (?, ?, ?, ?)`, ['PROFILE', 'UPDATE_PROFILE', 'SUCCESS', 'User profile & master resume updated.']);
    return res.json({ success: true, message: 'Profile and master resume updated successfully' });
  } catch (error: any) {
    console.error('Error updating profile:', error);
    return res.status(500).json({ error: error.message });
  }
}

export async function getResumeVersions(req: Request, res: Response) {
  try {
    const rows = await dbAsync.all('SELECT * FROM resume_versions ORDER BY is_active DESC, created_at DESC') as any[];
    const versions: ResumeVersion[] = rows.map(r => ({ id: r.id, name: r.name, version: r.version, resume_text: r.resume_text, file_path: r.file_path, is_active: Boolean(r.is_active), created_at: r.created_at, updated_at: r.updated_at }));
    return res.json(versions);
  } catch (error: any) {
    console.error('Error fetching resume versions:', error);
    return res.status(500).json({ error: error.message });
  }
}

export async function selectResumeVersion(req: Request, res: Response) {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Resume ID required' });
    await dbAsync.run('UPDATE resume_versions SET is_active = 0', []);
    await dbAsync.run('UPDATE resume_versions SET is_active = 1 WHERE id = ?', [id]);
    const rRow = await dbAsync.get('SELECT * FROM resume_versions WHERE id = ?', [id]) as any;
    if (rRow) { await syncProfileWithResume(rRow.resume_text, id, rRow.name); }
    else { await dbAsync.run('UPDATE profile SET active_resume_id = ?', [id]); }
    await dbAsync.run(`INSERT INTO logs (component, event, status, message) VALUES (?, ?, ?, ?)`, ['RESUME', 'SELECT_ACTIVE_RESUME', 'SUCCESS', `Active default resume set to ID ${id}.`]);
    return res.json({ success: true, message: 'Default active resume version & profile synced successfully' });
  } catch (error: any) {
    console.error('Error selecting resume version:', error);
    return res.status(500).json({ error: error.message });
  }
}

export async function createResumeVersion(req: Request, res: Response) {
  try {
    const { name, version, resume_text, file_path, set_active } = req.body;
    const resumeName = name || 'Uploaded Resume';
    let text = resume_text;

    if (!text || text.trim().length === 0 || text.includes('%PDF-')) {
      text = `Candidate Profile\nSoftware Developer\nRemote, India\n\nProfessional Software Developer with experience building scalable web and mobile applications. Skilled in React, Node.js, TypeScript, JavaScript, REST APIs, and modern databases.`;
    }

    const makeActive = set_active !== false;
    if (makeActive) await dbAsync.run('UPDATE resume_versions SET is_active = 0', []);

    const countRow = await dbAsync.get('SELECT COUNT(*) as c FROM resume_versions') as any;
    const nextVersion = version || `v${(countRow?.c || 0) + 1}.0`;

    await dbAsync.run(`INSERT INTO resume_versions (name, version, resume_text, file_path, is_active) VALUES (?, ?, ?, ?, ?)`, [resumeName, nextVersion, text, file_path || null, makeActive ? 1 : 0]);
    const newRow = await dbAsync.get('SELECT id FROM resume_versions ORDER BY id DESC LIMIT 1') as any;
    const newId = newRow?.id;

    if (makeActive && newId) await syncProfileWithResume(text, newId, resumeName);

    return res.json({ success: true, id: newId, message: 'New resume version created and profile synced successfully.' });
  } catch (error: any) {
    console.error('Error creating resume version:', error);
    return res.status(500).json({ error: error.message });
  }
}
