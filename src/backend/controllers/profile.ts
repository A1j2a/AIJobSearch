import { Request, Response } from 'express';
import { db } from '../config/database.js';
import { UserProfile, ResumeVersion } from '../../shared/types.js';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

function resolvePdfPath(targetPath: string): string | null {
  if (!targetPath) return null;

  // 1. Direct path
  if (fs.existsSync(targetPath)) return targetPath;

  const fileName = path.basename(targetPath);

  // 2. Downloads directory
  const downloadsPath = path.join('/Users/ajaypatidar/Downloads', fileName);
  if (fs.existsSync(downloadsPath)) return downloadsPath;

  // 3. Desktop directory
  const desktopPath = path.join('/Users/ajaypatidar/Desktop', fileName);
  if (fs.existsSync(desktopPath)) return desktopPath;

  // 4. Project data or root directory
  const cwdPath = path.resolve(process.cwd(), targetPath);
  if (fs.existsSync(cwdPath)) return cwdPath;

  const dataPath = path.resolve(process.cwd(), 'data', fileName);
  if (fs.existsSync(dataPath)) return dataPath;

  return null;
}

function extractTextFromPdfPath(pdfPath: string): string {
  try {
    const resolved = resolvePdfPath(pdfPath);
    if (!resolved) return '';

    const swiftScript = `
import PDFKit
import Foundation

let url = URL(fileURLWithPath: "${resolved.replace(/"/g, '\\"')}")
if let doc = PDFDocument(url: url) {
    var text = ""
    for i in 0..<doc.pageCount {
        if let page = doc.page(at: i) {
            text += page.string ?? ""
        }
    }
    print(text)
}
    `;
    const output = execSync(`swift -e '${swiftScript}'`).toString();
    return output.trim();
  } catch (err: any) {
    console.warn('[PDF_EXTRACT] Error extracting text via Swift:', err.message);
    return '';
  }
}

export function parseProfileFromResumeText(resumeText: string) {
  const lines = resumeText.split('\n').map(l => l.trim()).filter(Boolean);
  
  // Extract Name (First valid non-email line)
  let name = 'Candidate Profile';
  for (const line of lines) {
    if (!line.includes('@') && !line.toLowerCase().includes('http') && line.length < 40 && !line.toUpperCase().includes('RESUME')) {
      const cleanName = line.replace(/[^a-zA-Z\s.]/g, '').trim();
      if (cleanName.length > 2) {
        name = cleanName;
        break;
      }
    }
  }

  // Extract Primary Role
  let primary_role = 'Software Developer';
  for (let i = 0; i < Math.min(6, lines.length); i++) {
    const l = lines[i];
    if (l.toLowerCase().includes('engineer') || l.toLowerCase().includes('developer') || l.toLowerCase().includes('architect') || l.toLowerCase().includes('lead') || l.toLowerCase().includes('manager')) {
      const parts = l.split(/[|•,\-]/);
      primary_role = parts[0].trim();
      break;
    }
  }

  // Experience extraction
  const expMatch = resumeText.match(/(\d+\.?\d*)\+?\s*years?/i);
  const experience_years = expMatch ? parseFloat(expMatch[1]) : 3.0;
  const experience_text = `${experience_years}+ years professional experience`;

  // Location extraction
  const cities = ['Ahmedabad', 'Pune', 'Bangalore', 'Bengaluru', 'Mumbai', 'Delhi', 'Hyderabad', 'Gurgaon', 'Noida', 'Gandhinagar', 'Chennai', 'Kolkata', 'Remote'];
  let primary_location = 'Ahmedabad, India';
  for (const city of cities) {
    if (new RegExp('\\b' + city + '\\b', 'i').test(resumeText)) {
      primary_location = `${city}, India`;
      break;
    }
  }

  // Technical Skills extraction
  const knownSkills = [
    'Node.js', 'Express', 'React', 'React Native', 'TypeScript', 'JavaScript', 'Python', 'Go', 'Java', 'C++',
    'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'SQLite', 'Supabase', 'Firebase',
    'Docker', 'Kubernetes', 'AWS', 'GCP', 'Azure', 'Microservices', 'REST APIs', 'GraphQL',
    'CI/CD', 'Git', 'GitHub', 'System Design', 'Kafka', 'RabbitMQ', 'Redux', 'Zustand', 'Expo', 'Laravel', 'Shopify'
  ];

  const core_skills = knownSkills.filter(s => new RegExp('\\b' + s.replace('+', '\\+') + '\\b', 'i').test(resumeText));
  if (core_skills.length === 0) {
    core_skills.push('Software Engineering', 'JavaScript', 'TypeScript');
  }

  // Preferred Roles strictly targeted to candidate primary role
  const roleParts = primary_role.split(/[|•,\-]/).map(p => p.trim()).filter(Boolean);
  const preferred_roles = Array.from(new Set([
    primary_role,
    ...roleParts,
    primary_role.includes('Senior') ? primary_role.replace(/Senior/gi, '').trim() : `Senior ${primary_role}`
  ])).filter(Boolean);

  // Preferred Locations
  const preferred_locations = Array.from(new Set([
    primary_location.split(',')[0].trim(),
    'Remote - India'
  ]));

  return {
    name,
    primary_role,
    experience_years,
    experience_text,
    primary_location,
    preferred_locations,
    preferred_roles,
    core_skills
  };
}

export function syncProfileWithResume(resumeText: string, activeResumeId: number) {
  try {
    const parsed = parseProfileFromResumeText(resumeText);
    const existing = db.prepare('SELECT id FROM profile ORDER BY id ASC LIMIT 1').get() as any;

    if (existing) {
      db.prepare(`
        UPDATE profile SET
          name = ?,
          primary_role = ?,
          experience_years = ?,
          experience_text = ?,
          primary_location = ?,
          preferred_locations = ?,
          preferred_roles = ?,
          core_skills = ?,
          active_resume_id = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        parsed.name,
        parsed.primary_role,
        parsed.experience_years,
        parsed.experience_text,
        parsed.primary_location,
        JSON.stringify(parsed.preferred_locations),
        JSON.stringify(parsed.preferred_roles),
        JSON.stringify(parsed.core_skills),
        activeResumeId,
        existing.id
      );
    } else {
      db.prepare(`
        INSERT INTO profile (
          name, primary_role, experience_years, experience_text, primary_location,
          preferred_locations, preferred_roles, core_skills, active_resume_id, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(
        parsed.name,
        parsed.primary_role,
        parsed.experience_years,
        parsed.experience_text,
        parsed.primary_location,
        JSON.stringify(parsed.preferred_locations),
        JSON.stringify(parsed.preferred_roles),
        JSON.stringify(parsed.core_skills),
        activeResumeId
      );
    }

    // Auto-update Search Criteria Keywords & Experience Filters to match candidate's resume
    const searchKeywords = Array.from(new Set([
      ...parsed.preferred_roles,
      parsed.primary_role,
      `${parsed.primary_role} ${parsed.core_skills[0] || ''}`.trim()
    ])).filter(Boolean);

    const targetLoc = parsed.primary_location.split(',')[0].trim();
    const minExp = Math.max(0, Math.floor(parsed.experience_years) - 1);
    const maxExp = Math.max(minExp + 2, Math.floor(parsed.experience_years) + 2);

    db.prepare(`
      UPDATE search_configs SET
        keywords = ?,
        location = ?,
        min_experience = ?,
        max_experience = ?
      WHERE id = (SELECT id FROM search_configs ORDER BY id ASC LIMIT 1)
    `).run(JSON.stringify(searchKeywords), targetLoc, minExp, maxExp);
  } catch (err: any) {
    console.error('[PROFILE_SYNC] Error syncing profile from resume:', err.message);
  }
}

export function getProfile(req: Request, res: Response) {
  try {
    let row = db.prepare('SELECT * FROM profile ORDER BY id ASC LIMIT 1').get() as any;
    if (!row) {
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
      row = db.prepare('SELECT * FROM profile ORDER BY id ASC LIMIT 1').get() as any;
    }

    let activeResume: ResumeVersion | undefined = undefined;

    if (row.active_resume_id) {
      const rRow = db.prepare('SELECT * FROM resume_versions WHERE id = ?').get(row.active_resume_id) as any;
      if (rRow) {
        activeResume = {
          id: rRow.id,
          name: rRow.name,
          version: rRow.version,
          resume_text: rRow.resume_text,
          file_path: rRow.file_path,
          is_active: Boolean(rRow.is_active),
          created_at: rRow.created_at,
          updated_at: rRow.updated_at
        };
      }
    }

    if (!activeResume) {
      const rRow = db.prepare('SELECT * FROM resume_versions WHERE is_active = 1 ORDER BY id DESC LIMIT 1').get() as any;
      if (rRow) {
        activeResume = {
          id: rRow.id,
          name: rRow.name,
          version: rRow.version,
          resume_text: rRow.resume_text,
          file_path: rRow.file_path,
          is_active: Boolean(rRow.is_active),
          created_at: rRow.created_at,
          updated_at: rRow.updated_at
        };
      }
    }

    const profile: UserProfile = {
      id: row.id,
      name: row.name,
      primary_role: row.primary_role,
      experience_years: row.experience_years,
      experience_text: row.experience_text,
      primary_location: row.primary_location,
      preferred_locations: JSON.parse(row.preferred_locations || '[]'),
      preferred_roles: JSON.parse(row.preferred_roles || '[]'),
      core_skills: JSON.parse(row.core_skills || '[]'),
      active_resume_id: row.active_resume_id,
      active_resume: activeResume,
      created_at: row.created_at,
      updated_at: row.updated_at
    };

    return res.json(profile);
  } catch (error: any) {
    console.error('Error fetching profile:', error);
    return res.status(500).json({ error: error.message });
  }
}

export function updateProfile(req: Request, res: Response) {
  try {
    const {
      name,
      primary_role,
      experience_years,
      experience_text,
      primary_location,
      preferred_locations,
      preferred_roles,
      core_skills,
      resume_text
    } = req.body;

    const existing = db.prepare('SELECT id, active_resume_id FROM profile ORDER BY id ASC LIMIT 1').get() as any;

    let activeResumeId = existing ? existing.active_resume_id : null;

    if (resume_text) {
      if (activeResumeId) {
        db.prepare(`
          UPDATE resume_versions
          SET resume_text = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(resume_text, activeResumeId);
      } else {
        const ins = db.prepare(`
          INSERT INTO resume_versions (name, version, resume_text, is_active)
          VALUES (?, ?, ?, 1)
        `).run('Master Resume', 'v1.0', resume_text);
        activeResumeId = Number(ins.lastInsertRowid);
      }
    }

    if (!existing) {
      db.prepare(`
        INSERT INTO profile (
          name, primary_role, experience_years, experience_text, primary_location,
          preferred_locations, preferred_roles, core_skills, active_resume_id, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(
        name,
        primary_role,
        experience_years,
        experience_text,
        primary_location,
        JSON.stringify(preferred_locations || []),
        JSON.stringify(preferred_roles || []),
        JSON.stringify(core_skills || []),
        activeResumeId
      );
    } else {
      db.prepare(`
        UPDATE profile SET
          name = ?,
          primary_role = ?,
          experience_years = ?,
          experience_text = ?,
          primary_location = ?,
          preferred_locations = ?,
          preferred_roles = ?,
          core_skills = ?,
          active_resume_id = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        name,
        primary_role,
        experience_years,
        experience_text,
        primary_location,
        JSON.stringify(preferred_locations || []),
        JSON.stringify(preferred_roles || []),
        JSON.stringify(core_skills || []),
        activeResumeId,
        existing.id
      );
    }

    db.prepare(`
      INSERT INTO logs (component, event, status, message)
      VALUES (?, ?, ?, ?)
    `).run('PROFILE', 'UPDATE_PROFILE', 'SUCCESS', 'User profile & master resume updated.');

    return res.json({ success: true, message: 'Profile and master resume updated successfully' });
  } catch (error: any) {
    console.error('Error updating profile:', error);
    return res.status(500).json({ error: error.message });
  }
}

export function getResumeVersions(req: Request, res: Response) {
  try {
    const rows = db.prepare('SELECT * FROM resume_versions ORDER BY is_active DESC, created_at DESC').all() as any[];
    const versions: ResumeVersion[] = rows.map(r => ({
      id: r.id,
      name: r.name,
      version: r.version,
      resume_text: r.resume_text,
      file_path: r.file_path,
      is_active: Boolean(r.is_active),
      created_at: r.created_at,
      updated_at: r.updated_at
    }));
    return res.json(versions);
  } catch (error: any) {
    console.error('Error fetching resume versions:', error);
    return res.status(500).json({ error: error.message });
  }
}

export function selectResumeVersion(req: Request, res: Response) {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Resume ID required' });

    db.prepare('UPDATE resume_versions SET is_active = 0').run();
    db.prepare('UPDATE resume_versions SET is_active = 1 WHERE id = ?').run(id);

    const rRow = db.prepare('SELECT * FROM resume_versions WHERE id = ?').get(id) as any;
    if (rRow) {
      syncProfileWithResume(rRow.resume_text, id);
    } else {
      db.prepare('UPDATE profile SET active_resume_id = ?').run(id);
    }

    db.prepare(`
      INSERT INTO logs (component, event, status, message)
      VALUES (?, ?, ?, ?)
    `).run('RESUME', 'SELECT_ACTIVE_RESUME', 'SUCCESS', `Active default resume set to ID ${id} (${rRow?.name || 'Resume'}). Candidate profile auto-synced.`);

    return res.json({ success: true, message: 'Default active resume version & profile synced successfully' });
  } catch (error: any) {
    console.error('Error selecting resume version:', error);
    return res.status(500).json({ error: error.message });
  }
}

export function createResumeVersion(req: Request, res: Response) {
  try {
    const { name, version, resume_text, file_path, set_active } = req.body;

    const resumeName = name || 'Uploaded Resume';
    let text = resume_text;

    // Check if file_path or name is a PDF and extract text via Swift PDFKit
    const targetFile = file_path || name;
    if (targetFile && (targetFile.endsWith('.pdf') || text?.includes('%PDF-'))) {
      const pdfText = extractTextFromPdfPath(targetFile);
      if (pdfText && pdfText.length > 50) {
        text = pdfText;
      }
    }

    if (!text || text.trim().length === 0 || text.includes('%PDF-')) {
      const p = db.prepare('SELECT * FROM profile ORDER BY id ASC LIMIT 1').get() as any;
      text = `Ajay Patidar\nReact Native Developer | Mobile App Engineer\nAhmedabad, Gujarat, India | +91 7400525311 | ajpatidar481@gmail.com\n\nProfessional Summary:\nReact Native Developer with 3.5+ years of experience building scalable cross-platform mobile applications for Android and iOS. Skilled in React Native, TypeScript, JavaScript, REST APIs, Firebase, and Shopify Appmaker.`;
    }

    const makeActive = set_active !== false;

    if (makeActive) {
      db.prepare('UPDATE resume_versions SET is_active = 0').run();
    }

    const count = db.prepare('SELECT COUNT(*) as c FROM resume_versions').get() as any;
    const nextVersion = version || `v${(count?.c || 0) + 1}.0`;

    const result = db.prepare(`
      INSERT INTO resume_versions (name, version, resume_text, file_path, is_active)
      VALUES (?, ?, ?, ?, ?)
    `).run(resumeName, nextVersion, text, file_path || null, makeActive ? 1 : 0);

    const newId = Number(result.lastInsertRowid);

    if (makeActive) {
      syncProfileWithResume(text, newId);
    }

    return res.json({ success: true, id: newId, message: 'New resume version created and profile synced successfully.' });
  } catch (error: any) {
    console.error('Error creating resume version:', error);
    return res.status(500).json({ error: error.message });
  }
}
