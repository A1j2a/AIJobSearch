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
  const text = resumeText || '';
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // 1. Dynamic Candidate Name Extraction
  let name = 'Candidate Profile';
  for (const line of lines) {
    const isLocationLine = ['india', 'ahmedabad', 'gujar', 'usa', 'street', 'road', 'mumbai', 'bangalore', 'pune', 'delhi', 'hyderabad', 'noida', 'remote'].some(loc => line.toLowerCase().includes(loc));
    if (!isLocationLine && !line.includes('@') && !line.toLowerCase().includes('http') && line.length < 40 && !line.toUpperCase().includes('RESUME') && !line.toUpperCase().includes('CURRICULUM')) {
      const cleanName = line.replace(/[^a-zA-Z\s.]/g, '').trim();
      if (cleanName.length > 2 && cleanName.toLowerCase() !== 'candidate profile') {
        name = cleanName;
        break;
      }
    }
  }

  if (resumeTitle && (name === 'Candidate Profile' || name.length < 3)) {
    const base = resumeTitle.replace(/^Uploaded:\s*/i, '').replace(/\.[^/.]+$/, '').replace(/[\d()_-]/g, ' ').trim();
    const words = base.split(/\s+/).filter(w => w.length > 1 && !['resume', 'cv', 'v1', 'v2', 'v3', 'final', 'updated', 'pdf', 'doc', 'docx'].includes(w.toLowerCase()));
    if (words.length >= 1) {
      name = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }
  }

  // 2. Dynamic Primary Role Extraction (Concise title matching)
  let primary_role = '';
  const roleRegex = /(?:Senior\s+|Junior\s+|Lead\s+|Principal\s+|Staff\s+)?(?:React Native|React|Node\.js|Full Stack|Frontend|Backend|Mobile|Android|iOS|Flutter|Software|Web|Python|Java|DevOps|UI\/UX|Data|Cloud)?\s*(?:Developer|Engineer|Architect|Specialist|Manager|Designer|Analyst|Programmer)/gi;
  
  const roleMatches = Array.from(text.matchAll(roleRegex)).map(m => m[0].trim());
  if (roleMatches.length > 0) {
    const validRoles = roleMatches.filter(r => r.length >= 5 && r.length <= 35 && !r.toLowerCase().includes('candidate profile') && !r.toLowerCase().includes('experience'));
    if (validRoles.length > 0) {
      primary_role = validRoles[0];
    }
  }

  if (!primary_role) {
    const roleKeywords = ['engineer', 'developer', 'architect', 'lead', 'manager', 'designer', 'analyst', 'consultant', 'specialist', 'programmer'];
    for (let i = 0; i < Math.min(12, lines.length); i++) {
      const l = lines[i];
      const lowerL = l.toLowerCase();
      if (lowerL.includes('candidate profile') || lowerL.includes('work experience') || lowerL.includes('project management')) continue;
      if (roleKeywords.some(rk => lowerL.includes(rk))) {
        const parts = l.split(/[|•,\-:]/);
        for (const part of parts) {
          const cleanPart = part.replace(/[^a-zA-Z\s]/g, '').trim();
          if (cleanPart.length > 3 && cleanPart.length <= 35 && roleKeywords.some(rk => cleanPart.toLowerCase().includes(rk))) {
            primary_role = cleanPart;
            break;
          }
        }
        if (primary_role) break;
      }
    }
  }

  if (!primary_role && resumeTitle) {
    const titleMatch = resumeTitle.match(/(react native|full stack|frontend|backend|mobile|software)?\s*(developer|engineer|designer|architect|analyst)/i);
    if (titleMatch) primary_role = titleMatch[0].trim();
  }

  if (!primary_role || primary_role.length > 35) {
    primary_role = 'Software Developer';
  }

  // 3. Dynamic Experience Extraction
  const expMatch = text.match(/(\d+\.?\d*)\+?\s*years?/i);
  const experience_years = expMatch ? parseFloat(expMatch[1]) : 1.0;
  const experience_text = `${experience_years}+ years professional experience`;

  // 4. Dynamic Location Extraction
  const cities = ['Ahmedabad', 'Pune', 'Bangalore', 'Bengaluru', 'Mumbai', 'Delhi', 'Hyderabad', 'Gurgaon', 'Noida', 'Gandhinagar', 'Chennai', 'Kolkata', 'Remote'];
  let primary_location = 'Remote, India';
  for (const city of cities) {
    if (new RegExp('\\b' + city + '\\b', 'i').test(text)) {
      primary_location = `${city}, India`;
      break;
    }
  }

  // 5. Dynamic Core Skills Extraction (Strictly from candidate's resume)
  const knownSkills = [
    'React Native', 'React', 'Node.js', 'Express', 'TypeScript', 'JavaScript', 'Python', 'Django', 'Flask', 'FastAPI',
    'Java', 'Spring Boot', 'Kotlin', 'Android', 'Swift', 'iOS', 'Flutter', 'Vue', 'Angular', 'Next.js', 'Nuxt', 'Svelte',
    'C++', 'C#', '.NET', 'Go', 'Rust', 'PHP', 'Laravel', 'Ruby', 'Rails', 'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis',
    'SQLite', 'Supabase', 'Firebase', 'GraphQL', 'REST API', 'REST APIs', 'Docker', 'Kubernetes', 'AWS', 'GCP', 'Azure',
    'CI/CD', 'Git', 'GitHub', 'System Design', 'Kafka', 'RabbitMQ', 'Redux', 'Zustand', 'Expo', 'HTML', 'CSS', 'Tailwind',
    'Figma', 'Shopify', 'Async Storage'
  ];

  const core_skills = knownSkills.filter(s => new RegExp('\\b' + s.replace('+', '\\+').replace('.', '\\.') + '\\b', 'i').test(text));

  // Dynamic Section parser for custom skills
  const sectionRegex = /(?:skills|technologies|tools|competencies|tech stack)[\s:-]+([^\n\r]+)/gi;
  let sectionMatch;
  while ((sectionMatch = sectionRegex.exec(text)) !== null) {
    const rawSkills = sectionMatch[1].split(/[,|•/;\-]/);
    for (const raw of rawSkills) {
      const clean = raw.trim().replace(/[^a-zA-Z0-9\s.+]/g, '');
      if (clean.length > 1 && clean.length < 25 && !core_skills.some(cs => cs.toLowerCase() === clean.toLowerCase())) {
        core_skills.push(clean);
      }
    }
  }

  const preferred_roles = [primary_role];
  const preferred_locations = Array.from(new Set([primary_location.split(',')[0].trim(), 'Remote - India']));

  return { name, primary_role, experience_years, experience_text, primary_location, preferred_locations, preferred_roles, core_skills };
}

export function cleanPdfTextStream(text: string): string {
  if (!text) return '';

  let clean = text
    .replace(/sRGB IEC[0-9.-]+/gi, '')
    .replace(/http:\/\/www\.color\.org[^\s]*/gi, '')
    .replace(/Adobe Identity/gi, '')
    .replace(/DAGh[a-zA-Z0-9,/_-]+/g, '')
    .replace(/D:[0-9+']+/g, '')
    .replace(/en-GB/gi, '');

  const tokens = clean.split(/\s+/);
  const validTokens: string[] = [];

  for (const t of tokens) {
    if (!t) continue;
    if (t.length === 1 && !['c', 'r', 'a', 'i', '&', '|', '+'].includes(t.toLowerCase())) {
      continue;
    }
    if (/[\^%\$\{\}\[\]\<\>\~#*]/.test(t) && !t.includes('c++') && !t.includes('c#')) {
      continue;
    }
    validTokens.push(t);
  }

  let result = validTokens.join(' ');

  const words = result.split(/\s+/);
  const dedupWords: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const curr = words[i];
    const prev = dedupWords[dedupWords.length - 1];
    if (prev && curr.toLowerCase() === prev.toLowerCase() && !['react', 'native'].includes(curr.toLowerCase())) {
      continue;
    }
    dedupWords.push(curr);
  }

  result = dedupWords.join(' ');
  result = result.replace(/\b([A-Za-z0-9\s.+]{4,30})\s+\1\b/gi, '$1');

  return result.trim();
}

export async function syncProfileWithResume(resumeText: string, activeResumeId: number, resumeTitle?: string) {
  try {
    let cleanText = cleanPdfTextStream(resumeText || '');

    // Parse profile dynamically strictly from candidate resume text
    const parsed = parseProfileFromResumeText(cleanText, resumeTitle);
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

    const cleanRole = (parsed.primary_role || '').trim();
    const roleLower = cleanRole.toLowerCase();
    const topSkills = (parsed.core_skills || [])
      .filter(s => typeof s === 'string' && s.length > 1 && !roleLower.includes(s.toLowerCase()))
      .slice(0, 2);

    const skillCombos = cleanRole ? topSkills.map(skill => `${cleanRole} ${skill}`.trim()) : topSkills;
    const searchKeywords = Array.from(new Set([
      ...(cleanRole ? [cleanRole] : []),
      ...skillCombos
    ])).filter(k => k.length > 2 && k.length <= 45);

    const targetLoc = parsed.primary_location.split(',')[0].trim();
    const minExp = Math.max(0, Math.floor(parsed.experience_years) - 1);
    const maxExp = Math.max(minExp + 2, Math.floor(parsed.experience_years) + 2);

    try {
      const scRow = await dbAsync.get('SELECT id FROM search_configs ORDER BY id ASC LIMIT 1') as any;
      if (scRow && scRow.id) {
        await dbAsync.run(
          `UPDATE search_configs SET keywords=?, location=?, min_experience=?, max_experience=? WHERE id=?`,
          [JSON.stringify(searchKeywords), targetLoc, minExp, maxExp, scRow.id]
        );
      } else {
        await dbAsync.run(
          `INSERT INTO search_configs (keywords, location, min_experience, max_experience) VALUES (?, ?, ?, ?)`,
          [JSON.stringify(searchKeywords), targetLoc, minExp, maxExp]
        );
      }
    } catch (scErr: any) {
      console.warn('Search config sync warning:', scErr.message);
    }
  } catch (err: any) {
    console.error('syncProfileWithResume error:', err);
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

    if (resume_text && resume_text.trim()) {
      if (activeResumeId) {
        await dbAsync.run(`UPDATE resume_versions SET resume_text=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`, [resume_text, activeResumeId]);
      } else {
        await dbAsync.run(`INSERT INTO resume_versions (name, version, resume_text, is_active) VALUES (?, ?, ?, 1)`, ['Master Resume', 'v1.0', resume_text]);
        const ins = await dbAsync.get('SELECT id FROM resume_versions ORDER BY id DESC LIMIT 1') as any;
        if (ins) activeResumeId = ins.id;
      }
    }

    if (existing) {
      await dbAsync.run(
        `UPDATE profile SET name=?, primary_role=?, experience_years=?, experience_text=?, primary_location=?, preferred_locations=?, preferred_roles=?, core_skills=?, active_resume_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
        [name, primary_role, experience_years, experience_text, primary_location, JSON.stringify(preferred_locations || []), JSON.stringify(preferred_roles || []), JSON.stringify(core_skills || []), activeResumeId, existing.id]
      );
    } else {
      await dbAsync.run(
        `INSERT INTO profile (name, primary_role, experience_years, experience_text, primary_location, preferred_locations, preferred_roles, core_skills, active_resume_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [name, primary_role, experience_years, experience_text, primary_location, JSON.stringify(preferred_locations || []), JSON.stringify(preferred_roles || []), JSON.stringify(core_skills || []), activeResumeId]
      );
    }

    await dbAsync.run(`INSERT INTO logs (component, event, status, message) VALUES (?, ?, ?, ?)`, ['PROFILE', 'UPDATE_PROFILE', 'SUCCESS', 'User profile & master resume updated.']);
    return res.json({ success: true, message: 'Profile & Resume saved successfully' });
  } catch (error: any) {
    console.error('Error saving profile:', error);
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
      text = `${resumeName}\n\nUploaded resume document (${file_path || 'file'}).`;
    }

    const makeActive = set_active !== false;
    if (makeActive) await dbAsync.run('UPDATE resume_versions SET is_active = 0', []);

    const countRow = await dbAsync.get('SELECT COUNT(*) as c FROM resume_versions') as any;
    const nextVersion = version || `v${(countRow?.c || 0) + 1}.0`;

    await dbAsync.run(`INSERT INTO resume_versions (name, version, resume_text, file_path, is_active) VALUES (?, ?, ?, ?, ?)`, [resumeName, nextVersion, text, file_path || null, makeActive ? 1 : 0]);
    const newRow = await dbAsync.get('SELECT id FROM resume_versions ORDER BY id DESC LIMIT 1') as any;
    const newId = newRow?.id;

    if (makeActive && newId) await syncProfileWithResume(text, newId, resumeName);

    await dbAsync.run(`INSERT INTO logs (component, event, status, message) VALUES (?, ?, ?, ?)`, ['RESUME', 'CREATE_RESUME_VERSION', 'SUCCESS', `New resume version ${nextVersion} created.`]);
    return res.json({ success: true, id: newId, message: `Resume version ${nextVersion} uploaded & saved` });
  } catch (error: any) {
    console.error('Error creating resume version:', error);
    return res.status(500).json({ error: error.message });
  }
}
