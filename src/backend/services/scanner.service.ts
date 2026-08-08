import { db } from '../config/database.js';
import { PublicRemotiveSource } from '../sources/remotive-source.js';
import { GreenhousePublicSource } from '../sources/greenhouse-source.js';
import { JobicyPublicSource } from '../sources/jobicy-source.js';
import { WeWorkRemotelyPublicSource } from '../sources/weworkremotely-source.js';
import { RemoteOKPublicSource } from '../sources/remoteok-source.js';
import { IndiaLocalPublicSource } from '../sources/india-local-source.js';
import { LinkedInPublicSource } from '../sources/linkedin-source.js';
import { NaukriPublicSource } from '../sources/naukri-source.js';
import { JobSource } from '../sources/job-source.interface.js';
import { aiProvider } from './ai.service.js';
import { UserProfile, SearchConfig } from '../../shared/types.js';

export interface ScanProgressStatus {
  status: 'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  currentStep: string;
  jobsFound: number;
  duplicatesRemoved: number;
  jobsAnalyzed: number;
  strongMatches: number;
  totalDbJobs?: number;
  totalDbAnalyzed?: number;
  error?: string;
}

class ScannerService {
  private isAbortRequested = false;

  private activeStatus: ScanProgressStatus = {
    status: 'IDLE',
    currentStep: 'Ready to start scanning real public jobs',
    jobsFound: 0,
    duplicatesRemoved: 0,
    jobsAnalyzed: 0,
    strongMatches: 0,
    totalDbJobs: 0,
    totalDbAnalyzed: 0
  };

  public stopScan(): { success: boolean; message: string } {
    if (this.activeStatus.status === 'RUNNING') {
      this.isAbortRequested = true;
      this.activeStatus.status = 'COMPLETED';
      this.activeStatus.currentStep = 'Job scan manually stopped by user.';

      try {
        db.prepare(`
          INSERT INTO logs (component, event, status, message)
          VALUES (?, ?, ?, ?)
        `).run('SCANNER', 'SCAN_STOPPED', 'WARNING', 'Job scan manually stopped by user.');
      } catch (e) {}

      return { success: true, message: 'Job scan stopped successfully.' };
    }
    return { success: false, message: 'No job scan is currently running.' };
  }

  private registeredSources: JobSource[] = [
    new LinkedInPublicSource(),
    new NaukriPublicSource(),
    new IndiaLocalPublicSource(),
    new PublicRemotiveSource(),
    new GreenhousePublicSource(),
    new JobicyPublicSource(),
    new WeWorkRemotelyPublicSource(),
    new RemoteOKPublicSource()
  ];

  public getStatus(): ScanProgressStatus {
    try {
      const totJobs = db.prepare('SELECT COUNT(*) as c FROM jobs').get() as any;
      const totAna = db.prepare('SELECT COUNT(*) as c FROM job_analysis').get() as any;
      const totStrong = db.prepare('SELECT COUNT(*) as c FROM job_analysis WHERE match_score >= 80').get() as any;

      return {
        ...this.activeStatus,
        totalDbJobs: totJobs?.c || 0,
        totalDbAnalyzed: totAna?.c || 0,
        strongMatches: this.activeStatus.status === 'RUNNING' ? this.activeStatus.strongMatches : (totStrong?.c || 0)
      };
    } catch (e) {
      return this.activeStatus;
    }
  }

  public async reanalyzeAllJobs(): Promise<ScanProgressStatus> {
    if (this.activeStatus.status === 'RUNNING') {
      return this.getStatus();
    }

    const allJobs = db.prepare('SELECT * FROM jobs').all() as any[];

    this.activeStatus = {
      status: 'RUNNING',
      currentStep: `Initiating background re-analysis of ${allJobs.length} saved job(s)...`,
      jobsFound: allJobs.length,
      duplicatesRemoved: 0,
      jobsAnalyzed: 0,
      strongMatches: 0
    };

    // Execute background reanalysis loop asynchronously
    (async () => {
      try {
        const sRow = db.prepare('SELECT * FROM search_configs ORDER BY id ASC LIMIT 1').get() as any;
        const pRow = db.prepare('SELECT * FROM profile ORDER BY id ASC LIMIT 1').get() as any;
        const rRow = db.prepare('SELECT * FROM resume_versions WHERE is_active = 1 LIMIT 1').get() as any;

        if (!sRow || !pRow) {
          throw new Error('Search config or profile not found in database.');
        }

        const searchConfig: SearchConfig = {
          ...sRow,
          keywords: Array.isArray(sRow.keywords) ? sRow.keywords : JSON.parse(sRow.keywords || '[]'),
          remote_allowed: Boolean(sRow.remote_allowed)
        };

        const profile: UserProfile = {
          ...pRow,
          preferred_locations: Array.isArray(pRow.preferred_locations) ? pRow.preferred_locations : JSON.parse(pRow.preferred_locations || '[]'),
          preferred_roles: Array.isArray(pRow.preferred_roles) ? pRow.preferred_roles : JSON.parse(pRow.preferred_roles || '[]'),
          core_skills: Array.isArray(pRow.core_skills) ? pRow.core_skills : JSON.parse(pRow.core_skills || '[]')
        };

        const resumeText = rRow ? rRow.resume_text : '';

        const insertAnalysis = db.prepare(`
          INSERT OR REPLACE INTO job_analysis (
            job_id, match_score, role_score, skills_score, experience_score, location_score,
            employment_type_score, salary_score, seniority_score, other_score,
            matching_skills, missing_skills, required_skills, nice_to_have_skills,
            ai_summary, recommendation, analyzed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `);

        let count = 0;
        let strongMatchCount = 0;

        for (const raw of allJobs) {
          this.activeStatus.currentStep = `Re-analyzing job ${count + 1}/${allJobs.length}: ${raw.title} at ${raw.company}`;

          const rawJob = {
            source: raw.source,
            externalId: raw.external_id,
            title: raw.title,
            company: raw.company,
            location: raw.location,
            remote: Boolean(raw.remote),
            salaryMin: raw.salary_min,
            salaryMax: raw.salary_max,
            salaryCurrency: raw.salary_currency,
            experienceMin: raw.experience_min,
            experienceMax: raw.experience_max,
            employmentType: raw.employment_type,
            description: raw.description,
            jobUrl: raw.job_url,
            companyUrl: raw.company_url,
            postedDate: raw.posted_date
          };

          const analysis = await aiProvider.analyzeJob(rawJob, profile, searchConfig, resumeText);

          insertAnalysis.run(
            raw.id,
            analysis.matchScore,
            analysis.scoreBreakdown?.roleScore || 0,
            analysis.scoreBreakdown?.skillsScore || 0,
            analysis.scoreBreakdown?.experienceScore || 0,
            analysis.scoreBreakdown?.locationScore || 0,
            analysis.scoreBreakdown?.employmentTypeScore || 0,
            analysis.scoreBreakdown?.salaryScore || 0,
            analysis.scoreBreakdown?.seniorityScore || 0,
            analysis.scoreBreakdown?.otherScore || 0,
            JSON.stringify(analysis.matchingSkills),
            JSON.stringify(analysis.missingSkills),
            JSON.stringify(analysis.requiredSkills),
            JSON.stringify(analysis.niceToHaveSkills),
            analysis.reason,
            analysis.recommendation
          );

          count++;
          this.activeStatus.jobsAnalyzed = count;
          if (analysis.matchScore >= 80) {
            strongMatchCount++;
            this.activeStatus.strongMatches = strongMatchCount;
          }
        }

        this.activeStatus.status = 'COMPLETED';
        this.activeStatus.currentStep = `Re-analysis completed! Successfully re-analyzed all ${count} jobs with local Ollama AI.`;

        db.prepare(`
          INSERT INTO logs (component, event, status, message)
          VALUES (?, ?, ?, ?)
        `).run('SCANNER', 'REANALYZE_COMPLETE', 'SUCCESS', `Re-analyzed ${count} jobs successfully.`);
      } catch (err: any) {
        console.error('[SCANNER] Re-analysis error:', err);
        this.activeStatus.status = 'FAILED';
        this.activeStatus.currentStep = 'Re-analysis failed';
        this.activeStatus.error = err.message;
      }
    })();

    return this.getStatus();
  }

  public async executeRealJobScan(): Promise<ScanProgressStatus> {
    if (this.activeStatus.status === 'RUNNING') {
      return this.getStatus();
    }

    this.isAbortRequested = false;

    this.activeStatus = {
      status: 'RUNNING',
      currentStep: 'Initializing public job sources...',
      jobsFound: 0,
      duplicatesRemoved: 0,
      jobsAnalyzed: 0,
      strongMatches: 0
    };

    try {
      db.prepare(`
        INSERT INTO logs (component, event, status, message)
        VALUES (?, ?, ?, ?)
      `).run('SCANNER', 'REAL_SCAN_START', 'INFO', 'Real job scanning cycle initiated across public job sources.');

      const sRow = db.prepare('SELECT * FROM search_configs ORDER BY id ASC LIMIT 1').get() as any;
      const pRow = db.prepare('SELECT * FROM profile ORDER BY id ASC LIMIT 1').get() as any;
      const rRow = db.prepare('SELECT * FROM resume_versions WHERE is_active = 1 LIMIT 1').get() as any;

      if (!sRow || !pRow) {
        throw new Error('Search config or profile not found in database.');
      }

      const searchConfig: SearchConfig = {
        ...sRow,
        keywords: JSON.parse(sRow.keywords || '[]'),
        remote_allowed: Boolean(sRow.remote_allowed)
      };

      const profile: UserProfile = {
        ...pRow,
        preferred_locations: JSON.parse(pRow.preferred_locations || '[]'),
        preferred_roles: JSON.parse(pRow.preferred_roles || '[]'),
        core_skills: JSON.parse(pRow.core_skills || '[]')
      };

      // Clean previous unsaved discovered jobs before running new scan.
      // Saved / Applied jobs (in applications table) are permanently preserved!
      db.prepare(`
        DELETE FROM job_analysis 
        WHERE job_id NOT IN (SELECT job_id FROM applications)
      `).run();

      db.prepare(`
        DELETE FROM jobs 
        WHERE id NOT IN (SELECT job_id FROM applications)
      `).run();

      const resumeText = rRow ? rRow.resume_text : '';
      let totalRawJobs: any[] = [];

      for (const source of this.registeredSources) {
        if (this.isAbortRequested) {
          console.log('[SCANNER] Abort requested. Stopping source search...');
          this.activeStatus.status = 'COMPLETED';
          this.activeStatus.currentStep = 'Job scan stopped by user.';
          return this.getStatus();
        }

        this.activeStatus.currentStep = `Searching ${source.displayName}...`;
        console.log(`[SCANNER] Searching source: ${source.displayName}`);
        
        try {
          const raw = await source.searchJobs({
            keywords: searchConfig.keywords,
            location: searchConfig.location,
            minExperience: searchConfig.min_experience,
            maxExperience: searchConfig.max_experience,
            remoteAllowed: searchConfig.remote_allowed
          });
          totalRawJobs = totalRawJobs.concat(raw);
        } catch (e: any) {
          console.warn(`[SCANNER] Error querying source ${source.displayName}:`, e.message);
        }
      }

      this.activeStatus.jobsFound = totalRawJobs.length;
      this.activeStatus.currentStep = `Found ${totalRawJobs.length} raw job listings. Normalizing & deduplicating...`;

      const insertJob = db.prepare(`
        INSERT OR IGNORE INTO jobs (
          source, external_id, title, company, location, remote, salary_min, salary_max,
          salary_currency, experience_min, experience_max, employment_type, description,
          job_url, company_url, contact_email, posted_date, is_demo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `);

      const insertAnalysis = db.prepare(`
        INSERT OR REPLACE INTO job_analysis (
          job_id, match_score, role_score, skills_score, experience_score, location_score,
          employment_type_score, salary_score, seniority_score, other_score,
          matching_skills, missing_skills, required_skills, nice_to_have_skills,
          ai_summary, recommendation
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      let addedCount = 0;
      let duplicateCount = 0;
      let filteredOutCount = 0;
      let strongMatchCount = 0;

      const prefRoles = (Array.isArray(profile.preferred_roles) ? profile.preferred_roles : JSON.parse((profile.preferred_roles as any) || '[]')).map((r: string) => r.toLowerCase());
      const candidateSkills = (Array.isArray(profile.core_skills) ? profile.core_skills : JSON.parse((profile.core_skills as any) || '[]')).map((s: string) => s.toLowerCase());
      const prefLocs = (Array.isArray(profile.preferred_locations) ? profile.preferred_locations : JSON.parse((profile.preferred_locations as any) || '[]')).map((l: string) => l.toLowerCase());
      const primaryRoleLower = (profile.primary_role || '').toLowerCase();
      const targetCity = (searchConfig.location || profile.primary_location || '').toLowerCase().split(',')[0].trim();

      const searchKeywords = (searchConfig.keywords || []).map(k => k.toLowerCase());

      for (let i = 0; i < totalRawJobs.length; i++) {
        if (this.isAbortRequested) {
          console.log('[SCANNER] Abort requested. Halting job evaluation...');
          this.activeStatus.status = 'COMPLETED';
          this.activeStatus.currentStep = `Job scan stopped by user. Evaluated ${addedCount} jobs.`;
          return this.getStatus();
        }
        const raw = totalRawJobs[i];
        const titleLower = (raw.title || '').toLowerCase();
        const descLower = (raw.description || '').toLowerCase();
        const locLower = (raw.location || '').toLowerCase();

        // 1. Candidate Role Compatibility Check (Strictly matching candidate specialization)
        const isMobileCandidate = primaryRoleLower.includes('react native') || primaryRoleLower.includes('mobile') || prefRoles.some((r: string) => r.includes('react native') || r.includes('mobile'));
        const isBackendCandidate = primaryRoleLower.includes('backend') || prefRoles.some((r: string) => r.includes('backend'));

        let matchesRole = false;
        if (isMobileCandidate) {
          const isMobileTitle = titleLower.includes('react native') || titleLower.includes('mobile') || titleLower.includes('ios') || titleLower.includes('android') || titleLower.includes('flutter') || titleLower.includes('app developer') || (titleLower.includes('react') && titleLower.includes('developer'));
          const isIrrelevantRole = titleLower.includes('golang') || titleLower.includes('rust') || titleLower.includes('c++') || titleLower.includes('finance automation') || titleLower.includes('director') || titleLower.includes('graph engine') || titleLower.includes('data layer') || titleLower.includes('legal automation');
          matchesRole = isMobileTitle && !isIrrelevantRole;
        } else if (isBackendCandidate) {
          const isBackendTitle = titleLower.includes('backend') || titleLower.includes('node') || titleLower.includes('python') || titleLower.includes('go') || titleLower.includes('microservices') || titleLower.includes('api') || titleLower.includes('server');
          const isIrrelevantRole = titleLower.includes('react native') || titleLower.includes('flutter') || titleLower.includes('ios') || titleLower.includes('android') || titleLower.includes('design') || titleLower.includes('copywriter');
          matchesRole = isBackendTitle && !isIrrelevantRole;
        } else {
          matchesRole = prefRoles.some((r: string) => titleLower.includes(r)) || (primaryRoleLower && titleLower.includes(primaryRoleLower));
        }

        // 2. Skills Match Check (Matches at least 2 core skills)
        const matchingSkillCount = candidateSkills.filter((s: string) => titleLower.includes(s) || descLower.includes(s)).length;
        const matchesSkills = matchingSkillCount >= 2;

        // 3. Location & Region Check matching Target Location & Candidate Profile
        const targetLocLower = (searchConfig.location || profile.primary_location || 'india').toLowerCase().trim();
        const isIndiaTarget = targetLocLower.includes('india') || targetLocLower.includes('ahmedabad') || targetLocLower.includes('bengaluru') || targetLocLower.includes('pune') || targetLocLower.includes('mumbai') || targetLocLower.includes('delhi') || targetLocLower.includes('noida') || targetLocLower.includes('gurgaon') || targetLocLower.includes('hyderabad') || targetLocLower.includes('gandhinagar') || targetLocLower.includes('gujarat');
        
        const isIndiaOrOpenJob = locLower.includes('india') || locLower.includes('ahmedabad') || locLower.includes('bengaluru') || locLower.includes('pune') || locLower.includes('mumbai') || locLower.includes('delhi') || locLower.includes('noida') || locLower.includes('gurgaon') || locLower.includes('hyderabad') || locLower.includes('gandhinagar') || locLower.includes('gujarat') || locLower.includes('worldwide') || locLower.includes('anywhere') || locLower.includes('remote');

        const isForeignOnsiteOnly = (locLower.includes('usa') || locLower.includes('united states') || locLower.includes('uk') || locLower.includes('london') || locLower.includes('germany') || locLower.includes('europe')) &&
                                    !locLower.includes('india') && !locLower.includes('worldwide') && !locLower.includes('anywhere');

        let matchesLocation = false;
        if (isIndiaTarget) {
          matchesLocation = isIndiaOrOpenJob && !isForeignOnsiteOnly;
        } else if (searchConfig.remote_allowed) {
          matchesLocation = !isForeignOnsiteOnly;
        } else {
          matchesLocation = (targetCity && locLower.includes(targetCity)) ||
                            prefLocs.some((loc: string) => loc !== 'remote' && locLower.includes(loc));
        }

        // Pre-Filter Guard: Must match candidate target role/skills AND location criteria
        const passesPreFilter = (matchesRole || matchesSkills) && matchesLocation;

        if (!passesPreFilter) {
          filteredOutCount++;
          continue; // Skip non-matching location or non-role job
        }

        this.activeStatus.currentStep = `Processing job ${i + 1}/${totalRawJobs.length}: ${raw.title} at ${raw.company}`;

        const emailMatch = (raw.description || '').match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        const contactEmail = raw.contactEmail || (emailMatch ? emailMatch[0] : null);

        let jobId: number;
        const existingJob = db.prepare("SELECT id FROM jobs WHERE external_id = ? OR (job_url = ? AND job_url != '')").get(raw.externalId, raw.jobUrl || '') as any;
        
        if (existingJob) {
          jobId = Number(existingJob.id);
        } else {
          const res = insertJob.run(
            raw.source,
            raw.externalId,
            raw.title,
            raw.company,
            raw.location,
            raw.remote ? 1 : 0,
            raw.salaryMin || null,
            raw.salaryMax || null,
            raw.salaryCurrency || 'USD',
            raw.experienceMin || null,
            raw.experienceMax || null,
            raw.employmentType || 'Full Time',
            raw.description,
            raw.jobUrl,
            raw.companyUrl || null,
            contactEmail || null,
            raw.postedDate || 'Recently'
          );

          if (res.changes > 0) {
            addedCount++;
            jobId = Number(res.lastInsertRowid);
          } else {
            duplicateCount++;
            continue;
          }
        }

        if (!jobId || isNaN(jobId) || jobId <= 0) {
          console.warn(`[SCANNER] Invalid jobId (${jobId}) for ${raw.title}. Skipping analysis.`);
          continue;
        }

        this.activeStatus.currentStep = `Evaluating AI match score for ${raw.title}...`;
        const analysis = await aiProvider.analyzeJob(raw, profile, searchConfig, resumeText);

        insertAnalysis.run(
          jobId,
          analysis.matchScore,
            analysis.scoreBreakdown?.roleScore || 0,
            analysis.scoreBreakdown?.skillsScore || 0,
            analysis.scoreBreakdown?.experienceScore || 0,
            analysis.scoreBreakdown?.locationScore || 0,
            analysis.scoreBreakdown?.employmentTypeScore || 0,
            analysis.scoreBreakdown?.salaryScore || 0,
            analysis.scoreBreakdown?.seniorityScore || 0,
            analysis.scoreBreakdown?.otherScore || 0,
            JSON.stringify(analysis.matchingSkills),
            JSON.stringify(analysis.missingSkills),
            JSON.stringify(analysis.requiredSkills),
            JSON.stringify(analysis.niceToHaveSkills),
            analysis.reason,
            analysis.recommendation
          );

          this.activeStatus.jobsAnalyzed++;
          if (analysis.matchScore >= 80) {
            strongMatchCount++;
            this.activeStatus.strongMatches = strongMatchCount;
          }
        }

      this.activeStatus.status = 'COMPLETED';
      if (addedCount === 0) {
        this.activeStatus.currentStep = `Scan cycle completed. ${filteredOutCount} non-matching jobs pre-filtered out (0 AI tokens wasted). All ${duplicateCount} jobs saved in SQLite.`;
      } else {
        this.activeStatus.currentStep = `Scan complete. Collected ${addedCount} matching real jobs (${filteredOutCount} non-matching jobs pre-filtered out, ${duplicateCount} duplicates skipped).`;
      }

      db.prepare(`
        INSERT INTO logs (component, event, status, message)
        VALUES (?, ?, ?, ?)
      `).run('SCANNER', 'REAL_SCAN_COMPLETE', 'SUCCESS', `Scan complete. ${addedCount} matching jobs added, ${filteredOutCount} non-matching jobs pre-filtered out, ${duplicateCount} duplicates skipped.`);

      return this.getStatus();
    } catch (err: any) {
      console.error('[SCANNER] Fatal scan error:', err);
      this.activeStatus.status = 'FAILED';
      this.activeStatus.currentStep = 'Scan failed';
      this.activeStatus.error = err.message;

      db.prepare(`
        INSERT INTO logs (component, event, status, message)
        VALUES (?, ?, ?, ?)
      `).run('SCANNER', 'REAL_SCAN_ERROR', 'ERROR', `Scan failed: ${err.message}`);

      return this.getStatus();
    }
  }
}

export const scannerService = new ScannerService();
