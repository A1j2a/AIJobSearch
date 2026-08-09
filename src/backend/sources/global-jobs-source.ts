import { JobSource, SearchQueryParams, RawJobData, NormalizedJobData } from './job-source.interface';

export class GlobalJobsPublicSource implements JobSource {
  public readonly name = 'global_jobs';
  public readonly displayName = 'Global Tech Jobs Aggregator (Worldwide & Remote)';
  public readonly isRestricted = false;

  public async healthCheck(): Promise<{ ok: boolean; message: string }> {
    return { ok: true, message: 'Global Jobs Aggregator online.' };
  }

  public async searchJobs(params: SearchQueryParams): Promise<RawJobData[]> {
    console.log(`[JOB_SOURCE] Global Jobs Aggregator querying global remote opportunities...`);
    const results: RawJobData[] = [];

    // Query NoFluffJobs / DevIT public endpoints
    try {
      const response = await fetch('https://nofluffjobs.com/api/search/posting?limit=25', {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (response.ok) {
        const data = await response.json();
        const postings = data.postings || [];
        for (const p of postings) {
          const title = p.title || '';
          const company = p.name || 'Tech Company';
          const fullText = `${title} ${company} ${(p.technology || []).join(' ')}`.toLowerCase();

          const matchesKeyword = params.keywords.some(kw => fullText.includes(kw.toLowerCase()));
          if (!matchesKeyword) continue;

          results.push({
            source: this.name,
            externalId: `nfj-${p.id || Math.random().toString(36).substring(7)}`,
            title,
            company,
            location: p.location?.places?.[0]?.city || 'Worldwide / Remote',
            remote: Boolean(p.fullyRemote || true),
            salaryMin: p.salary?.from,
            salaryMax: p.salary?.to,
            salaryCurrency: p.salary?.currency || 'USD',
            description: `Global software engineering position at ${company}. Required skills: ${(p.technology || []).join(', ')}`,
            jobUrl: `https://nofluffjobs.com/job/${p.url || p.id}`,
            postedDate: new Date().toISOString(),
            rawData: p
          });
        }
      }
    } catch (e: any) {
      console.warn('[JOB_SOURCE] Global Jobs Aggregator warning:', e.message);
    }

    return results;
  }

  public async getJobDetails(externalId: string): Promise<RawJobData | null> {
    return null;
  }

  public normalizeJob(raw: RawJobData): NormalizedJobData {
    const now = new Date().toISOString();
    return {
      source: this.name,
      external_id: raw.externalId,
      title: raw.title,
      company: raw.company,
      location: raw.location || 'Worldwide',
      remote: Boolean(raw.remote),
      salary_min: raw.salaryMin || null,
      salary_max: raw.salaryMax || null,
      salary_currency: raw.salaryCurrency || 'USD',
      experience_min: raw.experienceMin || null,
      experience_max: raw.experienceMax || null,
      employment_type: raw.employmentType || 'Full Time',
      description: raw.description,
      job_url: raw.jobUrl,
      posted_date: raw.postedDate || now,
      collected_at: now,
      last_seen_at: now
    };
  }
}
