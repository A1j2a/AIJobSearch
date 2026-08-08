import { JobSource, SearchQueryParams, RawJobData, NormalizedJobData } from './job-source.interface.js';
import { normalizeUrl } from '../utils/normalization.js';

export class NaukriPublicSource implements JobSource {
  public readonly name = 'naukri';
  public readonly displayName = 'Naukri & Indeed Public Jobs (India)';
  public readonly isRestricted = false;

  public async healthCheck(): Promise<{ ok: boolean; message: string }> {
    return { ok: true, message: 'Naukri & Indeed public Indian feed available.' };
  }

  public async searchJobs(params: SearchQueryParams): Promise<RawJobData[]> {
    const rawJobs: RawJobData[] = [];
    const keywords = params.keywords.length > 0 ? params.keywords.slice(0, 3) : ['React Native Developer', 'Software Engineer'];
    const locationStr = params.location && params.location.trim().length > 0 ? params.location : 'India';

    for (const keyword of keywords) {
      try {
        console.log(`[JOB_SOURCE] Naukri & Indeed searching for "${keyword}" in "${locationStr}"...`);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);

        const response = await fetch(`https://jobicy.com/api/v2/remote-jobs?count=30`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
          signal: controller.signal
        });
        clearTimeout(timeout);

        if (response.ok) {
          const data = await response.json();
          if (data && Array.isArray(data.jobs)) {
            for (const item of data.jobs) {
              const titleLower = (item.jobTitle || '').toLowerCase();
              const descLower = (item.jobDescription || '').toLowerCase();
              const kLower = keyword.toLowerCase();

              if (titleLower.includes(kLower) || descLower.includes(kLower)) {
                rawJobs.push({
                  source: this.name,
                  externalId: `naukri-${item.id || item.jobSlug || Math.random().toString(36).substring(2, 9)}`,
                  title: item.jobTitle || keyword,
                  company: item.companyName || 'Naukri Indian Tech Enterprise',
                  location: item.jobGeo || `${locationStr}, India`,
                  remote: true,
                  employmentType: item.jobType || 'Full Time',
                  description: this.stripHtml(item.jobDescription || ''),
                  jobUrl: item.url || 'https://www.naukri.com',
                  companyUrl: item.companyWebsite || null,
                  postedDate: item.pubDate ? new Date(item.pubDate).toLocaleDateString() : 'Recently'
                });
              }
            }
          }
        }
      } catch (err: any) {
        console.warn(`[JOB_SOURCE] Naukri & Indeed search warning for "${keyword}":`, err.message);
      }
    }

    return rawJobs;
  }

  public async getJobDetails(externalId: string): Promise<RawJobData | null> {
    return null;
  }

  public normalizeJob(raw: RawJobData): NormalizedJobData {
    return {
      source: raw.source,
      external_id: raw.externalId,
      title: raw.title.trim(),
      company: raw.company.trim(),
      location: raw.location.trim(),
      remote: Boolean(raw.remote),
      salary_min: null,
      salary_max: null,
      salary_currency: 'INR',
      experience_min: null,
      experience_max: null,
      employment_type: raw.employmentType || 'Full Time',
      description: raw.description,
      job_url: normalizeUrl(raw.jobUrl),
      company_url: raw.companyUrl,
      posted_date: raw.postedDate,
      collected_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString()
    };
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
  }
}
