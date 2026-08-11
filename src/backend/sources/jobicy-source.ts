import { JobSource, SearchQueryParams, RawJobData, NormalizedJobData } from './job-source.interface';
import { normalizeUrl } from '../utils/normalization';

export class JobicyPublicSource implements JobSource {
  public readonly name = 'jobicy';
  public readonly displayName = 'Jobicy Engineering Jobs';
  public readonly isRestricted = false;

  public async healthCheck(): Promise<{ ok: boolean; message: string }> {
    try {
      const res = await fetch('https://jobicy.com/api/v2/remote-jobs?count=1');
      if (res.ok) {
        return { ok: true, message: 'Jobicy public jobs API available.' };
      }
      return { ok: false, message: `HTTP status ${res.status}` };
    } catch (e: any) {
      return { ok: false, message: e.message };
    }
  }

  public async searchJobs(params: SearchQueryParams): Promise<RawJobData[]> {
    const rawJobs: RawJobData[] = [];
    const keywordsLower = params.keywords.map(k => k.toLowerCase());
    const searchTokens = params.keywords.flatMap(k => k.toLowerCase().split(/\s+/)).filter(t => t.length > 2);

    try {
      console.log(`[JOB_SOURCE] Jobicy querying engineering remote jobs...`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const response = await fetch('https://jobicy.com/api/v2/remote-jobs?count=50&industry=engineering', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        },
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!response.ok) return [];

      const data = await response.json();
      if (data && Array.isArray(data.jobs)) {
        for (const item of data.jobs) {
          const titleLower = (item.jobTitle || '').toLowerCase();
          const descLower = (item.jobDescription || '').toLowerCase();

          // Dynamically match against active search keywords or tokens
          const isMatch = keywordsLower.some(k => titleLower.includes(k) || descLower.includes(k)) ||
                          searchTokens.some(t => titleLower.includes(t) || descLower.includes(t));

          if (isMatch) {
            rawJobs.push({
              source: this.name,
              externalId: String(item.id),
              title: item.jobTitle || 'Software Engineer',
              company: item.companyName || 'Technology Company',
              location: item.jobGeo || 'Remote',
              remote: true,
              employmentType: item.jobType ? item.jobType[0] : 'Full Time',
              description: this.stripHtml(item.jobDescription || item.jobExcerpt || ''),
              jobUrl: item.url || '',
              companyUrl: item.companyLogo || '',
              postedDate: item.pubDate ? new Date(item.pubDate).toLocaleDateString() : 'Recently'
            });
          }
        }
      }
    } catch (err: any) {
      console.warn(`[JOB_SOURCE] Jobicy search error:`, err.message);
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
      remote: true,
      salary_min: null,
      salary_max: null,
      salary_currency: 'USD',
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
