import { JobSource, SearchQueryParams, RawJobData, NormalizedJobData } from './job-source.interface';
import { normalizeUrl } from '../utils/normalization';

export class ArbeitnowPublicSource implements JobSource {
  public readonly name = 'arbeitnow';
  public readonly displayName = 'Arbeitnow Tech Jobs';
  public readonly isRestricted = false;

  public async healthCheck(): Promise<{ ok: boolean; message: string }> {
    try {
      const res = await fetch('https://www.arbeitnow.com/api/v1/jobs?page=1', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }
      });
      if (res.ok) {
        return { ok: true, message: 'Arbeitnow API operational.' };
      }
      return { ok: false, message: `Arbeitnow returned status ${res.status}` };
    } catch (e: any) {
      return { ok: false, message: `Arbeitnow connection error: ${e.message}` };
    }
  }

  public async searchJobs(params: SearchQueryParams): Promise<RawJobData[]> {
    console.log(`[JOB_SOURCE] Arbeitnow searching tech jobs for keywords: ${params.keywords.join(', ')}...`);
    const results: RawJobData[] = [];

    try {
      const response = await fetch('https://www.arbeitnow.com/api/v1/jobs?page=1', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }
      });
      if (!response.ok) return [];

      const data = await response.json();
      const jobsList = data.data || [];

      // Extract search tokens from keywords
      const searchTokens = params.keywords.flatMap(kw => kw.toLowerCase().split(/\s+/)).filter(t => t.length > 2);

      for (const item of jobsList) {
        const title = item.title || '';
        const company = item.company_name || 'Tech Enterprise';
        const description = this.stripHtml(item.description || title);
        const fullText = `${title} ${description} ${company}`.toLowerCase();

        // Match either full keyword or any relevant search token
        const matchesKeyword = params.keywords.some(kw => fullText.includes(kw.toLowerCase())) ||
                               searchTokens.some(token => fullText.includes(token));

        if (!matchesKeyword) continue;

        const isRemote = Boolean(item.remote || item.location?.toLowerCase().includes('remote'));
        const jobLoc = item.location || (isRemote ? 'Remote Worldwide' : 'Global');

        results.push({
          source: this.name,
          externalId: `arbeitnow-${item.slug || Math.random().toString(36).substring(7)}`,
          title,
          company,
          location: jobLoc,
          remote: true,
          employmentType: (item.job_types || []).join(', ') || 'Full Time',
          description,
          jobUrl: item.url || `https://www.arbeitnow.com/view/${item.slug}`,
          postedDate: item.created_at ? new Date(item.created_at * 1000).toISOString() : new Date().toISOString(),
          rawData: item
        });
      }
    } catch (err: any) {
      console.warn('[JOB_SOURCE] Arbeitnow fetch warning:', err.message);
    }

    return results;
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
      salary_currency: 'EUR',
      experience_min: null,
      experience_max: null,
      employment_type: raw.employmentType || 'Full Time',
      description: raw.description,
      job_url: normalizeUrl(raw.jobUrl),
      company_url: raw.jobUrl,
      posted_date: raw.postedDate,
      collected_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString()
    };
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
  }
}
