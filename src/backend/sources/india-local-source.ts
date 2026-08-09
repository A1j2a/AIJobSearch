import { JobSource, SearchQueryParams, RawJobData, NormalizedJobData } from './job-source.interface';
import { normalizeUrl } from '../utils/normalization';

export class IndiaLocalPublicSource implements JobSource {
  public readonly name = 'india_local_jobs';
  public readonly displayName = 'Global & Regional Public Developer Jobs';
  public readonly isRestricted = false;

  public async healthCheck(): Promise<{ ok: boolean; message: string }> {
    return { ok: true, message: 'Global & regional developer public feed ready.' };
  }

  public async searchJobs(params: SearchQueryParams): Promise<RawJobData[]> {
    const rawJobs: RawJobData[] = [];
    const keywords = params.keywords.length > 0 ? params.keywords : ['Software Engineer'];
    const targetLoc = (params.location || '').trim();

    try {
      console.log(`[JOB_SOURCE] Querying real live public Jobicy feed for location: "${targetLoc || 'Worldwide'}"...`);
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`https://jobicy.com/api/v2/remote-jobs?count=50`, {
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

            const isRoleMatch = keywords.some(k => titleLower.includes(k.toLowerCase()) || descLower.includes(k.toLowerCase()));
            const isGeoMatch = !targetLoc ||
                              targetLoc.toLowerCase() === 'worldwide' ||
                              targetLoc.toLowerCase() === 'all' ||
                              geoLower.includes(targetLoc.toLowerCase()) ||
                              geoLower.includes('anywhere') ||
                              geoLower.includes('remote');

            if (isRoleMatch && isGeoMatch) {
              const emailMatch = descLower.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);

              rawJobs.push({
                source: this.name,
                externalId: String(item.id || item.jobSlug),
                title: item.jobTitle || 'Software Engineer',
                company: item.companyName || 'Technology Company',
                location: item.jobGeo || targetLoc || 'Worldwide',
                remote: true,
                employmentType: item.jobType || 'Full Time',
                description: this.stripHtml(item.jobDescription || ''),
                jobUrl: item.url || 'https://jobicy.com/jobs',
                companyUrl: item.companyWebsite || null,
                postedDate: item.pubDate ? new Date(item.pubDate).toLocaleDateString() : 'Recently',
                contactEmail: emailMatch ? emailMatch[0] : undefined
              });
            }
          }
        }
      }
    } catch (err: any) {
      console.warn('[JOB_SOURCE] Regional job search error:', err.message);
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
