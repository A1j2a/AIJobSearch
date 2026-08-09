import { JobSource, SearchQueryParams, RawJobData, NormalizedJobData } from './job-source.interface';
import { normalizeUrl } from '../utils/normalization';

export class RemoteOKPublicSource implements JobSource {
  public readonly name = 'remoteok';
  public readonly displayName = 'RemoteOK Public Jobs';
  public readonly isRestricted = false;

  public async healthCheck(): Promise<{ ok: boolean; message: string }> {
    try {
      const res = await fetch('https://remoteok.com/api?limit=1', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }
      });
      if (res.ok) {
        return { ok: true, message: 'RemoteOK public API available.' };
      }
      return { ok: false, message: `HTTP status ${res.status}` };
    } catch (e: any) {
      return { ok: false, message: e.message };
    }
  }

  public async searchJobs(params: SearchQueryParams): Promise<RawJobData[]> {
    const rawJobs: RawJobData[] = [];
    const keywordsLower = params.keywords.map(k => k.toLowerCase());

    // Dynamically derive RemoteOK tags from active candidate keywords
    const tags = Array.from(new Set(
      params.keywords.flatMap(k => [
        k.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        k.split(' ')[0].toLowerCase()
      ])
    )).filter(Boolean).slice(0, 4);

    const activeTags = tags.length > 0 ? tags : ['dev', 'engineer'];

    for (const tag of activeTags) {
      try {
        console.log(`[JOB_SOURCE] RemoteOK querying tag: ${tag}...`);
        const response = await fetch(`https://remoteok.com/api?tag=${tag}`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }
        });
        if (!response.ok) continue;

        const data = await response.json();
        if (Array.isArray(data)) {
          const items = data.filter((item: any) => item && item.id && item.position);

          for (const item of items) {
            const titleLower = (item.position || '').toLowerCase();
            const descLower = (item.description || '').toLowerCase();

            // Match strictly against active search keywords
            const isMatch = keywordsLower.some(k => titleLower.includes(k) || descLower.includes(k));

            if (isMatch) {
              const emailMatch = descLower.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
              const contactEmail = emailMatch ? emailMatch[0] : null;

              rawJobs.push({
                source: this.name,
                externalId: String(item.id),
                title: item.position,
                company: item.company || 'Tech Company',
                location: item.location || 'Remote',
                remote: true,
                salaryMin: item.salary_min || undefined,
                salaryMax: item.salary_max || undefined,
                salaryCurrency: 'USD',
                employmentType: 'Full Time',
                description: this.stripHtml(item.description || ''),
                jobUrl: item.url || `https://remoteok.com/remote-jobs/${item.id}`,
                companyUrl: item.company_logo || null,
                contactEmail: contactEmail || undefined,
                postedDate: item.date ? new Date(item.date).toLocaleDateString() : 'Recently'
              });
            }
          }
        }
      } catch (err: any) {
        console.warn(`[JOB_SOURCE] RemoteOK search error for tag ${tag}:`, err.message);
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
      remote: true,
      salary_min: raw.salaryMin || null,
      salary_max: raw.salaryMax || null,
      salary_currency: raw.salaryCurrency || 'USD',
      experience_min: raw.experienceMin || null,
      experience_max: raw.experienceMax || null,
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
