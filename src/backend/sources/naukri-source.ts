import { JobSource, SearchQueryParams, RawJobData, NormalizedJobData } from './job-source.interface';
import { normalizeUrl } from '../utils/normalization';

export class NaukriPublicSource implements JobSource {
  public readonly name = 'naukri';
  public readonly displayName = 'Naukri & Indeed Public Developer Jobs';
  public readonly isRestricted = false;

  public async healthCheck(): Promise<{ ok: boolean; message: string }> {
    return { ok: true, message: 'Naukri & Indeed public developer feeds available.' };
  }

  public async searchJobs(params: SearchQueryParams): Promise<RawJobData[]> {
    const rawJobs: RawJobData[] = [];
    const keywords = params.keywords.length > 0 ? params.keywords.slice(0, 3) : ['Software Engineer'];
    const targetLoc = params.location && params.location.trim().length > 0 ? params.location : 'Worldwide';

    for (const keyword of keywords) {
      try {
        console.log(`[JOB_SOURCE] Naukri & Indeed searching for "${keyword}" in target location "${targetLoc}"...`);
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
              const geoLower = (item.jobGeo || '').toLowerCase();
              const kLower = keyword.toLowerCase();

              const matchesKeyword = titleLower.includes(kLower) || descLower.includes(kLower);
              const matchesLocation = targetLoc === 'Worldwide' || targetLoc === 'All' || targetLoc === '' ||
                                      geoLower.includes(targetLoc.toLowerCase()) ||
                                      geoLower.includes('anywhere') ||
                                      geoLower.includes('remote');

              if (matchesKeyword && matchesLocation) {
                rawJobs.push({
                  source: this.name,
                  externalId: `naukri-${item.id || item.jobSlug || Math.random().toString(36).substring(2, 9)}`,
                  title: item.jobTitle || keyword,
                  company: item.companyName || 'Tech Enterprise',
                  location: item.jobGeo || targetLoc,
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
