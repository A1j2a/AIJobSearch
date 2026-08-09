import { dbAsync } from '../config/database';
import { PublicRemotiveSource } from '../sources/remotive-source';
import { GreenhousePublicSource } from '../sources/greenhouse-source';
import { JobicyPublicSource } from '../sources/jobicy-source';
import { WeWorkRemotelyPublicSource } from '../sources/weworkremotely-source';
import { RemoteOKPublicSource } from '../sources/remoteok-source';
import { IndiaLocalPublicSource } from '../sources/india-local-source';
import { LinkedInPublicSource } from '../sources/linkedin-source';
import { NaukriPublicSource } from '../sources/naukri-source';
import { ArbeitnowPublicSource } from '../sources/arbeitnow-source';
import { HackerNewsJobsSource } from '../sources/hackernews-source';
import { GlobalJobsPublicSource } from '../sources/global-jobs-source';
import { JobSource } from '../sources/job-source.interface';
import { aiProvider } from './ai.service';
import { UserProfile, SearchConfig } from '../../shared/types';

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

  public async stopScan(): Promise<{ success: boolean; message: string }> {
    if (this.activeStatus.status === 'RUNNING') {
      this.isAbortRequested = true;
      this.activeStatus.status = 'COMPLETED';
      this.activeStatus.currentStep = 'Job scan manually stopped by user.';

      try {
        await dbAsync.run(`
          INSERT INTO logs (component, event, status, message)
          VALUES (?, ?, ?, ?)
        `, ['SCANNER', 'SCAN_STOPPED', 'WARNING', 'Job scan manually stopped by user.']);
      } catch (e) { }

      return { success: true, message: 'Job scan stopped successfully.' };
    }
    return { success: false, message: 'No job scan is currently running.' };
  }

  private registeredSources: JobSource[] = [
    new LinkedInPublicSource(),
    new NaukriPublicSource(),
    new ArbeitnowPublicSource(),
    new HackerNewsJobsSource(),
    new GlobalJobsPublicSource(),
    new IndiaLocalPublicSource(),
    new PublicRemotiveSource(),
    new GreenhousePublicSource(),
    new JobicyPublicSource(),
    new WeWorkRemotelyPublicSource(),
    new RemoteOKPublicSource()
  ];

  public async getStatus(): Promise<ScanProgressStatus> {
    try {
      const totJobs = await dbAsync.get('SELECT COUNT(*) as c FROM jobs') as any;
      const totAna = await dbAsync.get('SELECT COUNT(*) as c FROM job_analysis') as any;
      const totStrong = await dbAsync.get('SELECT COUNT(*) as c FROM job_analysis WHERE match_score >= 80') as any;

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
      return await this.getStatus();
    }

    const allJobs = await dbAsync.all('SELECT * FROM jobs') as any[];

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
        const sRow = await dbAsync.get('SELECT * FROM search_configs ORDER BY id ASC LIMIT 1') as any;
        const pRow = await dbAsync.get('SELECT * FROM profile ORDER BY id ASC LIMIT 1') as any;
        const rRow = await dbAsync.get('SELECT * FROM resume_versions WHERE is_active = 1 LIMIT 1') as any;

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

          await dbAsync.run(`
            INSERT OR REPLACE INTO job_analysis (
              job_id, match_score, role_score, skills_score, experience_score, location_score,
              employment_type_score, salary_score, seniority_score, other_score,
              matching_skills, missing_skills, required_skills, nice_to_have_skills,
              ai_summary, recommendation, analyzed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `, [
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
          ]);

          count++;
          this.activeStatus.jobsAnalyzed = count;
          if (analysis.matchScore >= 80) {
            strongMatchCount++;
            this.activeStatus.strongMatches = strongMatchCount;
          }
        }

        this.activeStatus.status = 'COMPLETED';
        this.activeStatus.currentStep = `Re-analysis completed! Successfully re-analyzed all ${count} jobs with Cluster Protocol AI.`;

        await dbAsync.run(`
          INSERT INTO logs (component, event, status, message)
          VALUES (?, ?, ?, ?)
        `, ['SCANNER', 'REANALYZE_COMPLETE', 'SUCCESS', `Re-analyzed ${count} jobs successfully.`]);
      } catch (err: any) {
        console.error('[SCANNER] Re-analysis error:', err);
        this.activeStatus.status = 'FAILED';
        this.activeStatus.currentStep = 'Re-analysis failed';
        this.activeStatus.error = err.message;
      }
    })();

    return await this.getStatus();
  }

  public async executeRealJobScan(): Promise<ScanProgressStatus> {
    if (this.activeStatus.status === 'RUNNING') {
      return await this.getStatus();
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
      await dbAsync.run(`
        INSERT INTO logs (component, event, status, message)
        VALUES (?, ?, ?, ?)
      `, ['SCANNER', 'REAL_SCAN_START', 'INFO', 'Real job scanning cycle initiated across public job sources.']);

      const sRow = await dbAsync.get('SELECT * FROM search_configs ORDER BY id ASC LIMIT 1') as any;
      const pRow = await dbAsync.get('SELECT * FROM profile ORDER BY id ASC LIMIT 1') as any;
      const rRow = await dbAsync.get('SELECT * FROM resume_versions WHERE is_active = 1 LIMIT 1') as any;

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

      // Clean previous unsaved discovered jobs before running new scan.
      // Saved / Applied jobs (in applications table) are permanently preserved!
      await dbAsync.run(`
        DELETE FROM job_analysis 
        WHERE job_id NOT IN (SELECT job_id FROM applications)
      `);

      await dbAsync.run(`
        DELETE FROM jobs 
        WHERE id NOT IN (SELECT job_id FROM applications)
      `);

      const resumeText = rRow ? rRow.resume_text : '';
      let totalRawJobs: any[] = [];

      // Query database for enabled job sources configured in Settings
      let enabledNames = new Set<string>();
      try {
        const enabledRows = await dbAsync.all('SELECT name FROM job_sources WHERE is_enabled = 1') as { name: string }[];
        if (enabledRows && enabledRows.length > 0) {
          enabledNames = new Set(enabledRows.map(r => r.name));
        }
      } catch (err: any) {
        console.warn('[SCANNER] Unable to fetch job_sources settings, defaulting to all active sources:', err.message);
      }

      const activeSourcesToSearch = this.registeredSources.filter(source => 
        enabledNames.size === 0 || enabledNames.has(source.name)
      );

      console.log(`[SCANNER] Searching ${activeSourcesToSearch.length} enabled job sources: ${activeSourcesToSearch.map(s => s.name).join(', ')}`);

      for (const source of activeSourcesToSearch) {
        if (this.isAbortRequested) {
          console.log('[SCANNER] Abort requested. Stopping source search...');
          this.activeStatus.status = 'COMPLETED';
          this.activeStatus.currentStep = 'Job scan stopped by user.';
          return await this.getStatus();
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

      let addedCount = 0;
      let duplicateCount = 0;
      let filteredOutCount = 0;
      let strongMatchCount = 0;

      const prefRoles = (Array.isArray(profile.preferred_roles) ? profile.preferred_roles : JSON.parse((profile.preferred_roles as any) || '[]')).map((r: string) => r.toLowerCase());
      const candidateSkills = (Array.isArray(profile.core_skills) ? profile.core_skills : JSON.parse((profile.core_skills as any) || '[]')).map((s: string) => s.toLowerCase());
      const prefLocs = (Array.isArray(profile.preferred_locations) ? profile.preferred_locations : JSON.parse((profile.preferred_locations as any) || '[]')).map((l: string) => l.toLowerCase());
      const primaryRoleLower = (profile.primary_role || '').toLowerCase();

      const searchKeywords = (searchConfig.keywords || []).map(k => k.toLowerCase());

      for (let i = 0; i < totalRawJobs.length; i++) {
        if (this.isAbortRequested) {
          console.log('[SCANNER] Abort requested. Halting job evaluation...');
          this.activeStatus.status = 'COMPLETED';
          this.activeStatus.currentStep = `Job scan stopped by user. Evaluated ${addedCount} jobs.`;
          return await this.getStatus();
        }
        const raw = totalRawJobs[i];
        const titleLower = (raw.title || '').toLowerCase();
        const descLower = (raw.description || '').toLowerCase();
        const locLower = (raw.location || '').toLowerCase();

        // 1. Role & Keyword Compatibility Check
        const allTargetTokens = Array.from(new Set([
          ...searchKeywords,
          ...prefRoles,
          ...(primaryRoleLower ? [primaryRoleLower] : []),
          'react', 'mobile', 'ios', 'android', 'fullstack', 'frontend', 'software', 'developer', 'engineer'
        ])).filter((k: string) => k.trim().length > 0);

        const matchesKeyword = allTargetTokens.some((kw: string) => titleLower.includes(kw) || descLower.includes(kw));

        // 2. Skills Match Check (Matches candidate skills)
        const matchingSkillCount = candidateSkills.filter((s: string) => titleLower.includes(s) || descLower.includes(s)).length;
        const matchesSkills = matchingSkillCount >= 1;

        // 3. Location & Region Compatibility Check
        const targetLocLower = (searchConfig.location || profile.primary_location || 'worldwide').toLowerCase().trim();
        const isWorldwideScope = targetLocLower === 'worldwide' || targetLocLower === 'all' || targetLocLower === 'global' || targetLocLower === '';

        let matchesLocation = false;
        if (isWorldwideScope || searchConfig.remote_allowed || Boolean(raw.remote)) {
          matchesLocation = true;
        } else {
          matchesLocation = locLower.includes(targetLocLower) ||
            locLower.includes('remote') ||
            locLower.includes('worldwide') ||
            locLower.includes('anywhere') ||
            prefLocs.some((loc: string) => locLower.includes(loc));
        }

        // Pre-Filter Guard: Must match candidate keywords/skills AND location criteria
        const passesPreFilter = (matchesKeyword || matchesSkills) && matchesLocation;

        if (!passesPreFilter) {
          filteredOutCount++;
          continue; // Skip non-matching location or non-role job
        }

        this.activeStatus.currentStep = `Processing job ${i + 1}/${totalRawJobs.length}: ${raw.title} at ${raw.company}`;

        const emailMatch = (raw.description || '').match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        const contactEmail = raw.contactEmail || (emailMatch ? emailMatch[0] : null);

        let jobId: number;
        const existingJob = await dbAsync.get(`
          SELECT id FROM jobs 
          WHERE (external_id = ? AND external_id != '') 
             OR (job_url = ? AND job_url != '') 
             OR (title = ? AND company = ?)
        `, [raw.externalId || '', raw.jobUrl || '', raw.title || '', raw.company || '']) as any;

        if (existingJob) {
          jobId = Number(existingJob.id);
        } else {
          await dbAsync.run(`
            INSERT OR IGNORE INTO jobs (
              source, external_id, title, company, location, remote, salary_min, salary_max,
              salary_currency, experience_min, experience_max, employment_type, description,
              job_url, company_url, contact_email, posted_date, is_demo
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
          `, [
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
          ]);

          const reFetch = await dbAsync.get(`
            SELECT id FROM jobs 
            WHERE (external_id = ? AND external_id != '') 
               OR (job_url = ? AND job_url != '') 
               OR (title = ? AND company = ?)
            ORDER BY id DESC LIMIT 1
          `, [raw.externalId || '', raw.jobUrl || '', raw.title || '', raw.company || '']) as any;

          if (reFetch) {
            addedCount++;
            jobId = Number(reFetch.id);
          } else {
            duplicateCount++;
            continue;
          }
        }

        if (!jobId || isNaN(jobId) || jobId <= 0) {
          console.warn(`[SCANNER] Invalid jobId (${jobId}) for ${raw.title}. Skipping analysis.`);
          continue;
        }

        // Verify jobId actually exists in jobs table to strictly prevent Foreign Key errors
        const jobCheck = await dbAsync.get("SELECT id FROM jobs WHERE id = ?", [jobId]) as any;
        if (!jobCheck) {
          console.warn(`[SCANNER] Job ID ${jobId} not found in jobs table for ${raw.title}. Skipping analysis.`);
          continue;
        }

        this.activeStatus.currentStep = `Evaluating AI match score for ${raw.title}...`;
        const analysis = await aiProvider.analyzeJob(raw, profile, searchConfig, resumeText);

        try {
          await dbAsync.run(`
            INSERT OR REPLACE INTO job_analysis (
              job_id, match_score, role_score, skills_score, experience_score, location_score,
              employment_type_score, salary_score, seniority_score, other_score,
              matching_skills, missing_skills, required_skills, nice_to_have_skills,
              ai_summary, recommendation
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
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
          ]);

          this.activeStatus.jobsAnalyzed++;
          if (analysis.matchScore >= 80) {
            strongMatchCount++;
            this.activeStatus.strongMatches = strongMatchCount;
          }
        } catch (dbErr: any) {
          console.warn(`[SCANNER] Analysis insert error for jobId ${jobId}:`, dbErr.message);
        }
      }

      this.activeStatus.status = 'COMPLETED';
      if (addedCount === 0) {
        this.activeStatus.currentStep = `Scan cycle completed. ${filteredOutCount} non-matching jobs pre-filtered out (0 AI tokens wasted). All ${duplicateCount} jobs saved in DB.`;
      } else {
        this.activeStatus.currentStep = `Scan complete. Collected ${addedCount} matching real jobs (${filteredOutCount} non-matching jobs pre-filtered out, ${duplicateCount} duplicates skipped).`;
      }

      await dbAsync.run(`
        INSERT INTO logs (component, event, status, message)
        VALUES (?, ?, ?, ?)
      `, ['SCANNER', 'REAL_SCAN_COMPLETE', 'SUCCESS', `Scan complete. ${addedCount} matching jobs added, ${filteredOutCount} non-matching jobs pre-filtered out, ${duplicateCount} duplicates skipped.`]);

      return await this.getStatus();
    } catch (err: any) {
      console.error('[SCANNER] Fatal scan error:', err);
      this.activeStatus.status = 'FAILED';
      this.activeStatus.currentStep = 'Scan failed';
      this.activeStatus.error = err.message;

      try {
        await dbAsync.run(`
          INSERT INTO logs (component, event, status, message)
          VALUES (?, ?, ?, ?)
        `, ['SCANNER', 'REAL_SCAN_ERROR', 'ERROR', `Scan failed: ${err.message}`]);
      } catch (e) {}

      return await this.getStatus();
    }
  }
}

export const scannerService = new ScannerService();
